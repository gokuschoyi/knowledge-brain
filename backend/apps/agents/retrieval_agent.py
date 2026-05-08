from __future__ import annotations

import re
from collections.abc import Iterator
from typing import Any, TypedDict

from django.db import transaction
from langgraph.graph import END, START, StateGraph

from apps.core.utils import to_json_safe
from apps.knowledge.models import ChatMessage, ChatSession
from apps.retrieval.services.answer_generator import (
    build_answer_payload,
    stream_answer_text,
    synthesize_answer_payload,
)
from apps.retrieval.services.confidence import calculate_confidence
from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_memory import get_query_repair_memory
from apps.retrieval.services.query_classifier import classify_query
from apps.retrieval.services.reranker import rerank_results
from apps.retrieval.services.vector_search import search_chunks
from apps.self_healing.models import SelfHealingTask


class RetrievalState(TypedDict, total=False):
    question: str
    session_id: int | None
    brain_id: str | None
    llm_provider: str | None
    llm_model: str | None
    intent: str
    results: list[dict[str, Any]]
    graph_context: dict[str, Any]
    repair_memory: Any
    top_chunks: list[Any]
    gaps: list[str]
    confidence: float
    answer_payload: dict[str, Any]
    persisted_session_id: int


def classify_question(state: RetrievalState) -> RetrievalState:
    return {"intent": classify_query(state["question"])}


def load_repair_memory(state: RetrievalState) -> RetrievalState:
    return {
        "repair_memory": get_query_repair_memory(
            state["question"],
            brain_id=state.get("brain_id"),
        )
    }


def retrieve_chunks(state: RetrievalState) -> RetrievalState:
    repair_memory = state.get("repair_memory")
    graph_context = state.get("graph_context", {})
    if repair_memory is not None:
        repair_memory.times_applied += 1
        repair_memory.save(update_fields=["times_applied"])
    results = rerank_results(
        search_chunks(
            state["question"],
            brain_id=state.get("brain_id"),
            preferred_chunk_ids=(
                repair_memory.recommended_chunk_ids if repair_memory else []
            ),
            related_entity_ids=list(
                dict.fromkeys(
                    [entity.id for entity in graph_context.get("entities", [])]
                    + (repair_memory.related_entity_ids if repair_memory else [])
                )
            ),
        )
    )
    # With smaller 400-token chunks, we can provide 8 chunks to the LLM (approx 3200 tokens)
    top_chunks = [result["chunk"] for result in results[:8]]
    return {"results": results, "top_chunks": top_chunks}


def expand_graph_context(state: RetrievalState) -> RetrievalState:
    return {"graph_context": expand_graph(state["question"], brain_id=state.get("brain_id"))}


def assess_gaps(state: RetrievalState) -> RetrievalState:
    gaps: list[str] = []
    top_chunks = state.get("top_chunks", [])
    question = state["question"].lower()
    joined_context = "\n".join(chunk.text.lower() for chunk in top_chunks)
    if len(top_chunks) < 2:
        gaps.append("Limited grounded evidence was found for this question.")
    if not state.get("graph_context", {}).get("entities"):
        gaps.append("No strongly matching entities were found in the graph.")
    if state.get("graph_context", {}).get("contradiction_warnings"):
        gaps.append("Some relevant evidence contains contradictions that should be handled carefully.")
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
        claims=graph_context.get("claims", []),
        contradiction_warnings=graph_context.get("contradiction_warnings", []),
        fallback_confidence=state["confidence"],
        knowledge_gaps=state["gaps"],
        llm_provider=state.get("llm_provider"),
        llm_model=state.get("llm_model"),
    )
    return {"answer_payload": payload}


