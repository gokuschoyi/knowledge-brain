from __future__ import annotations

from unittest.mock import patch

from django.test import TestCase

from apps.agents.schemas import DocumentSummaryResponse
from apps.core.models import Brain
from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, IngestionJob
from apps.documents.services.confidence_calibration import (
    MAX_CALIBRATED_CONFIDENCE,
    calibrate_entity_confidence,
)
from apps.documents.services.ingestion_pipeline import run_ingestion_pipeline
from apps.documents.services.parallel_ingestion_v2 import (
    _consolidate_artifacts,
    _persist_consolidated_knowledge,
    check_or_finalize_ingestion,
    finalize_ingestion_job,
)
from apps.documents.tasks import run_document_ingestion
from apps.knowledge.models import ChunkEntityMention, Claim, Entity, Relationship
from apps.knowledge.services.bundled_extraction import generate_document_summary
from apps.self_healing.models import SelfHealingTask
from apps.self_healing.services.post_ingestion_repair import (
    build_ingestion_job_metadata,
    request_brain_repair_rescan_for_job,
    run_brain_post_ingestion_repair_sweep,
)


class V2ConfidenceCalibrationTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Confidence Brain")
        self.document = Document.objects.create(
            brain=self.brain,
            title="Confidence Notes",
            source_type=Document.SOURCE_TEXT,
            raw_text="Alpha Engine coordinates payment workflows across systems.",
            llm_provider="google",
            llm_model="gemini-test",
            status=Document.STATUS_COMPLETED,
        )
        self.job = IngestionJob.objects.create(
            document=self.document,
            status=IngestionJob.STATUS_PROCESSING,
        )

    def _create_chunk(self, index: int, text: str) -> Chunk:
        return Chunk.objects.create(
            document=self.document,
            text=text,
            summary=text[:120],
            chunk_index=index,
            token_count=160,
            importance_score=0.5,
            quality_score=0.8,
            metadata={},
        )

    def test_entity_calibration_caps_saturated_raw_confidence(self):
        calibrated, notes = calibrate_entity_confidence(
            raw_confidence=1.0,
            name="Alpha Engine",
            description="Coordinates payment workflows across internal systems.",
            mention_count=1,
        )

        self.assertLess(calibrated, 1.0)
        self.assertLessEqual(calibrated, MAX_CALIBRATED_CONFIDENCE)
        self.assertIn("raw_saturated", notes)

    def test_v2_persistence_stores_calibrated_confidence_and_raw_metadata(self):
        chunk_one = self._create_chunk(
            0,
            "Alpha Engine coordinates payment workflows across internal systems.",
        )
        chunk_two = self._create_chunk(
            1,
            "Alpha Engine uses Billing Core to reconcile subscription invoices.",
        )
        artifact_one = ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=chunk_one,
            status=ChunkExtractionArtifact.STATUS_COMPLETED,
            payload={
                "entities": [
                    {
                        "name": "Alpha Engine",
                        "type": "tool",
                        "description": "Coordinates payment workflows across internal systems.",
                        "confidence": 1.0,
                        "aliases": ["Alpha"],
                    },
                    {
                        "name": "Billing Core",
                        "type": "service",
                        "description": "",
                        "confidence": 1.0,
                        "aliases": [],
                    },
                ],
                "claims": [
                    {
                        "text": "Alpha Engine coordinates payment workflows across internal systems.",
                        "subject": "Alpha Engine",
                        "confidence": 1.0,
                    }
                ],
                "relationships": [
                    {
                        "source": "Alpha Engine",
                        "target": "Billing Core",
                        "type": "related_to",
                        "confidence": 1.0,
                    }
                ],
            },
        )
        artifact_two = ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=chunk_two,
            status=ChunkExtractionArtifact.STATUS_COMPLETED,
            payload={
                "entities": [
                    {
                        "name": "Alpha Engine",
                        "type": "tool",
                        "description": "Coordinates payment workflows across internal systems.",
                        "confidence": 1.0,
                        "aliases": [],
                    }
                ],
                "claims": [
                    {
                        "text": "Alpha Engine uses Billing Core to reconcile subscription invoices.",
                        "subject": "Alpha Engine",
                        "confidence": 1.0,
                    }
                ],
                "relationships": [],
            },
        )

        entities, claims, relationships = _consolidate_artifacts([artifact_one, artifact_two])
        _persist_consolidated_knowledge(
            self.document,
            entities,
            claims,
            relationships,
        )

        entity = Entity.objects.get(name="Alpha Engine")
        mention_confidences = list(
            ChunkEntityMention.objects.filter(entity=entity).values_list("confidence", flat=True)
        )
        claims = list(Claim.objects.filter(subject_entity=entity).order_by("id"))
        relationship = Relationship.objects.get(source_entity=entity)

        self.assertLess(entity.confidence, 1.0)
        self.assertLessEqual(entity.confidence, MAX_CALIBRATED_CONFIDENCE)
        self.assertEqual(entity.metadata["raw_confidence"], 1.0)
        self.assertEqual(entity.metadata["confidence_source"], "llm+heuristic")
        self.assertIn("raw_saturated", entity.metadata["confidence_notes"])
        self.assertTrue(all(confidence < 1.0 for confidence in mention_confidences))
        self.assertEqual(len(claims), 2)
        self.assertTrue(all(claim.confidence < 1.0 for claim in claims))
        self.assertTrue(all(claim.metadata["raw_confidence"] == 1.0 for claim in claims))
        self.assertTrue(all(claim.metadata["confidence_source"] == "llm+heuristic" for claim in claims))
        self.assertLess(relationship.confidence, 1.0)
        self.assertIn(
            "fallback_relationship_type",
            relationship.metadata["confidence_notes"],
        )


class IngestionPipelineDispatchTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Dispatch Brain")
        self.document = Document.objects.create(
            brain=self.brain,
            title="Dispatch Notes",
            source_type=Document.SOURCE_TEXT,
            raw_text="Alpha Engine coordinates payment workflows.",
        )
        self.job = IngestionJob.objects.create(document=self.document)

    @patch("apps.documents.services.ingestion_pipeline.run_parallel_v2_ingestion")
    def test_run_document_ingestion_always_dispatches_to_v2(self, mock_run_parallel_v2):
        run_document_ingestion(self.document.id, self.job.id)

        mock_run_parallel_v2.assert_called_once_with(
            document_id=self.document.id,
            job_id=self.job.id,
        )

    @patch("apps.documents.services.ingestion_pipeline.request_brain_repair_rescan_for_job")
    @patch(
        "apps.documents.services.ingestion_pipeline.run_parallel_v2_ingestion",
        side_effect=RuntimeError("pipeline boom"),
    )
    def test_ingestion_pipeline_marks_document_and_job_failed_when_v2_raises(
        self,
        _mock_run_parallel_v2,
        mock_request_rescan,
    ):
        with self.assertRaisesMessage(RuntimeError, "pipeline boom"):
            run_ingestion_pipeline(self.document.id, self.job.id)

        self.document.refresh_from_db()
        self.job.refresh_from_db()

        self.assertEqual(self.document.status, Document.STATUS_FAILED)
        self.assertEqual(self.document.error_message, "pipeline boom")
        self.assertEqual(self.job.status, IngestionJob.STATUS_FAILED)
        self.assertEqual(self.job.error_message, "pipeline boom")
        mock_request_rescan.assert_called_once_with(self.job.id)


class IngestionFinalizationTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Finalization Brain")
        self.document = Document.objects.create(
            brain=self.brain,
            title="Finalization Notes",
            source_type=Document.SOURCE_TEXT,
            raw_text="Alpha Engine works with Billing Core.",
            llm_provider="google",
            llm_model="gemini-test",
            status=Document.STATUS_PROCESSING,
        )
        self.job = IngestionJob.objects.create(
            document=self.document,
            status=IngestionJob.STATUS_PROCESSING,
        )

    def _create_chunk(self, index: int, text: str) -> Chunk:
        return Chunk.objects.create(
            document=self.document,
            text=text,
            summary=text[:120],
            chunk_index=index,
            token_count=120,
            importance_score=0.5,
            quality_score=0.8,
            metadata={},
        )

    @patch("apps.documents.services.parallel_ingestion_v2.request_brain_repair_rescan_for_job")
    @patch("apps.documents.services.parallel_ingestion_v2.generate_tasks_for_document")
    @patch("apps.documents.services.parallel_ingestion_v2.detect_contradictions_for_document")
    @patch("apps.documents.services.parallel_ingestion_v2.enrich_document_knowledge")
    @patch("apps.documents.services.parallel_ingestion_v2.build_graph_for_document")
    @patch(
        "apps.documents.services.parallel_ingestion_v2.generate_document_summary", return_value="Consolidated summary"
    )
    @patch("apps.documents.services.parallel_ingestion_v2.score_document_quality", return_value=0.91)
    def test_finalize_ingestion_job_completes_with_partial_chunk_failures(
        self,
        _mock_score_document_quality,
        _mock_generate_document_summary,
        _mock_build_graph,
        _mock_enrich_document_knowledge,
        _mock_detect_contradictions,
        _mock_generate_tasks,
        mock_request_rescan,
    ):
        successful_chunk = self._create_chunk(0, "Alpha Engine coordinates payment workflows.")
        failed_chunk = self._create_chunk(1, "Billing Core reconciles invoices.")
        ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=successful_chunk,
            status=ChunkExtractionArtifact.STATUS_COMPLETED,
            payload={
                "entities": [
                    {
                        "name": "Alpha Engine",
                        "type": "tool",
                        "description": "Coordinates payment workflows.",
                        "confidence": 0.88,
                        "aliases": [],
                    },
                    {
                        "name": "Billing Core",
                        "type": "service",
                        "description": "Reconciles invoices.",
                        "confidence": 0.84,
                        "aliases": [],
                    },
                ],
                "claims": [
                    {
                        "text": "Alpha Engine coordinates payment workflows.",
                        "subject": "Alpha Engine",
                        "confidence": 0.86,
                    }
                ],
                "relationships": [
                    {
                        "source": "Alpha Engine",
                        "target": "Billing Core",
                        "type": "related_to",
                        "confidence": 0.81,
                    }
                ],
            },
        )
        ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=failed_chunk,
            status=ChunkExtractionArtifact.STATUS_FAILED,
            error_message="LLM timeout",
        )

        finalize_ingestion_job(self.job.id)

        self.document.refresh_from_db()
        self.job.refresh_from_db()

        self.assertEqual(self.document.status, Document.STATUS_COMPLETED)
        self.assertEqual(self.document.summary, "Consolidated summary")
        self.assertEqual(self.document.quality_score, 0.91)
        self.assertEqual(self.job.status, IngestionJob.STATUS_COMPLETED)
        self.assertIn(
            "1 chunk extraction task(s) failed. Finalizing with partial results.",
            self.job.metadata["warnings"],
        )
        self.assertTrue(self.job.metadata["finalization"]["is_finalized"])
        self.assertEqual(Entity.objects.filter(brain=self.brain).count(), 2)
        self.assertEqual(Claim.objects.count(), 1)
        self.assertEqual(Relationship.objects.count(), 1)
        _mock_generate_document_summary.assert_called_once_with(
            self.document.raw_text or "",
            self.document.title,
            llm_provider=self.document.llm_provider,
            llm_model=self.document.llm_model,
            document_id=self.document.id,
        )
        mock_request_rescan.assert_called_once_with(self.job.id)

    @patch("apps.documents.services.parallel_ingestion_v2.request_brain_repair_rescan_for_job")
    def test_check_or_finalize_ingestion_marks_job_failed_when_all_chunk_tasks_fail(self, mock_request_rescan):
        failed_chunk = self._create_chunk(0, "No structured knowledge survived.")
        ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=failed_chunk,
            status=ChunkExtractionArtifact.STATUS_FAILED,
            error_message="LLM timeout",
        )

        check_or_finalize_ingestion(self.job.id)

        self.document.refresh_from_db()
        self.job.refresh_from_db()

        self.assertEqual(self.document.status, Document.STATUS_FAILED)
        self.assertEqual(self.document.error_message, "All chunk extraction tasks failed.")
        self.assertEqual(self.job.status, IngestionJob.STATUS_FAILED)
        self.assertEqual(self.job.error_message, "All chunk extraction tasks failed.")
        self.assertTrue(self.job.metadata["finalization"]["is_finalized"])
        mock_request_rescan.assert_called_once_with(self.job.id)


