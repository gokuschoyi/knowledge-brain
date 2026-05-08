from __future__ import annotations

from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_memory import persist_query_repair_memory
from apps.retrieval.services.vector_search import search_chunks


def repair_low_confidence_answer(
    question: str,
    brain_id=None,
    answer: str = "",
    knowledge_gaps: list[str] | None = None,
    confidence_score: float = 0.0,
) -> dict:
    expanded_queries = [question, f"{question} details", f"{question} evidence"]
    best_results = []
    for query in expanded_queries:
        results = search_chunks(query, brain_id=brain_id, limit=5)
        if len(results) > len(best_results):
            best_results = results
    graph = expand_graph(question, brain_id=brain_id)
    if best_results:
        memory = persist_query_repair_memory(
            question=question,
            brain_id=brain_id,
            recommended_chunk_ids=[result["chunk"].id for result in best_results],
            related_entity_ids=[entity.id for entity in graph["entities"]],
            knowledge_gaps=knowledge_gaps or [],
            last_answer_confidence=confidence_score,
            status="improved",
        )
        return {
            "status": "improved",
            "recommended_chunk_ids": [result["chunk"].id for result in best_results],
            "related_entity_ids": [entity.id for entity in graph["entities"]],
            "memory_id": memory.id if memory else None,
        }
    memory = persist_query_repair_memory(
        question=question,
        brain_id=brain_id,
        recommended_chunk_ids=[],
        related_entity_ids=[],
        knowledge_gaps=knowledge_gaps or [],
        last_answer_confidence=confidence_score,
        status="unresolved",
    )
    return {
        "status": "unresolved",
        "suggestion": "Upload a document that explicitly states the missing detail or a source that names the entity directly.",
        "memory_id": memory.id if memory else None,
        "answer": answer,
    }