def persist_retrieval_result(state: RetrievalState, answer_payload: dict[str, Any]) -> dict[str, Any]:
    state = {**state, "answer_payload": answer_payload}
    payload = to_json_safe(state["answer_payload"])
    brain_id = state.get("brain_id")

    top_chunks = state.get("top_chunks", [])
    chunks_by_id = {chunk.id: chunk for chunk in top_chunks}
    source_chunk_ids = [
        chunk_id
        for chunk_id in payload.get("source_chunk_ids", [])
        if isinstance(chunk_id, int) and chunk_id in chunks_by_id
    ]
    selected_chunks = [chunks_by_id[chunk_id] for chunk_id in source_chunk_ids]
    if not selected_chunks:
        selected_chunks = top_chunks[:3]

    session = (
        ChatSession.objects.create(title=state["question"][:80], brain_id=brain_id)
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
            for chunk in selected_chunks
        ]
    )
    message_metadata = to_json_safe(
        {
            "intent": state["intent"],
            "knowledge_gaps": payload.get("knowledge_gaps", []),
            "contradiction_warnings": state["graph_context"].get("contradiction_warnings", []),
            "repair_memory_id": getattr(state.get("repair_memory"), "id", None),
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
            brain_id=brain_id,
            payload=to_json_safe(
                {
                    "question": state["question"],
                    "answer": payload["answer"],
                    "confidence_score": payload["confidence_score"],
                    "top_chunk_ids": payload.get("source_chunk_ids", []),
                    "related_entity_ids": payload.get("related_entity_ids", []),
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
    return payload


def persist_chat_and_tasks(state: RetrievalState) -> RetrievalState:
    payload = persist_retrieval_result(state, state["answer_payload"])
    return {"answer_payload": payload, "persisted_session_id": payload["session_id"]}


def run_retrieval_state(
    question: str,
    session_id: int | None = None,
    brain_id: str | None = None,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> RetrievalState:
    state: RetrievalState = {
        "question": question,
        "session_id": session_id,
        "brain_id": brain_id,
        "llm_provider": llm_provider,
        "llm_model": llm_model,
    }
    for step in (
        classify_question,
        load_repair_memory,
        expand_graph_context,
        retrieve_chunks,
        assess_gaps,
    ):
        state.update(step(state))
    return state


def stream_question_answer(
    question: str,
    session_id: int | None = None,
    brain_id: str | None = None,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> Iterator[dict[str, Any]]:
    state = run_retrieval_state(
        question=question,
        session_id=session_id,
        brain_id=brain_id,
        llm_provider=llm_provider,
        llm_model=llm_model,
    )
    yield {
        "type": "context",
        "payload": {
            "confidence_score": state["confidence"],
            "knowledge_gaps": state["gaps"],
        },
    }

    graph_context = state["graph_context"]
    answer_parts: list[str] = []
    for token in stream_answer_text(
        question=state["question"],
        top_chunks=state.get("top_chunks", []),
        related_entities=graph_context.get("entities", []),
        relationships=graph_context.get("relationships", []),
        claims=graph_context.get("claims", []),
        contradiction_warnings=graph_context.get("contradiction_warnings", []),
        knowledge_gaps=state["gaps"],
        llm_provider=state.get("llm_provider"),
        llm_model=state.get("llm_model"),
    ):
        answer_parts.append(token)
        yield {"type": "token", "delta": token}

    payload = build_answer_payload(
        answer_text="".join(answer_parts).strip(),
        fallback_confidence=state["confidence"],
        source_chunk_ids=[chunk.id for chunk in state.get("top_chunks", [])],
        related_entity_ids=[entity.id for entity in graph_context.get("entities", [])[:6]],
        knowledge_gaps=state["gaps"],
    )
    final_payload = persist_retrieval_result(state, payload)
    yield {"type": "final", "payload": final_payload}


def build_retrieval_graph():
    builder = StateGraph(RetrievalState)
    builder.add_node("classify_question", classify_question)
    builder.add_node("load_repair_memory", load_repair_memory)
    builder.add_node("expand_graph_context", expand_graph_context)
    builder.add_node("retrieve_chunks", retrieve_chunks)
    builder.add_node("assess_gaps", assess_gaps)
    builder.add_node("synthesize_answer", synthesize_answer)
    builder.add_node("persist_chat_and_tasks", persist_chat_and_tasks)
    builder.add_edge(START, "classify_question")
    builder.add_edge("classify_question", "load_repair_memory")
    builder.add_edge("load_repair_memory", "expand_graph_context")
    builder.add_edge("expand_graph_context", "retrieve_chunks")
    builder.add_edge("retrieve_chunks", "assess_gaps")
    builder.add_edge("assess_gaps", "synthesize_answer")
    builder.add_edge("synthesize_answer", "persist_chat_and_tasks")
    builder.add_edge("persist_chat_and_tasks", END)
    return builder.compile()


RETRIEVAL_GRAPH = build_retrieval_graph()


def answer_question(
    question: str,
    session_id: int | None = None,
    brain_id: str | None = None,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> dict:
    state = RETRIEVAL_GRAPH.invoke(
        {
            "question": question,
            "session_id": session_id,
            "brain_id": brain_id,
            "llm_provider": llm_provider,
            "llm_model": llm_model,
        }
    )
    return state["answer_payload"]


__all__ = [
    "answer_question",
    "build_retrieval_graph",
    "persist_retrieval_result",
    "RETRIEVAL_GRAPH",
    "run_retrieval_state",
    "stream_question_answer",
]
