from __future__ import annotations

from unittest.mock import patch
from rest_framework.test import APIRequestFactory

from django.test import SimpleTestCase, TestCase

from apps.agents.schemas import BundledExtractionResponse
from apps.core.models import Brain
from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, IngestionJob
from apps.documents.views import ChunkRetryView
from apps.documents.services.parallel_ingestion_v2 import (
    run_chunk_bundled_extraction_for_artifact,
)
from apps.knowledge.services.bundled_extraction import (
    BundledExtractionError,
    BundledExtractionNullResponseError,
    EMPTY_CHECK_NOT_NEEDED,
    EMPTY_CHECK_RETRY_RECOMMENDED,
    EMPTY_CHECK_VERIFIED_EMPTY,
    EmptyExtractionVerificationError,
    extract_bundled_payload,
    run_bundled_extraction_with_verification,
)


class _FakePrompt:
    def __or__(self, other):
        return other


class _FakeChain:
    def __init__(self, result=None, error: Exception | None = None):
        self.result = result
        self.error = error

    def invoke(self, _payload):
        if self.error is not None:
            raise self.error
        return self.result


class _FakeModel:
    def __init__(self, result=None, error: Exception | None = None):
        self.result = result
        self.error = error

    def with_structured_output(self, _schema, **_kwargs):
        return _FakeChain(result=self.result, error=self.error)


class BundledExtractionPayloadTests(SimpleTestCase):
    @patch("apps.knowledge.services.bundled_extraction.get_chat_model", return_value=None)
    def test_missing_model_raises_retryable_error(self, _mock_get_model):
        with self.assertRaisesMessage(
            BundledExtractionError,
            "No live chat model was available for chunk extraction.",
        ):
            extract_bundled_payload("hello", "Doc", chunk_id=1, document_id=1)

    @patch("apps.knowledge.services.bundled_extraction.ChatPromptTemplate.from_messages", return_value=_FakePrompt())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        return_value=None,
    )
    @patch(
        "apps.knowledge.services.bundled_extraction.get_chat_model",
        return_value=object(),
    )
    def test_null_structured_response_raises_retryable_error(
        self,
        _mock_get_model,
        _mock_invoke,
        _mock_prompt,
    ):
        with self.assertRaisesMessage(
            BundledExtractionError,
            "Chunk extraction returned no structured response.",
        ):
            extract_bundled_payload("hello", "Doc", chunk_id=1, document_id=1)

    @patch("apps.knowledge.services.bundled_extraction.ChatPromptTemplate.from_messages", return_value=_FakePrompt())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        side_effect=RuntimeError("boom"),
    )
    @patch(
        "apps.knowledge.services.bundled_extraction.get_chat_model",
        return_value=object(),
    )
    def test_model_exception_raises_retryable_error(
        self,
        _mock_get_model,
        _mock_invoke,
        _mock_prompt,
    ):
        with self.assertRaisesMessage(
            BundledExtractionError,
            "Chunk extraction failed while calling the language model.",
        ):
            extract_bundled_payload("hello", "Doc", chunk_id=1, document_id=1)

    @patch("apps.knowledge.services.bundled_extraction.ChatPromptTemplate.from_messages", return_value=_FakePrompt())
    @patch(
        "apps.knowledge.services.bundled_extraction.invoke_structured_output",
        return_value=BundledExtractionResponse(
            entities=[],
            claims=[],
            relationships=[],
        ),
    )
    @patch(
        "apps.knowledge.services.bundled_extraction.get_chat_model",
        return_value=object(),
    )
    def test_valid_empty_structured_response_is_preserved(
        self,
        _mock_get_model,
        _mock_invoke,
        _mock_prompt,
    ):
        payload = extract_bundled_payload("hello", "Doc", chunk_id=1, document_id=1)
        self.assertEqual(
            payload,
            {"entities": [], "claims": [], "relationships": []},
        )

    @patch(
        "apps.knowledge.services.bundled_extraction.verify_empty_bundled_payload",
        return_value={
            "should_retry_extraction": False,
            "reason": "The chunk is boilerplate and does not contain structured knowledge.",
        },
    )
    @patch("apps.knowledge.services.bundled_extraction.extract_bundled_payload")
    def test_shared_helper_marks_valid_empty_as_verified_empty(
        self,
        mock_extract,
        _mock_verify,
    ):
        mock_extract.return_value = {"entities": [], "claims": [], "relationships": []}

        result = run_bundled_extraction_with_verification("hello", "Doc")

        self.assertEqual(result["payload"], {"entities": [], "claims": [], "relationships": []})
        self.assertEqual(result["empty_verification_status"], EMPTY_CHECK_VERIFIED_EMPTY)
        self.assertFalse(result["retry_recommended"])

    @patch(
        "apps.knowledge.services.bundled_extraction.verify_empty_bundled_payload",
        return_value={
            "should_retry_extraction": False,
            "reason": "The chunk is navigation text and truly empty for extraction.",
        },
    )
    @patch(
        "apps.knowledge.services.bundled_extraction.extract_bundled_payload",
        side_effect=BundledExtractionError("Chunk extraction returned no structured response."),
    )
    def test_shared_helper_does_not_swallow_hard_failures(
        self,
        _mock_extract,
        _mock_verify,
    ):
        with self.assertRaisesMessage(
            BundledExtractionError,
            "Chunk extraction returned no structured response.",
        ):
            run_bundled_extraction_with_verification("hello", "Doc")

    @patch(
        "apps.knowledge.services.bundled_extraction.verify_empty_bundled_payload",
        return_value={
            "should_retry_extraction": False,
            "reason": "The chunk is navigation text and truly empty for extraction.",
        },
    )
    @patch(
        "apps.knowledge.services.bundled_extraction.extract_bundled_payload",
        side_effect=BundledExtractionNullResponseError("Chunk extraction returned no structured response."),
    )
    def test_shared_helper_verifies_null_response_as_empty_candidate(
        self,
        _mock_extract,
        _mock_verify,
    ):
        result = run_bundled_extraction_with_verification("hello", "Doc")

        self.assertEqual(
            result["payload"],
            {"entities": [], "claims": [], "relationships": []},
        )
        self.assertEqual(result["empty_verification_status"], EMPTY_CHECK_VERIFIED_EMPTY)
        self.assertFalse(result["retry_recommended"])

    @patch(
        "apps.knowledge.services.bundled_extraction.verify_empty_bundled_payload",
        return_value={
            "should_retry_extraction": True,
            "reason": "The chunk contains named tools and explicit factual statements.",
        },
    )
    @patch("apps.knowledge.services.bundled_extraction.extract_bundled_payload")
    def test_shared_helper_marks_retry_recommended_empty(
        self,
        mock_extract,
        _mock_verify,
    ):
        mock_extract.return_value = {"entities": [], "claims": [], "relationships": []}

        result = run_bundled_extraction_with_verification("hello", "Doc")

        self.assertEqual(result["payload"], {})
        self.assertEqual(
            result["empty_verification_status"],
            EMPTY_CHECK_RETRY_RECOMMENDED,
        )
        self.assertTrue(result["retry_recommended"])


