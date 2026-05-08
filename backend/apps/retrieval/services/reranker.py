from __future__ import annotations


def rerank_results(results: list[dict]) -> list[dict]:
    def composite_score(item: dict) -> float:
        chunk = item["chunk"]
        document_quality = getattr(chunk.document, "quality_score", 0.0)
        base_score = float(item.get("score", 0.0))
        lexical_score = float(item.get("lexical_score", 0.0))
        vector_score = float(item.get("vector_score", base_score))
        preferred_boost = float(item.get("preferred_boost", 0.0))
        entity_boost = float(item.get("entity_boost", 0.0))
        chunk_quality = float(chunk.quality_score)
        return (
            (vector_score * 0.55)
            + (lexical_score * 0.2)
            + (base_score * 0.1)
            + (chunk_quality * 0.08)
            + (document_quality * 0.04)
            + preferred_boost
            + entity_boost
        )

    reranked = sorted(
        results,
        key=lambda item: (composite_score(item), item["chunk"].quality_score),
        reverse=True,
    )
    for item in reranked:
        item["reranked_score"] = composite_score(item)
    return reranked
