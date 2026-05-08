from __future__ import annotations

from django.test import TestCase

from apps.core.models import Brain
from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, IngestionJob
from apps.documents.services.confidence_calibration import (
    MAX_CALIBRATED_CONFIDENCE,
    calibrate_entity_confidence,
)
from apps.documents.services.parallel_ingestion_v2 import (
    _consolidate_artifacts,
    _persist_consolidated_knowledge,
)
from apps.knowledge.models import ChunkEntityMention, Claim, Entity, Relationship


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

        entities, claims, relationships = _consolidate_artifacts(
            [artifact_one, artifact_two]
        )
        _persist_consolidated_knowledge(
            self.document,
            entities,
            claims,
            relationships,
        )

        entity = Entity.objects.get(name="Alpha Engine")
        mention_confidences = list(
            ChunkEntityMention.objects.filter(entity=entity).values_list(
                "confidence", flat=True
            )
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
        self.assertTrue(
            all(claim.metadata["raw_confidence"] == 1.0 for claim in claims)
        )
        self.assertTrue(
            all(
                claim.metadata["confidence_source"] == "llm+heuristic"
                for claim in claims
            )
        )
        self.assertLess(relationship.confidence, 1.0)
        self.assertIn(
            "fallback_relationship_type",
            relationship.metadata["confidence_notes"],
        )
