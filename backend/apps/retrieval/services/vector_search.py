from __future__ import annotations

import re

from apps.core.utils import cosine_similarity
from apps.documents.models import Chunk
from apps.retrieval.services.embedding import embed_text


def _keyword_score(question: str, chunk_text: str) -> float:
    question_terms = {term for term in re.findall(r"[a-z0-9]+", question.lower()) if len(term) > 2}
    chunk_terms = set(re.findall(r"[a-z0-9]+", chunk_text.lower()))
    if not question_terms:
        return 0.0
    return len(question_terms & chunk_terms) / len(question_terms)


def search_chunks(
    question: str,
    brain_id: str | None = None,
    limit: int = 15,
    preferred_chunk_ids: list[int] | None = None,
    related_entity_ids: list[int] | None = None,
) -> list[dict]:
    query_embedding, embedding_metadata = embed_text(question, input_type="query")
    embedding_provider = embedding_metadata["embedding_provider"]
    embedding_model = embedding_metadata["embedding_model"]
    scored = []
    preferred_chunk_id_set = set(preferred_chunk_ids or [])
    related_entity_id_set = set(related_entity_ids or [])

    queryset = Chunk.objects.select_related("document")
    if brain_id:
        queryset = queryset.filter(document__brain_id=brain_id)

    for chunk in queryset.all():
        if chunk.embedding is None:
            continue
        chunk_provider = chunk.metadata.get("embedding_provider")
        chunk_model = chunk.metadata.get("embedding_model")
        if chunk_provider != embedding_provider or chunk_model != embedding_model:
            continue
        similarity = cosine_similarity(query_embedding, chunk.embedding)
        lexical_score = _keyword_score(question, chunk.text)
        preferred_boost = 0.18 if chunk.id in preferred_chunk_id_set else 0.0
        related_entity_boost = (
            0.08
            if related_entity_id_set.intersection(chunk.entity_mentions.values_list("entity_id", flat=True))
            else 0.0
        )
        scored.append(
            {
                "chunk": chunk,
                "score": similarity,
                "vector_score": similarity,
                "lexical_score": lexical_score,
                "preferred_boost": preferred_boost,
                "entity_boost": related_entity_boost,
                "document_authority": chunk.document.source_authority,
                "document_published_at": chunk.document.source_published_at,
            }
        )
    if not scored:
        fallback_queryset = Chunk.objects.select_related("document")
        if brain_id:
            fallback_queryset = fallback_queryset.filter(document__brain_id=brain_id)
        for chunk in fallback_queryset:
            lexical_score = _keyword_score(question, chunk.text)
            if lexical_score <= 0:
                continue
            preferred_boost = 0.18 if chunk.id in preferred_chunk_id_set else 0.0
            related_entity_boost = (
                0.08
                if related_entity_id_set.intersection(chunk.entity_mentions.values_list("entity_id", flat=True))
                else 0.0
            )
            scored.append(
                {
                    "chunk": chunk,
                    "score": lexical_score,
                    "vector_score": 0.0,
                    "lexical_score": lexical_score,
                    "preferred_boost": preferred_boost,
                    "entity_boost": related_entity_boost,
                    "document_authority": chunk.document.source_authority,
                    "document_published_at": chunk.document.source_published_at,
                }
            )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:limit]
