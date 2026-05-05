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


def search_chunks(question: str, brain_id: str | None = None, limit: int = 15) -> list[dict]:
    query_embedding, embedding_metadata = embed_text(question, input_type="query")
    embedding_provider = embedding_metadata["embedding_provider"]
    embedding_model = embedding_metadata["embedding_model"]
    scored = []
    
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
        scored.append(
            {
                "chunk": chunk,
                "score": similarity,
            }
        )
    if not scored:
        for chunk in Chunk.objects.select_related("document").all():
            lexical_score = _keyword_score(question, chunk.text)
            if lexical_score <= 0:
                continue
            scored.append({"chunk": chunk, "score": lexical_score})
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:limit]
