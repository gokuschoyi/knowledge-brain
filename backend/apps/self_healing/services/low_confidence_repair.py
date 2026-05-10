from __future__ import annotations

import re

from apps.retrieval.services.confidence import calculate_confidence
from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_memory import persist_query_repair_memory
from apps.retrieval.services.reranker import rerank_results
from apps.retrieval.services.vector_search import search_chunks


def repair_low_confidence_answer(
    question: str,
    brain_id=None,
    answer: str = "",
    knowledge_gaps: list[str] | None = None,
    confidence_score: float = 0.0,
) -> dict:
    existing_gaps = knowledge_gaps or []
    expanded_queries = [question, f"{question} details", f"{question} evidence"]
    best_results: list[dict] = []
    for query in expanded_queries:
        results = rerank_results(search_chunks(query, brain_id=brain_id, limit=6))
        if not best_results:
            best_results = results
            continue
        current_score = sum(item.get("reranked_score", item.get("score", 0.0)) for item in best_results[:3])
        next_score = sum(item.get("reranked_score", item.get("score", 0.0)) for item in results[:3])
        if next_score > current_score:
            best_results = results

    graph = expand_graph(question, brain_id=brain_id)
    joined_context = "\n".join(result["chunk"].text.lower() for result in best_results[:4])
    new_gaps: list[str] = []
    if len(best_results) < 2:
        new_gaps.append("Limited grounded evidence was found for this question.")
    if not graph["entities"]:
        new_gaps.append("No strongly matching entities were found in the graph.")
    if graph["contradiction_warnings"]:
        new_gaps.append("Some relevant evidence contains contradictions that should be handled carefully.")
    precision_question = any(
        marker in question.lower()
        for marker in ("exact", "duration", "how much", "price", "cost", "when", "date", "version")
    )
    if precision_question and not re.search(r"\b\d+\b|\$\d+|v\d+(?:\.\d+)*", joined_context):
        new_gaps.append("The retrieved evidence does not contain a precise value for this question.")

    new_confidence = calculate_confidence(best_results, new_gaps)
    improved = bool(best_results) and (new_confidence >= confidence_score + 0.12 or len(new_gaps) < len(existing_gaps))

    if improved:
        memory = persist_query_repair_memory(
            question=question,
            brain_id=brain_id,
            recommended_chunk_ids=[result["chunk"].id for result in best_results],
            related_entity_ids=[entity.id for entity in graph["entities"]],
            knowledge_gaps=new_gaps,
            last_answer_confidence=new_confidence,
            status="resolved",
        )
        return {
            "status": "resolved",
            "task_status": "resolved",
            "recommended_chunk_ids": [result["chunk"].id for result in best_results],
            "related_entity_ids": [entity.id for entity in graph["entities"]],
            "confidence_before": confidence_score,
            "confidence_after": new_confidence,
            "remaining_gaps": new_gaps,
            "memory_id": memory.id if memory else None,
        }
    memory = persist_query_repair_memory(
        question=question,
        brain_id=brain_id,
        recommended_chunk_ids=[],
        related_entity_ids=[entity.id for entity in graph["entities"]],
        knowledge_gaps=new_gaps or existing_gaps,
        last_answer_confidence=confidence_score,
        status="unresolved",
    )
    return {
        "status": "unresolved",
        "task_status": "unresolved",
        "suggestion": "Upload a document that explicitly states the missing detail or a source that names the entity directly.",
        "memory_id": memory.id if memory else None,
        "answer": answer,
        "confidence_before": confidence_score,
        "confidence_after": new_confidence,
        "remaining_gaps": new_gaps or existing_gaps,
    }