class DocumentSummaryGenerationTests(TestCase):
    @patch("apps.knowledge.services.bundled_extraction.get_chat_model", return_value=object())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        return_value=DocumentSummaryResponse(summary="Generated summary text."),
    )
    def test_generate_document_summary_returns_structured_summary(
        self,
        _mock_invoke,
        _mock_get_model,
    ):
        summary = generate_document_summary(
            "Raw document text",
            "Doc title",
            llm_provider="google",
            llm_model="gemini-3-flash-preview",
            document_id=9,
        )

        self.assertEqual(summary, "Generated summary text.")

    @patch("apps.knowledge.services.bundled_extraction.get_chat_model", return_value=object())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        return_value=type("SummaryResponse", (), {"summary": [{"text": "Generated "}, {"text": "summary text."}]})(),
    )
    def test_generate_document_summary_normalizes_block_style_summary_values(
        self,
        _mock_invoke,
        _mock_get_model,
    ):
        summary = generate_document_summary(
            "Raw document text",
            "Doc title",
            llm_provider="google",
            llm_model="gemini-3-flash-preview",
            document_id=9,
        )

        self.assertEqual(summary, "Generated summary text.")

    @patch("apps.knowledge.services.bundled_extraction.get_chat_model", return_value=object())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        return_value=type("SummaryResponse", (), {"summary": ""})(),
    )
    def test_generate_document_summary_falls_back_only_when_summary_empty(
        self,
        _mock_invoke,
        _mock_get_model,
    ):
        text = "A" * 500
        summary = generate_document_summary(
            text,
            "Doc title",
            llm_provider="google",
            llm_model="gemini-3-flash-preview",
            document_id=9,
        )

        self.assertEqual(summary, text[:400])


class PostIngestionRepairSchedulingTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Rescan Brain")

    @patch("apps.self_healing.tasks.run_post_ingestion_repair_sweep_task.delay")
    def test_single_completed_job_requests_brain_rescan_immediately(self, mock_delay):
        document = Document.objects.create(
            brain=self.brain,
            title="Single upload",
            source_type=Document.SOURCE_TEXT,
            raw_text="Alpha Engine overview.",
            status=Document.STATUS_COMPLETED,
        )
        job = IngestionJob.objects.create(
            document=document,
            status=IngestionJob.STATUS_COMPLETED,
        )

        with self.captureOnCommitCallbacks(execute=True):
            requested = request_brain_repair_rescan_for_job(job.id)

        self.assertTrue(requested)
        job.refresh_from_db()
        self.brain.refresh_from_db()
        self.assertTrue(job.metadata["repair_rescan_requested"])
        self.assertEqual(self.brain.pending_ingestion_repair_rescan_version, 1)
        self.assertTrue(self.brain.ingestion_repair_rescan_running)
        mock_delay.assert_called_once_with(str(self.brain.id))

    @patch("apps.self_healing.tasks.run_post_ingestion_repair_sweep_task.delay")
    def test_bulk_jobs_wait_until_batch_is_terminal_before_requesting_rescan(self, mock_delay):
        batch_token = "batch-123"
        doc_one = Document.objects.create(
            brain=self.brain,
            title="Bulk one",
            source_type=Document.SOURCE_TEXT,
            raw_text="Alpha Engine details.",
            status=Document.STATUS_COMPLETED,
        )
        doc_two = Document.objects.create(
            brain=self.brain,
            title="Bulk two",
            source_type=Document.SOURCE_TEXT,
            raw_text="Billing Core details.",
            status=Document.STATUS_PROCESSING,
        )
        job_one = IngestionJob.objects.create(
            document=doc_one,
            status=IngestionJob.STATUS_COMPLETED,
            metadata=build_ingestion_job_metadata(batch_token),
        )
        job_two = IngestionJob.objects.create(
            document=doc_two,
            status=IngestionJob.STATUS_PROCESSING,
            metadata=build_ingestion_job_metadata(batch_token),
        )

        with self.captureOnCommitCallbacks(execute=True):
            requested_early = request_brain_repair_rescan_for_job(job_one.id)
        self.assertFalse(requested_early)
        mock_delay.assert_not_called()

        job_two.status = IngestionJob.STATUS_FAILED
        job_two.save(update_fields=["status", "updated_at"])
        with self.captureOnCommitCallbacks(execute=True):
            requested_terminal = request_brain_repair_rescan_for_job(job_two.id)
            duplicate_request = request_brain_repair_rescan_for_job(job_one.id)

        self.assertTrue(requested_terminal)
        self.assertFalse(duplicate_request)
        self.brain.refresh_from_db()
        job_one.refresh_from_db()
        job_two.refresh_from_db()
        self.assertTrue(job_one.metadata["repair_rescan_requested"])
        self.assertTrue(job_two.metadata["repair_rescan_requested"])
        self.assertEqual(self.brain.pending_ingestion_repair_rescan_version, 1)
        mock_delay.assert_called_once_with(str(self.brain.id))


class PostIngestionRepairSweepTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(
            name="Repair Sweep Brain",
            pending_ingestion_repair_rescan_version=1,
            completed_ingestion_repair_rescan_version=0,
            ingestion_repair_rescan_running=True,
        )

    def _create_document(self, title: str) -> Document:
        return Document.objects.create(
            brain=self.brain,
            title=title,
            source_type=Document.SOURCE_TEXT,
            raw_text=f"{title} text",
            status=Document.STATUS_COMPLETED,
        )

    def _create_chunk(self, document: Document, index: int, text: str) -> Chunk:
        return Chunk.objects.create(
            document=document,
            text=text,
            summary=text[:120],
            chunk_index=index,
            token_count=80,
            importance_score=0.5,
            quality_score=0.8,
            metadata={},
        )

    def test_brain_repair_sweep_creates_cross_document_contradiction_task(self):
        document_one = self._create_document("Pricing A")
        document_two = self._create_document("Pricing B")
        shared_entity = Entity.objects.create(
            brain=self.brain,
            name="Pro Plan",
            canonical_name="Pro Plan",
            entity_type="plan",
            description="Subscription plan",
            aliases=[],
        )
        chunk_one = self._create_chunk(document_one, 0, "The Pro Plan costs $10 per month.")
        chunk_two = self._create_chunk(document_two, 0, "The Pro Plan costs $20 per month.")
        ChunkEntityMention.objects.create(
            chunk=chunk_one, entity=shared_entity, mention_text="Pro Plan", confidence=0.9
        )
        ChunkEntityMention.objects.create(
            chunk=chunk_two, entity=shared_entity, mention_text="Pro Plan", confidence=0.9
        )
        Claim.objects.create(
            text="The Pro Plan costs $10 per month.",
            source_chunk=chunk_one,
            subject_entity=shared_entity,
            confidence=0.9,
        )
        Claim.objects.create(
            text="The Pro Plan costs $20 per month.",
            source_chunk=chunk_two,
            subject_entity=shared_entity,
            confidence=0.9,
        )

        processed_version = run_brain_post_ingestion_repair_sweep(self.brain.id)

        self.assertEqual(processed_version, 1)
        self.brain.refresh_from_db()
        task = SelfHealingTask.objects.get(task_type=SelfHealingTask.TYPE_CONTRADICTION)
        self.assertEqual(task.related_document_id, document_two.id)
        self.assertEqual(task.payload["claim_ids"], sorted(task.payload["claim_ids"]))
        self.assertEqual(self.brain.completed_ingestion_repair_rescan_version, 1)
        self.assertFalse(self.brain.ingestion_repair_rescan_running)

    def test_brain_repair_sweep_creates_duplicate_and_missing_definition_tasks(self):
        document_one = self._create_document("Alpha Notes")
        document_two = self._create_document("Beta Notes")
        duplicate_one = Entity.objects.create(
            brain=self.brain,
            name="Alpha Engine",
            canonical_name="Alpha Engine",
            entity_type="service",
            description="Coordinates workflows.",
            aliases=[],
        )
        duplicate_two = Entity.objects.create(
            brain=self.brain,
            name="Alpha-Engine",
            canonical_name="Alpha-Engine",
            entity_type="service",
            description="Workflow platform.",
            aliases=[],
        )
        weak_entity = Entity.objects.create(
            brain=self.brain,
            name="Billing Core",
            canonical_name="Billing Core",
            entity_type="service",
            description="concept derived from ingested sources",
            aliases=[],
        )
        chunk_one = self._create_chunk(document_one, 0, "Alpha Engine uses Billing Core.")
        chunk_two = self._create_chunk(document_two, 0, "Alpha-Engine depends on Billing Core.")
        ChunkEntityMention.objects.create(
            chunk=chunk_one, entity=duplicate_one, mention_text="Alpha Engine", confidence=0.8
        )
        ChunkEntityMention.objects.create(
            chunk=chunk_two, entity=duplicate_two, mention_text="Alpha-Engine", confidence=0.8
        )
        ChunkEntityMention.objects.create(
            chunk=chunk_one, entity=weak_entity, mention_text="Billing Core", confidence=0.8
        )
        ChunkEntityMention.objects.create(
            chunk=chunk_two, entity=weak_entity, mention_text="Billing Core", confidence=0.8
        )

        run_brain_post_ingestion_repair_sweep(self.brain.id)

        self.assertTrue(SelfHealingTask.objects.filter(task_type=SelfHealingTask.TYPE_DUPLICATE_ENTITY).exists())
        self.assertTrue(SelfHealingTask.objects.filter(task_type=SelfHealingTask.TYPE_MISSING_DEFINITION).exists())
