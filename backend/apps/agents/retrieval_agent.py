from __future__ import annotations

import re
from typing import Any, TypedDict

from django.db import transaction
from langgraph.graph import END, START, StateGraph

from apps.core.utils import to_json_safe
from apps.knowledge.models import ChatMessage, ChatSession
from apps.retrieval.services.answer_generator import synthesize_answer_payload
from apps.retrieval.services.confidence import calculate_confidence
from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_classifier import classify_query
from apps.retrieval.services.reranker import rerank_results
from apps.retrieval.services.vector_search import search_chunks
from apps.self_healing.models import SelfHealingTask


class RetrievalState(TypedDict, total=False):
    question: str
    session_id: int | None
    llm_provider: str | None
    llm_model: str | None
    intent: str
    results: list[dict[str, Any]]
    graph_context: dict[str, Any]
    top_chunks: list[Any]
    gaps: list[str]
    confidence: float
    answer_payload: dict[str, Any]
    persisted_session_id: int


def classify_question(state: RetrievalState) -> RetrievalState:
    return {"intent": classify_query(state["question"])}


def retrieve_chunks(state: RetrievalState) -> RetrievalState:
    results = rerank_results(search_chunks(state["question"]))
    top_chunks = [result["chunk"] for result in results[:4]]
    return {"results": results, "top_chunks": top_chunks}


def expand_graph_context(state: RetrievalState) -> RetrievalState:
    return {"graph_context": expand_graph(state["question"])}


def assess_gaps(state: RetrievalState) -> RetrievalState:
    gaps: list[str] = []
    top_chunks = state.get("top_chunks", [])
    question = state["question"].lower()
    joined_context = "\n".join(chunk.text.lower() for chunk in top_chunks)
    if len(top_chunks) < 2:
        gaps.append("Limited grounded evidence was found for this question.")
    if not state.get("graph_context", {}).get("entities"):
        gaps.append("No strongly matching entities were found in the graph.")
    uncertainty_markers = [
        "not clearly stated",
        "not clearly defined",
        "unclear",
        "not specified",
        "not provided",
    ]
    if any(marker in joined_context for marker in uncertainty_markers):
        gaps.append("The source material explicitly signals that this detail is missing or unclear.")
    precision_question = any(
        phrase in question for phrase in ["exact", "duration", "how much", "price", "cost", "when"]
    )
    if precision_question and not re.search(r"\b\d+\b|\$\d+", joined_context):
        gaps.append("The retrieved evidence does not contain a precise value for this question.")
    confidence = calculate_confidence(state.get("results", []), gaps)
    if precision_question and gaps:
        confidence = min(confidence, 0.45)
    return {"gaps": gaps, "confidence": confidence}


def synthesize_answer(state: RetrievalState) -> RetrievalState:
    graph_context = state["graph_context"]
    payload = synthesize_answer_payload(
        question=state["question"],
        top_chunks=state.get("top_chunks", []),
        related_entities=graph_context.get("entities", []),
        relationships=graph_context.get("relationships", []),
        fallback_confidence=state["confidence"],
        knowledge_gaps=state["gaps"],
        llm_provider=state.get("llm_provider"),
        llm_model=state.get("llm_model"),
    )
    return {"answer_payload": payload}


def persist_chat_and_tasks(state: RetrievalState) -> RetrievalState:
    payload = to_json_safe(state["answer_payload"])
    session = (
        ChatSession.objects.create(title=state["question"][:80])
        if not state.get("session_id")
        else ChatSession.objects.get(id=state["session_id"])
    )
    sources = to_json_safe(
        [
            {
                "document_id": chunk.document_id,
                "document_title": chunk.document.title,
                "chunk_id": chunk.id,
                "snippet": chunk.text[:240],
            }
            for chunk in state.get("top_chunks", [])
        ]
    )
    message_metadata = to_json_safe(
        {
            "intent": state["intent"],
            "knowledge_gaps": payload.get("knowledge_gaps", []),
            "llm_provider": state.get("llm_provider"),
            "llm_model": state.get("llm_model"),
        }
    )
    with transaction.atomic():
        ChatMessage.objects.create(session=session, role=ChatMessage.ROLE_USER, content=state["question"])
        ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_ASSISTANT,
            content=payload["answer"],
            confidence_score=payload["confidence_score"],
            sources=sources,
            metadata=message_metadata,
        )

    task_created = False
    if payload["confidence_score"] < 0.6 or payload.get("knowledge_gaps"):
        SelfHealingTask.objects.create(
            task_type=SelfHealingTask.TYPE_LOW_CONFIDENCE_ANSWER,
            priority=2,
            title="Low-confidence answer detected",
            description="The system found weak coverage for a user question.",
            payload=to_json_safe(
                {
                    "question": state["question"],
                    "confidence_score": payload["confidence_score"],
                    "top_chunk_ids": payload.get("source_chunk_ids", []),
                    "knowledge_gaps": payload.get("knowledge_gaps", []),
                }
            ),
        )
        task_created = True

    payload.update(
        to_json_safe(
            {
                "session_id": session.id,
                "sources": sources,
                "related_entities": [
                    {"id": entity.id, "name": entity.name, "type": entity.entity_type}
                    for entity in state["graph_context"].get("entities", [])[:6]
                ],
                "llm_provider": state.get("llm_provider"),
                "llm_model": state.get("llm_model"),
                "self_healing_task_created": task_created or payload.get("should_create_self_healing_task", False),
            }
        )
    )
    return {"answer_payload": payload, "persisted_session_id": session.id}


def build_retrieval_graph():
    builder = StateGraph(RetrievalState)
    builder.add_node("classify_question", classify_question)
    builder.add_node("retrieve_chunks", retrieve_chunks)
    builder.add_node("expand_graph_context", expand_graph_context)
    builder.add_node("assess_gaps", assess_gaps)
    builder.add_node("synthesize_answer", synthesize_answer)
    builder.add_node("persist_chat_and_tasks", persist_chat_and_tasks)
    builder.add_edge(START, "classify_question")
    builder.add_edge("classify_question", "retrieve_chunks")
    builder.add_edge("retrieve_chunks", "expand_graph_context")
    builder.add_edge("expand_graph_context", "assess_gaps")
    builder.add_edge("assess_gaps", "synthesize_answer")
    builder.add_edge("synthesize_answer", "persist_chat_and_tasks")
    builder.add_edge("persist_chat_and_tasks", END)
    return builder.compile()


RETRIEVAL_GRAPH = build_retrieval_graph()


def answer_question(
    question: str,
    session_id: int | None = None,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> dict:
    state = RETRIEVAL_GRAPH.invoke(
        {
            "question": question,
            "session_id": session_id,
            "llm_provider": llm_provider,
            "llm_model": llm_model,
        }
    )
    return state["answer_payload"]


__all__ = ["answer_question", "RETRIEVAL_GRAPH", "build_retrieval_graph"]
