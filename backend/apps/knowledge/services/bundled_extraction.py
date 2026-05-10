from __future__ import annotations

import logging
from django.conf import settings
from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import coerce_message_text, get_chat_model, invoke_structured_output
from apps.agents.prompts import (
    BUNDLED_EXTRACTION_PROMPT,
    DOCUMENT_SUMMARY_PROMPT,
    EMPTY_EXTRACTION_VERIFIER_PROMPT,
)
from apps.agents.schemas import (
    BundledExtractionResponse,
    DocumentSummaryResponse,
    EmptyExtractionVerificationResponse,
)

logger = logging.getLogger(__name__)


class BundledExtractionError(RuntimeError):
    """Raised when bundled extraction could not produce a structured result."""


class BundledExtractionNullResponseError(BundledExtractionError):
    """Raised when the extraction call succeeds but produces no structured payload."""


class EmptyExtractionVerificationError(RuntimeError):
    """Raised when an empty extraction result cannot be confidently verified."""


EMPTY_CHECK_NOT_NEEDED = "not_needed"
EMPTY_CHECK_VERIFIED_EMPTY = "verified_empty"
EMPTY_CHECK_RETRY_RECOMMENDED = "retry_recommended"


def _empty_payload() -> dict:
    return {"entities": [], "claims": [], "relationships": []}


def _ensure_live_chat_model(
    *,
    llm_provider: str | None,
    llm_model: str | None,
    max_tokens: int | None = None,
    document_id: int | None = None,
    chunk_id: int | None = None,
) -> None:
    if get_chat_model(llm_provider, llm_model, max_tokens=max_tokens) is not None:
        return
    logger.warning(
        "Bundled extraction skipped because no live chat model is available "
        "(document_id=%s, chunk_id=%s, provider=%s, model=%s).",
        document_id,
        chunk_id,
        llm_provider,
        llm_model,
    )
    raise BundledExtractionError("No live chat model was available for chunk extraction.")


def _llm_bundled(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    _ensure_live_chat_model(
        llm_provider=llm_provider,
        llm_model=llm_model,
        document_id=document_id,
        chunk_id=chunk_id,
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", BUNDLED_EXTRACTION_PROMPT),
            (
                "human",
                "Document title: {document_title}\n\nChunk text:\n{chunk_text}",
            ),
        ]
    )
    try:
        response = invoke_structured_output(
            prompt=prompt,
            schema=BundledExtractionResponse,
            payload={
                "document_title": document_title,
                "chunk_text": text,
                "max_entities": settings.EXTRACTION_MAX_ENTITIES,
                "max_claims": settings.EXTRACTION_MAX_CLAIMS,
                "max_relationships": settings.EXTRACTION_MAX_RELATIONSHIPS,
            },
            llm_provider=llm_provider,
            llm_model=llm_model,
            max_tokens=settings.EXTRACTION_MAX_OUTPUT_TOKENS,
            operation="bundled_extraction",
        )
        if response is not None:
            response.entities = response.entities[: settings.EXTRACTION_MAX_ENTITIES]
            response.claims = response.claims[: settings.EXTRACTION_MAX_CLAIMS]
            response.relationships = response.relationships[: settings.EXTRACTION_MAX_RELATIONSHIPS]
        if response is None:
            logger.warning(
                "Bundled extraction returned no structured response "
                "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s).",
                document_id,
                chunk_id,
                llm_provider,
                llm_model,
                len(text),
            )
            raise BundledExtractionNullResponseError(
                "Chunk extraction returned no structured response."
            )
        return response.model_dump()
    except BundledExtractionError:
        raise
    except Exception as e:
        logger.exception(
            "Error in bundled extraction LLM call "
            "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s): %s",
            document_id,
            chunk_id,
            llm_provider,
            llm_model,
            len(text),
            e,
        )
        raise BundledExtractionError("Chunk extraction failed while calling the language model.") from e


