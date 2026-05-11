from __future__ import annotations

from django.utils import timezone

AUTHORITY_BOOST = {
    "primary": 0.07,
    "secondary": 0.04,
    "user_provided": 0.02,
    "unknown": 0.0,
}

# content_type → intent → boost applied when chunk type matches query intent
_CONTENT_TYPE_INTENT_BOOST: dict[str, dict[str, float]] = {
    "definition": {"definition": 0.12},
    "data_statistics": {"precision": 0.10},
    "procedure": {"precision": 0.06},
    "example": {"definition": 0.04, "general": 0.03},
    "argument": {"general": 0.04},
}


def rerank_results(results: list[dict], intent: str | None = None) -> list[dict]:
    def composite_score(item: dict) -> float:
        chunk = item["chunk"]
        document_quality = getattr(chunk.document, "quality_score", 0.0)
        base_score = float(item.get("score", 0.0))
        lexical_score = float(item.get("lexical_score", 0.0))
        vector_score = float(item.get("vector_score", base_score))
        preferred_boost = float(item.get("preferred_boost", 0.0))
        entity_boost = float(item.get("entity_boost", 0.0))
        chunk_quality = float(chunk.quality_score)
        authority_boost = AUTHORITY_BOOST.get(
            item.get("document_authority") or getattr(chunk.document, "source_authority", "unknown"),
            0.0,
        )
        freshness_boost = 0.0
        published_at = item.get("document_published_at") or getattr(
            chunk.document,
            "source_published_at",
            None,
        )
        if published_at is not None:
            age_days = max(0, (timezone.now() - published_at).days)
            freshness_boost = max(0.0, 0.05 - min(0.05, age_days / 3650))

        # Boost chunks whose content_type matches the query intent
        content_type_boost = 0.0
        chunk_content_type = getattr(chunk, "content_type", None)
        if intent and chunk_content_type:
            content_type_boost = _CONTENT_TYPE_INTENT_BOOST.get(chunk_content_type, {}).get(intent, 0.0)

        # Penalise hedged language for precision queries
        certainty_penalty = 0.0
        if intent == "precision":
            certainty_level = getattr(chunk, "certainty_level", None)
            if certainty_level is not None:
                certainty_penalty = (1.0 - float(certainty_level)) * 0.08

        return (
            (vector_score * 0.55)
            + (lexical_score * 0.2)
            + (base_score * 0.1)
            + (chunk_quality * 0.08)
            + (document_quality * 0.04)
            + authority_boost
            + freshness_boost
            + preferred_boost
            + entity_boost
            + content_type_boost
            - certainty_penalty
        )

    reranked = sorted(
        results,
        key=lambda item: (composite_score(item), item["chunk"].quality_score),
        reverse=True,
    )
    for item in reranked:
        item["reranked_score"] = composite_score(item)
    return reranked