class ChunkExtractionArtifactRunnerTests(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="Test Brain")
        self.document = Document.objects.create(
            brain=self.brain,
            title="Doc",
            source_type=Document.SOURCE_TEXT,
            raw_text="Some content",
            llm_provider="google",
            llm_model="gemini-1.5-flash",
        )
        self.job = IngestionJob.objects.create(document=self.document)
        self.chunk = Chunk.objects.create(
            document=self.document,
            text="Chunk body",
            summary="Chunk summary",
            chunk_index=0,
            token_count=10,
        )
        self.artifact = ChunkExtractionArtifact.objects.create(
            ingestion_job=self.job,
            document=self.document,
            chunk=self.chunk,
            status=ChunkExtractionArtifact.STATUS_QUEUED,
        )
        self.factory = APIRequestFactory()

    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        side_effect=BundledExtractionError("Chunk extraction returned no structured response."),
    )
    def test_runner_marks_retryable_failure_without_saving_empty_payload(self, _mock_run):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_FAILED)
        self.assertEqual(self.artifact.payload, {})
        self.assertEqual(
            self.artifact.error_message,
            "Chunk extraction returned no structured response.",
        )
        self.assertIsNotNone(self.artifact.completed_at)

    @patch(
        "apps.documents.services.parallel_ingestion_v2.inspect_payload_confidence_patterns",
        return_value=[],
    )
    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        return_value={
            "payload": {"entities": [], "claims": [], "relationships": []},
            "empty_verification_status": EMPTY_CHECK_VERIFIED_EMPTY,
            "empty_verification_message": "The chunk appears to be navigation text with no structured knowledge.",
            "retry_recommended": False,
        },
    )
    def test_runner_keeps_null_response_verified_empty_as_completed(
        self,
        _mock_run,
        _mock_inspect,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_COMPLETED)
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_VERIFIED_EMPTY,
        )
        self.assertEqual(
            self.artifact.empty_verification_message,
            "The chunk appears to be navigation text with no structured knowledge.",
        )

    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        return_value={
            "payload": {},
            "empty_verification_status": EMPTY_CHECK_RETRY_RECOMMENDED,
            "empty_verification_message": "The chunk names tools and workflows that should have been extracted.",
            "retry_recommended": True,
        },
    )
    def test_runner_marks_null_response_failed_when_verifier_detects_signal(
        self,
        _mock_run,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_FAILED)
        self.assertEqual(self.artifact.payload, {})
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_RETRY_RECOMMENDED,
        )
        self.assertEqual(
            self.artifact.empty_verification_message,
            "The chunk names tools and workflows that should have been extracted.",
        )
        self.assertIn("verifier detected likely extractable knowledge", self.artifact.error_message)

    @patch(
        "apps.documents.services.parallel_ingestion_v2.inspect_payload_confidence_patterns",
        return_value=[],
    )
    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        return_value={
            "payload": {"entities": [], "claims": [], "relationships": []},
            "empty_verification_status": EMPTY_CHECK_VERIFIED_EMPTY,
            "empty_verification_message": "The chunk is boilerplate and does not contain structured knowledge.",
            "retry_recommended": False,
        },
    )
    def test_runner_keeps_valid_empty_payload_as_completed(
        self,
        _mock_run,
        _mock_inspect,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_COMPLETED)
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_VERIFIED_EMPTY,
        )
        self.assertEqual(
            self.artifact.empty_verification_message,
            "The chunk is boilerplate and does not contain structured knowledge.",
        )
        self.assertEqual(
            self.artifact.payload,
            {"entities": [], "claims": [], "relationships": []},
        )
        self.assertEqual(self.artifact.error_message, "")
        self.assertIsNotNone(self.artifact.completed_at)

    @patch(
        "apps.documents.services.parallel_ingestion_v2.inspect_payload_confidence_patterns",
        return_value=[],
    )
    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        return_value={
            "payload": {
                "entities": [
                    {
                        "name": "Alpha Engine",
                        "type": "tool",
                        "description": "Coordinates workflows.",
                        "confidence": 0.81,
                        "aliases": [],
                    }
                ],
                "claims": [
                    {
                        "text": "Alpha Engine coordinates workflows.",
                        "subject": "Alpha Engine",
                        "confidence": 0.76,
                    }
                ],
                "relationships": [
                    {
                        "source": "Alpha Engine",
                        "target": "Billing Core",
                        "type": "uses",
                        "confidence": 0.72,
                    }
                ],
            },
            "empty_verification_status": EMPTY_CHECK_NOT_NEEDED,
            "empty_verification_message": "",
            "retry_recommended": False,
        },
    )
    def test_runner_persists_non_empty_payload_without_dropping_extracted_items(
        self,
        _mock_run,
        _mock_inspect,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_COMPLETED)
        self.assertEqual(self.artifact.empty_verification_status, ChunkExtractionArtifact.EMPTY_CHECK_NOT_NEEDED)
        self.assertEqual(len(self.artifact.payload["entities"]), 1)
        self.assertEqual(len(self.artifact.payload["claims"]), 1)
        self.assertEqual(len(self.artifact.payload["relationships"]), 1)

    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        return_value={
            "payload": {},
            "empty_verification_status": EMPTY_CHECK_RETRY_RECOMMENDED,
            "empty_verification_message": "The chunk contains named tools and explicit factual statements.",
            "retry_recommended": True,
        },
    )
    def test_runner_marks_empty_payload_as_failed_when_verifier_detects_signal(
        self,
        _mock_run,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_FAILED)
        self.assertEqual(self.artifact.payload, {})
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_RETRY_RECOMMENDED,
        )
        self.assertEqual(
            self.artifact.empty_verification_message,
            "The chunk contains named tools and explicit factual statements.",
        )
        self.assertIn("verifier detected likely extractable knowledge", self.artifact.error_message)

    @patch(
        "apps.documents.services.parallel_ingestion_v2.run_bundled_extraction_with_verification",
        side_effect=EmptyExtractionVerificationError(
            "Empty extraction could not be verified because the verifier failed."
        ),
    )
    def test_runner_marks_empty_payload_failed_when_verifier_fails(
        self,
        _mock_run,
    ):
        run_chunk_bundled_extraction_for_artifact(self.artifact.id)
        self.artifact.refresh_from_db()

        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_FAILED)
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_RETRY_RECOMMENDED,
        )
        self.assertEqual(
            self.artifact.error_message,
            "Empty extraction could not be verified because the verifier failed.",
        )

    def test_chunk_retry_view_clears_verifier_metadata(self):
        self.artifact.status = ChunkExtractionArtifact.STATUS_FAILED
        self.artifact.error_message = "Old error"
        self.artifact.empty_verification_status = ChunkExtractionArtifact.EMPTY_CHECK_RETRY_RECOMMENDED
        self.artifact.empty_verification_message = "Old verifier message"
        self.artifact.save(
            update_fields=[
                "status",
                "error_message",
                "empty_verification_status",
                "empty_verification_message",
                "updated_at",
            ]
        )

        request = self.factory.post("/documents/1/chunks/1/retry/")
        response = ChunkRetryView.as_view()(
            request,
            doc_pk=self.document.id,
            chunk_pk=self.chunk.id,
        )

        self.assertEqual(response.status_code, 202)
        self.artifact.refresh_from_db()
        self.assertEqual(self.artifact.status, ChunkExtractionArtifact.STATUS_QUEUED)
        self.assertEqual(self.artifact.error_message, "")
        self.assertEqual(
            self.artifact.empty_verification_status,
            ChunkExtractionArtifact.EMPTY_CHECK_NOT_NEEDED,
        )
        self.assertEqual(self.artifact.empty_verification_message, "")