def verify_empty_bundled_payload(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    *,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    if get_chat_model(
        llm_provider,
        llm_model,
        max_tokens=min(settings.EXTRACTION_MAX_OUTPUT_TOKENS, 512),
    ) is None:
        raise EmptyExtractionVerificationError(
            "Empty extraction could not be verified because no live chat model was available."
        )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", EMPTY_EXTRACTION_VERIFIER_PROMPT),
            (
                "human",
                "Document title: {document_title}\n\nChunk text:\n{chunk_text}",
            ),
        ]
    )
    try:
        response = invoke_structured_output(
            prompt=prompt,
            schema=EmptyExtractionVerificationResponse,
            payload={
                "document_title": document_title,
                "chunk_text": text,
            },
            llm_provider=llm_provider,
            llm_model=llm_model,
            max_tokens=min(settings.EXTRACTION_MAX_OUTPUT_TOKENS, 512),
            operation="empty_extraction_verifier",
        )
        if response is None:
            logger.warning(
                "Empty extraction verifier returned no structured response "
                "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s).",
                document_id,
                chunk_id,
                llm_provider,
                llm_model,
                len(text),
            )
            raise EmptyExtractionVerificationError(
                "Empty extraction could not be verified because the verifier returned no structured response."
            )
        return response.model_dump()
    except EmptyExtractionVerificationError:
        raise
    except Exception as exc:
        logger.exception(
            "Error in empty extraction verifier "
            "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s): %s",
            document_id,
            chunk_id,
            llm_provider,
            llm_model,
            len(text),
            exc,
        )
        raise EmptyExtractionVerificationError(
            "Empty extraction could not be verified because the verifier failed."
        ) from exc


def run_bundled_extraction_with_verification(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    *,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    try:
        payload = extract_bundled_payload(
            text,
            document_title,
            llm_provider,
            llm_model,
            chunk_id=chunk_id,
            document_id=document_id,
        )
    except BundledExtractionNullResponseError:
        payload = _empty_payload()
    is_empty_payload = not (
        payload.get("entities")
        or payload.get("claims")
        or payload.get("relationships")
    )
    if not is_empty_payload:
        return {
            "payload": payload,
            "empty_verification_status": EMPTY_CHECK_NOT_NEEDED,
            "empty_verification_message": "",
            "retry_recommended": False,
        }

    verification = verify_empty_bundled_payload(
        text,
        document_title,
        llm_provider,
        llm_model,
        chunk_id=chunk_id,
        document_id=document_id,
    )
    if verification.get("should_retry_extraction"):
        return {
            "payload": {},
            "empty_verification_status": EMPTY_CHECK_RETRY_RECOMMENDED,
            "empty_verification_message": str(verification.get("reason") or ""),
            "retry_recommended": True,
        }

    return {
        "payload": payload,
        "empty_verification_status": EMPTY_CHECK_VERIFIED_EMPTY,
        "empty_verification_message": str(verification.get("reason") or ""),
        "retry_recommended": False,
    }

def extract_bundled_payload(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    *,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    return _llm_bundled(
        text,
        document_title,
        llm_provider,
        llm_model,
        chunk_id=chunk_id,
        document_id=document_id,
    )


def generate_document_summary(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    document_id: int | None = None,
) -> str:
    if get_chat_model(llm_provider, llm_model, max_tokens=768) is None:
        logger.warning(
            "Document summary generation skipped — no live chat model available (document_id=%s).",
            document_id,
        )
        return text[:400]
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", DOCUMENT_SUMMARY_PROMPT),
            ("human", "Document title: {document_title}\n\nDocument text:\n{text}"),
        ]
    )
    try:
        response = invoke_structured_output(
            prompt=prompt,
            schema=DocumentSummaryResponse,
            payload={"document_title": document_title, "text": text[:3000]},
            llm_provider=llm_provider,
            llm_model=llm_model,
            max_tokens=768,
            operation="document_summary",
        )
        summary = _normalize_summary_text(response.summary) if response is not None else ""
        return summary if summary else text[:400]
    except Exception:
        logger.exception("Document summary generation failed (document_id=%s).", document_id)
        return text[:400]


def _normalize_summary_text(value) -> str:
    if isinstance(value, str):
        return value.strip()
    normalized = coerce_message_text(value)
    return normalized.strip()
