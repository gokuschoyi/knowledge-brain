from __future__ import annotations

from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.vector_search import search_chunks


def repair_low_confidence_answer(question: str) -> dict:
    expanded_queries = [question, f"{question} details", f"{question} evidence"]
    best_results = []
    for query in expanded_queries:
        results = search_chunks(query, limit=5)
        if len(results) > len(best_results):
            best_results = results
    graph = expand_graph(question)
    if best_results:
        return {
            "status": "improved",
            "recommended_chunk_ids": [result["chunk"].id for result in best_results],
            "related_entity_ids": [entity.id for entity in graph["entities"]],
        }
    return {
        "status": "unresolved",
        "suggestion": "Upload a document that explicitly states the missing detail or a source that names the entity directly.",
    }

