from __future__ import annotations

from django.conf import settings

from apps.core.llm_catalog import (
    DEFAULT_MODEL,
    DEFAULT_PROVIDER,
    FALLBACK_EMBEDDING_MODEL,
    FALLBACK_EMBEDDING_PROVIDER,
    FIXED_EMBEDDING_MODEL,
    FIXED_EMBEDDING_PROVIDER,
    MODEL_CATALOG,
)

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
        fallback = next((model["id"] for model in provider_info["models"] if model.get("recommended")), provider_info["models"][0]["id"])
        chosen_model = fallback
    return chosen_provider, chosen_model


def normalize_embedding_provider_model(provider: str | None = None, model_name: str | None = None) -> tuple[str, str]:
    return FIXED_EMBEDDING_PROVIDER, FIXED_EMBEDDING_MODEL


def get_chat_model(provider: str | None = None, model_name: str | None = None):
    provider_key, resolved_model = normalize_provider_model(provider, model_name)
    if provider_key == "openai":
        if not settings.OPENAI_API_KEY or ChatOpenAI is None:
            return None
        return ChatOpenAI(
            model=resolved_model,
            api_key=settings.OPENAI_API_KEY,
            temperature=0,
        )
    if provider_key == "anthropic":
        if not settings.ANTHROPIC_API_KEY or ChatAnthropic is None:
            return None
        return ChatAnthropic(
            model=resolved_model,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0,
        )
    if provider_key == "google":
        if not settings.GOOGLE_API_KEY or ChatGoogleGenerativeAI is None:
            return None
        return ChatGoogleGenerativeAI(
            model=resolved_model,
            google_api_key=settings.GOOGLE_API_KEY,
            temperature=0,
        )
    return None


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
