from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any

from django.conf import settings
from pydantic import BaseModel, ValidationError

from apps.core.llm_catalog import (
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    FALLBACK_EMBEDDING_MODEL,
    FALLBACK_EMBEDDING_PROVIDER,
    FIXED_EMBEDDING_MODEL,
    FIXED_EMBEDDING_PROVIDER,
    MODEL_CATALOG,
)

logger = logging.getLogger(__name__)

GOOGLE_FUNCTION_CALLING_OPERATIONS = {
    "bundled_extraction",
    "empty_extraction_verifier",
    "document_summary",
}

try:
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - protects local import before deps installed
    ChatOpenAI = None

try:
    from langchain_anthropic import ChatAnthropic
except Exception:  # pragma: no cover
    ChatAnthropic = None

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except Exception:  # pragma: no cover
    ChatGoogleGenerativeAI = None

try:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
except Exception:  # pragma: no cover
    GoogleGenerativeAIEmbeddings = None


def normalize_provider_model(provider: str | None = None, model_name: str | None = None) -> tuple[str, str]:
    chosen_provider = provider or settings.DEFAULT_LLM_PROVIDER or DEFAULT_PROVIDER
    provider_info = MODEL_CATALOG.get(chosen_provider, MODEL_CATALOG[DEFAULT_PROVIDER])
    chosen_model = model_name or settings.DEFAULT_LLM_MODEL or DEFAULT_MODEL
    supported_ids = {model["id"] for model in provider_info["models"]}
    if chosen_model not in supported_ids:
        fallback = next(
            (model["id"] for model in provider_info["models"] if model.get("recommended")),
            provider_info["models"][0]["id"],
        )
        chosen_model = fallback
    return chosen_provider, chosen_model


def normalize_embedding_provider_model(provider: str | None = None, model_name: str | None = None) -> tuple[str, str]:
    return FIXED_EMBEDDING_PROVIDER, FIXED_EMBEDDING_MODEL


def get_chat_model(provider: str | None = None, model_name: str | None = None, max_tokens: int | None = None):
    provider_key, resolved_model = normalize_provider_model(provider, model_name)
    if provider_key == "openai":
        if not settings.OPENAI_API_KEY or ChatOpenAI is None:
            return None
        kwargs = {"model": resolved_model, "api_key": settings.OPENAI_API_KEY, "temperature": 0.1}
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return ChatOpenAI(**kwargs)
    if provider_key == "anthropic":
        if not settings.ANTHROPIC_API_KEY or ChatAnthropic is None:
            return None
        kwargs = {"model": resolved_model, "api_key": settings.ANTHROPIC_API_KEY, "temperature": 0.1}
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        return ChatAnthropic(**kwargs)
    if provider_key == "google":
        if not settings.GOOGLE_API_KEY or ChatGoogleGenerativeAI is None:
            return None
        kwargs = {
            "model": resolved_model,
            "google_api_key": settings.GOOGLE_API_KEY,
            "temperature": 0.1,
            "thinking_budget": 0,
        }
        if max_tokens is not None:
            kwargs["max_output_tokens"] = max_tokens
        logger.info(
            "Initializing Google chat model (model=%s, max_output_tokens=%s, thinking_budget=%s).",
            resolved_model,
            kwargs.get("max_output_tokens"),
            kwargs.get("thinking_budget"),
        )
        return ChatGoogleGenerativeAI(**kwargs)
    return None


def _structured_output_method(provider: str, model_name: str, operation: str) -> str:
    if provider == "openai":
        return "json_schema"
    if provider == "google":
        if operation in GOOGLE_FUNCTION_CALLING_OPERATIONS:
            return "function_calling"
        return "json_schema"
    if provider == "anthropic":
        if (
            model_name.startswith("claude-3-7")
            or model_name.startswith("claude-sonnet-4")
            or model_name.startswith("claude-opus-4")
        ):
            return "json_schema"
        return "function_calling"
    return "json_schema"


def coerce_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, Mapping):
                for key in ("text", "output_text"):
                    value = item.get(key)
                    if isinstance(value, str):
                        parts.append(value)
                json_value = item.get("json")
                if json_value is not None:
                    try:
                        parts.append(json.dumps(json_value))
                    except TypeError:
                        pass
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts).strip()
    return ""


def _extract_json_substring(text: str) -> str | None:
    stripped = text.strip()
    if not stripped:
        return None
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    decoder = json.JSONDecoder()
    for marker in ("{", "["):
        start = stripped.find(marker)
        if start < 0:
            continue
        try:
            _, end = decoder.raw_decode(stripped[start:])
            return stripped[start : start + end]
        except json.JSONDecodeError:
            continue
    return None


def _extract_tool_payload(raw_message: Any) -> Any | None:
    tool_calls = getattr(raw_message, "tool_calls", None)
    if isinstance(tool_calls, list):
        for call in tool_calls:
            if isinstance(call, Mapping):
                args = call.get("args")
                if args is not None:
                    return args
                function_payload = call.get("function")
                if isinstance(function_payload, Mapping) and function_payload.get("arguments") is not None:
                    return function_payload["arguments"]
    additional_kwargs = getattr(raw_message, "additional_kwargs", None)
    if isinstance(additional_kwargs, Mapping):
        raw_tool_calls = additional_kwargs.get("tool_calls")
        if isinstance(raw_tool_calls, list):
            for call in raw_tool_calls:
                if not isinstance(call, Mapping):
                    continue
                function_payload = call.get("function")
                if isinstance(function_payload, Mapping) and function_payload.get("arguments") is not None:
                    return function_payload["arguments"]
    return None


