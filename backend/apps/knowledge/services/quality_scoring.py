from __future__ import annotations

from apps.documents.models import Chunk, Document


def score_chunk_quality(chunk: Chunk) -> float:
    score = 0.2
    if 500 <= chunk.token_count <= 1300:
        score += 0.3
    if chunk.summary:
        score += 0.2
    if chunk.embedding is not None:
        score += 0.2
    if len(chunk.text.strip()) > 80:
        score += 0.1
    return round(min(score, 1.0), 2)


def score_document_quality(document: Document) -> float:
    chunks = list(document.chunks.all())
    if not chunks:
        return 0
    avg_chunk_quality = sum(chunk.quality_score for chunk in chunks) / len(chunks)
    entity_count = sum(chunk.entity_mentions.count() for chunk in chunks)
    relationship_count = sum(chunk.relationships.count() for chunk in chunks)
    score = avg_chunk_quality
    score += min(0.2, entity_count / max(1, len(chunks)) * 0.03)
    score += min(0.1, relationship_count / max(1, len(chunks)) * 0.03)
    return round(min(score, 1.0), 2)
