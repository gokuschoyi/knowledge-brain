from __future__ import annotations

from apps.core.utils import normalise_query_text
from apps.retrieval.models import QueryRepairMemory


def persist_query_repair_memory(
    *,
    question: str,
    brain_id=None,
    recommended_chunk_ids: list[int] | None = None,
    related_entity_ids: list[int] | None = None,
    knowledge_gaps: list[str] | None = None,
    last_answer_confidence: float = 0.0,
    status: str = "improved",
) -> QueryRepairMemory | None:
    normalized_question = normalise_query_text(question)
    if not normalized_question:
        return None

    memory, created = QueryRepairMemory.objects.get_or_create(
        brain_id=brain_id,
        normalized_question=normalized_question,
        defaults={
            "question_examples": [question],
            "recommended_chunk_ids": recommended_chunk_ids or [],
            "related_entity_ids": related_entity_ids or [],
            "knowledge_gaps": knowledge_gaps or [],
            "last_answer_confidence": last_answer_confidence,
            "status": status,
        },
    )
    if created:
        return memory

    examples = list(memory.question_examples)
    if question not in examples:
        examples.append(question)
    memory.question_examples = examples[-5:]
    memory.recommended_chunk_ids = list(dict.fromkeys(recommended_chunk_ids or memory.recommended_chunk_ids))
    memory.related_entity_ids = list(dict.fromkeys(related_entity_ids or memory.related_entity_ids))
    memory.knowledge_gaps = knowledge_gaps or memory.knowledge_gaps
    memory.last_answer_confidence = last_answer_confidence
    memory.status = status
    memory.save(
        update_fields=[
            "question_examples",
            "recommended_chunk_ids",
            "related_entity_ids",
            "knowledge_gaps",
            "last_answer_confidence",
            "status",
            "last_repaired_at",
        ]
    )
    return memory


def get_query_repair_memory(question: str, brain_id=None) -> QueryRepairMemory | None:
    normalized_question = normalise_query_text(question)
    if not normalized_question:
        return None
    return (
        QueryRepairMemory.objects.filter(brain_id=brain_id, normalized_question=normalized_question)
        .order_by("-last_repaired_at")
        .first()
    )
