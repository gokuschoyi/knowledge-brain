from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.agents.llm import invoke_structured_output
from apps.agents.llm import coerce_message_text
from apps.agents.schemas import DocumentSummaryResponse, EmptyExtractionVerificationResponse


class _FakePrompt:
    def __or__(self, other):
        return other


class _FakeChain:
    def __init__(self, result):
        self.result = result

    def invoke(self, _payload):
        return self.result


class _FakeModel:
    def __init__(self, result):
        self.result = result
        self.kwargs = None

    def with_structured_output(self, _schema, **kwargs):
        self.kwargs = kwargs
        return _FakeChain(self.result)


class StructuredOutputHelperTests(SimpleTestCase):
    def test_returns_parsed_pydantic_response(self):
        model = _FakeModel(
            {
                "parsed": EmptyExtractionVerificationResponse(
                    should_retry_extraction=False,
                    reason="Chunk is truly empty.",
                ),
                "raw": None,
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            response = invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="openai",
                llm_model="gpt-4o-mini",
                operation="test",
            )

        self.assertIsInstance(response, EmptyExtractionVerificationResponse)
        self.assertEqual(model.kwargs["method"], "json_schema")
        self.assertTrue(model.kwargs["include_raw"])

    def test_recovers_valid_json_from_raw_message_content(self):
        model = _FakeModel(
            {
                "parsed": None,
                "raw": SimpleNamespace(
                    content='{"should_retry_extraction": true, "reason": "More extraction is warranted."}'
                ),
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            response = invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="google",
                llm_model="gemini-2.5-flash-lite",
                operation="test",
            )

        self.assertTrue(response.should_retry_extraction)
        self.assertEqual(model.kwargs["method"], "json_schema")

    def test_google_bundled_extraction_uses_function_calling(self):
        model = _FakeModel(
            {
                "parsed": EmptyExtractionVerificationResponse(
                    should_retry_extraction=False,
                    reason="OK",
                ),
                "raw": None,
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="google",
                llm_model="gemini-3-flash-preview",
                operation="bundled_extraction",
            )

        self.assertEqual(model.kwargs["method"], "function_calling")

    def test_google_empty_verifier_uses_function_calling(self):
        model = _FakeModel(
            {
                "parsed": EmptyExtractionVerificationResponse(
                    should_retry_extraction=True,
                    reason="Has signal.",
                ),
                "raw": None,
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="google",
                llm_model="gemini-3-flash-preview",
                operation="empty_extraction_verifier",
            )

        self.assertEqual(model.kwargs["method"], "function_calling")

    def test_recovers_valid_tool_arguments(self):
        model = _FakeModel(
            {
                "parsed": None,
                "raw": SimpleNamespace(
                    tool_calls=[
                        {
                            "args": {
                                "should_retry_extraction": False,
                                "reason": "Tool output was valid.",
                            }
                        }
                    ]
                ),
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            response = invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="anthropic",
                llm_model="claude-3-5-haiku-latest",
                operation="test",
            )

        self.assertFalse(response.should_retry_extraction)
        self.assertEqual(model.kwargs["method"], "function_calling")

    def test_google_summary_uses_function_calling(self):
        model = _FakeModel(
            {
                "parsed": DocumentSummaryResponse(summary="Short summary."),
                "raw": None,
                "parsing_error": None,
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            response = invoke_structured_output(
                prompt=_FakePrompt(),
                schema=DocumentSummaryResponse,
                payload={"text": "hello"},
                llm_provider="google",
                llm_model="gemini-3-flash-preview",
                operation="document_summary",
            )

        self.assertEqual(response.summary, "Short summary.")
        self.assertEqual(model.kwargs["method"], "function_calling")

    def test_returns_none_for_invalid_raw_payload(self):
        model = _FakeModel(
            {
                "parsed": None,
                "raw": SimpleNamespace(content="not json"),
                "parsing_error": "boom",
            }
        )

        with patch("apps.agents.llm.get_chat_model", return_value=model):
            response = invoke_structured_output(
                prompt=_FakePrompt(),
                schema=EmptyExtractionVerificationResponse,
                payload={"chunk_text": "hello"},
                llm_provider="google",
                llm_model="gemini-2.5-flash-lite",
                operation="test",
            )

        self.assertIsNone(response)

    def test_coerce_message_text_handles_block_content(self):
        text = coerce_message_text(
            [
                {"text": "First sentence. "},
                {"text": "Second sentence."},
            ]
        )

        self.assertEqual(text, "First sentence. Second sentence.")
