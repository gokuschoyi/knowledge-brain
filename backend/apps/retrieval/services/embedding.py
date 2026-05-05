from __future__ import annotations

from apps.agents.llm import get_embedding_model, normalize_embedding_provider_model
from apps.core.utils import deterministic_embedding


EMBEDDING_DIMENSIONS = 1536


def _truncate_or_pad(vector: list[float], dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    if len(vector) == dimensions:
        return vector
    if len(vector) > dimensions:
        return vector[:dimensions]
    return vector + [0.0] * (dimensions - len(vector))


def embed_text(
    text: str,
    provider: str | None = None,
    model_name: str | None = None,
    input_type: str = "document",
) -> tuple[list[float], dict]:
    provider_key, resolved_model = normalize_embedding_provider_model(provider, model_name)
    embeddings_model = get_embedding_model(provider_key, resolved_model)
    if embeddings_model is None:
        return deterministic_embedding(text, dimensions=EMBEDDING_DIMENSIONS), {
            "embedding_provider": "deterministic",
            "embedding_model": "deterministic-1536",
            "embedding_mode": "fallback",
        }

    try:
        if provider_key == "google":
            task_type = "retrieval_query" if input_type == "query" else "retrieval_document"
            vector = embeddings_model.embed_query(
                text,
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIMENSIONS,
            )
        else:
            if input_type == "query":
                vector = embeddings_model.embed_query(text)
            else:
                vector = embeddings_model.embed_documents([text])[0]
        return _truncate_or_pad(list(vector), EMBEDDING_DIMENSIONS), {
            "embedding_provider": provider_key,
            "embedding_model": resolved_model,
            "embedding_mode": "live",
        }
    except Exception:
        return deterministic_embedding(text, dimensions=EMBEDDING_DIMENSIONS), {
            "embedding_provider": "deterministic",
            "embedding_model": "deterministic-1536",
            "embedding_mode": "fallback",
        }