def _decode_json_payload(candidate: Any) -> Any | None:
    if candidate is None:
        return None
    if isinstance(candidate, Mapping):
        return dict(candidate)
    if isinstance(candidate, list):
        return candidate
    if isinstance(candidate, str):
        json_blob = _extract_json_substring(candidate)
        if json_blob is None:
            return None
        try:
            return json.loads(json_blob)
        except json.JSONDecodeError:
            return None
    return None


def _validate_structured_payload(schema: type[BaseModel], payload: Any) -> BaseModel | None:
    if payload is None:
        return None
    if isinstance(payload, schema):
        return payload
    try:
        return schema.model_validate(payload)
    except ValidationError:
        return None


def invoke_structured_output(
    *,
    prompt,
    schema: type[BaseModel],
    payload: dict[str, Any],
    llm_provider: str | None = None,
    llm_model: str | None = None,
    max_tokens: int | None = None,
    operation: str = "structured_output",
    tools: list[Any] | None = None,
) -> BaseModel | None:
    provider_key, resolved_model = normalize_provider_model(llm_provider, llm_model)
    effective_max_tokens = max_tokens
    if provider_key == "google" and operation == "bundled_extraction":
        effective_max_tokens = None
    model = get_chat_model(provider_key, resolved_model, max_tokens=effective_max_tokens)
    if model is None:
        return None

    method = _structured_output_method(provider_key, resolved_model, operation)
    kwargs: dict[str, Any] = {
        "include_raw": True,
        "method": method,
    }
    if tools:
        kwargs["tools"] = tools

    try:
        chain = prompt | model.with_structured_output(schema, **kwargs)
        result = chain.invoke(payload)
    except Exception:
        logger.exception(
            "Structured output invocation failed (operation=%s, provider=%s, model=%s, method=%s).",
            operation,
            provider_key,
            resolved_model,
            method,
        )
        raise

    raw_message = None
    parsing_error = None
    parsed_payload: Any = result
    if isinstance(result, Mapping) and ("parsed" in result or "raw" in result):
        parsed_payload = result.get("parsed")
        raw_message = result.get("raw")
        parsing_error = result.get("parsing_error")

    validated = _validate_structured_payload(schema, parsed_payload)
    if validated is not None:
        if provider_key == "google":
            logger.info(
                "Structured output parsed natively (operation=%s, provider=%s, model=%s, method=%s, max_tokens=%s, counts=%s).",
                operation,
                provider_key,
                resolved_model,
                method,
                effective_max_tokens,
                _structured_payload_counts(validated),
            )
        return validated

    fallback_candidates = [
        _extract_tool_payload(raw_message),
        getattr(raw_message, "content", None),
        raw_message,
    ]
    for candidate in fallback_candidates:
        decoded = _decode_json_payload(candidate)
        validated = _validate_structured_payload(schema, decoded)
        if validated is not None:
            logger.warning(
                "Structured output recovered from raw response (operation=%s, provider=%s, model=%s, method=%s, parse_error=%s, counts=%s).",
                operation,
                provider_key,
                resolved_model,
                method,
                parsing_error,
                _structured_payload_counts(validated),
            )
            return validated

        if candidate is getattr(raw_message, "content", None):
            decoded = _decode_json_payload(coerce_message_text(candidate))
            validated = _validate_structured_payload(schema, decoded)
            if validated is not None:
                logger.warning(
                    "Structured output recovered from message content (operation=%s, provider=%s, model=%s, method=%s, parse_error=%s, counts=%s).",
                    operation,
                    provider_key,
                    resolved_model,
                    method,
                    parsing_error,
                    _structured_payload_counts(validated),
                )
                return validated

    logger.warning(
        "Structured output could not be validated (operation=%s, provider=%s, model=%s, method=%s, parse_error=%s, raw_type=%s, max_tokens=%s).",
        operation,
        provider_key,
        resolved_model,
        method,
        parsing_error,
        type(raw_message).__name__ if raw_message is not None else "None",
        effective_max_tokens,
    )
    return None


def _structured_payload_counts(payload: BaseModel) -> dict[str, int]:
    counts: dict[str, int] = {}
    for field_name in ("entities", "claims", "relationships"):
        value = getattr(payload, field_name, None)
        if isinstance(value, list):
            counts[field_name] = len(value)
    return counts


def get_embedding_model(provider: str | None = None, model_name: str | None = None):
    provider_key, resolved_model = normalize_embedding_provider_model(provider, model_name)
    if provider_key == "google":
        if not settings.GOOGLE_API_KEY or GoogleGenerativeAIEmbeddings is None:
            return None
        google_model = resolved_model if resolved_model.startswith("models/") else f"models/{resolved_model}"
        return GoogleGenerativeAIEmbeddings(
            model=google_model,
            google_api_key=settings.GOOGLE_API_KEY,
            task_type="retrieval_document",
        )
    if provider_key == "deterministic":
        return None
    return None


def supports_live_llm(provider: str | None = None, model_name: str | None = None) -> bool:
    return get_chat_model(provider, model_name) is not None


def get_default_provider_model() -> tuple[str, str]:
    return normalize_provider_model()


def get_available_provider_catalog() -> dict:
    return MODEL_CATALOG


def get_available_embedding_catalog() -> dict:
    return {
        "active_provider": FIXED_EMBEDDING_PROVIDER,
        "active_model": FIXED_EMBEDDING_MODEL,
        "fallback_provider": FALLBACK_EMBEDDING_PROVIDER,
        "fallback_model": FALLBACK_EMBEDDING_MODEL,
        "notes": "Retrieval embeddings are fixed to Gemini to keep the vector space consistent across documents and queries.",
    }


def get_default_embedding_provider_model() -> tuple[str, str]:
    return FIXED_EMBEDDING_PROVIDER, FIXED_EMBEDDING_MODEL
