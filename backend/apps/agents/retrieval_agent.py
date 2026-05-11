from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any, TypedDict

from django.db import transaction
from langgraph.graph import END, START, StateGraph

from apps.core.utils import to_json_safe
from apps.documents.models import DocumentWord
from apps.knowledge.models import ChatMessage, ChatSession, EvidenceSpan
from apps.retrieval.services.answer_generator import (
    stream_answer_text,
    synthesize_answer_payload,
)
from apps.retrieval.services.confidence import calculate_confidence
from apps.retrieval.services.graph_search import expand_graph
from apps.retrieval.services.query_memory import get_query_repair_memory
from apps.retrieval.services.query_classifier import classify_query
from apps.retrieval.services.reranker import rerank_results
from apps.retrieval.services.session_context import (
    build_contextual_question,
    build_session_context,
    refresh_session_summary,
)
from apps.retrieval.services.vector_search import search_chunks
from apps.self_healing.models import SelfHealingTask


class RetrievalState(TypedDict, total=False):
    question: str
    session_id: int | None
    brain_id: str | None
    llm_provider: str | None
    llm_model: str | None
    session_context: dict[str, Any]
    contextual_question: str
    intent: str
    results: list[dict[str, Any]]
    graph_context: dict[str, Any]
    repair_memory: Any
    top_chunks: list[Any]
    gaps: list[str]
    confidence: float
    answer_payload: dict[str, Any]
    persisted_session_id: int


STOPWORDS = {
    "about",
    "after",
    "again",
    "also",
    "because",
    "being",
    "between",
    "could",
    "does",
    "from",
    "have",
    "into",
    "more",
    "only",
    "other",
    "over",
    "same",
    "such",
    "than",
    "that",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "through",
    "under",
    "very",
    "what",
    "when",
    "where",
    "which",
    "with",
    "would",
}


def _build_support_summary(
    confidence_score: float,
    intent: str,
    knowledge_gaps: list[str],
    contradiction_warnings: list[str],
    citation_coverage_status: str = "needs_verification",
) -> str:
    if citation_coverage_status == "needs_verification":
        return "Citation coverage is limited, so this answer should be verified against the cited evidence."
    if citation_coverage_status == "partially_supported":
        return "The answer is grounded, but some parts have limited direct citation coverage."
    if contradiction_warnings:
        return "Supported by evidence, but contradictory material was also found and should be reviewed."
    if confidence_score >= 0.8 and not knowledge_gaps:
        if intent == "precision":
            return "Strong support from precise grounded evidence."
        if intent == "definition":
            return "Strong support from matching definitions and related evidence."
        return "Strong support from multiple grounded pieces of evidence."
    if confidence_score >= 0.6:
        return "Moderate support is available, but some gaps or ambiguity remain."
    return "Support is limited and this answer should be verified against the cited evidence."


def _file_extension_for_document(document) -> str | None:
    if not document.raw_file:
        return None
    return Path(document.raw_file.name).suffix.lstrip(".").lower()


def _resolve_quote_offsets(chunk, quote_text: str) -> tuple[int, int, str]:
    chunk_text = chunk.text
    normalized_quote = (quote_text or "").strip()
    if normalized_quote:
        exact_index = chunk_text.find(normalized_quote)
        if exact_index != -1:
            return exact_index, exact_index + len(normalized_quote), normalized_quote

        lowered_index = chunk_text.lower().find(normalized_quote.lower())
        if lowered_index != -1:
            matched_text = chunk_text[lowered_index : lowered_index + len(normalized_quote)]
            return lowered_index, lowered_index + len(matched_text), matched_text

    fallback_text = chunk_text[:240] if len(chunk_text) <= 240 else f"{chunk_text[:237]}..."
    fallback_index = 0
    return fallback_index, min(len(chunk_text), len(fallback_text.rstrip("."))), chunk_text[: min(len(chunk_text), 240)]


def _normalize_for_match(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def _resolve_exact_quote_offsets(chunk, quote_text: str) -> tuple[int, int, str] | None:
    chunk_text = chunk.text or ""
    normalized_quote = (quote_text or "").strip()
    if not normalized_quote:
        return None

    exact_index = chunk_text.find(normalized_quote)
    if exact_index != -1:
        return exact_index, exact_index + len(normalized_quote), normalized_quote

    lowered_index = chunk_text.lower().find(normalized_quote.lower())
    if lowered_index != -1:
        matched_text = chunk_text[lowered_index : lowered_index + len(normalized_quote)]
        return lowered_index, lowered_index + len(matched_text), matched_text

    normalized_chunk = _normalize_for_match(chunk_text)
    normalized_target = _normalize_for_match(normalized_quote)
    if not normalized_target or normalized_target not in normalized_chunk:
        return None

    compact_chunk = re.sub(r"\s+", "", chunk_text.lower())
    compact_target = re.sub(r"\s+", "", normalized_quote.lower())
    compact_index = compact_chunk.find(compact_target)
    if compact_index == -1:
        return None

    char_positions: list[int] = []
    for index, char in enumerate(chunk_text):
        if not char.isspace():
            char_positions.append(index)
    if compact_index >= len(char_positions):
        return None
    start_index = char_positions[compact_index]
    end_compact = compact_index + len(compact_target) - 1
    if end_compact >= len(char_positions):
        return None
    end_index = char_positions[end_compact] + 1
    matched_text = chunk_text[start_index:end_index]
    if _normalize_for_match(matched_text) != normalized_target:
        return None
    return start_index, end_index, matched_text


def _tokenize_for_overlap(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]{4,}", text.lower()) if token not in STOPWORDS}


def _label_for_locator(source: dict[str, Any]) -> str | None:
    page_number = source.get("page_number")
    if isinstance(page_number, int):
        return f"Page {page_number}"

    locator_payload = source.get("locator_payload")
    if isinstance(locator_payload, dict):
        section_heading = locator_payload.get("section_heading")
        if isinstance(section_heading, str) and section_heading.strip():
            return section_heading.strip()
        slide_number = locator_payload.get("slide_number")
        if isinstance(slide_number, int):
            return f"Slide {slide_number}"
        sheet_name = locator_payload.get("sheet_name")
        row_start = locator_payload.get("row_start")
        row_end = locator_payload.get("row_end")
        if isinstance(sheet_name, str) and isinstance(row_start, int):
            row_label = (
                f"Rows {row_start}-{row_end}"
                if isinstance(row_end, int) and row_end != row_start
                else f"Row {row_start}"
            )
            return f"{sheet_name} {row_label}"
    return None


def _score_section_against_source(section_text: str, source: dict[str, Any]) -> int:
    section_tokens = _tokenize_for_overlap(section_text)
    if not section_tokens:
        return 0
    source_tokens = _tokenize_for_overlap(f"{source.get('quote_text', '')} {source.get('document_title', '')}")
    return len(section_tokens & source_tokens)


def _derive_answer_sections(answer_text: str, sources: list[dict[str, Any]]) -> list[dict[str, Any]]:
    raw_sections = [section.strip() for section in re.split(r"\n\s*\n", answer_text) if section.strip()]
    sections: list[dict[str, Any]] = []
    for section in raw_sections:
        ranked_sources = sorted(
            enumerate(sources),
            key=lambda item: (_score_section_against_source(section, item[1]), -item[0]),
            reverse=True,
        )
        citation_numbers = [
            index + 1 for index, _source in ranked_sources if _score_section_against_source(section, _source) > 0
        ][:2]
        if not citation_numbers and sources:
            citation_numbers = [1]
        sections.append({"content": section, "citation_numbers": citation_numbers})
    return sections


def _sections_from_payload(
    raw_sections: list[Any],
    validated_citations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not isinstance(raw_sections, list):
        return []

    source_numbers_by_chunk_id: dict[int, list[int]] = {}
    for index, citation in enumerate(validated_citations, start=1):
        chunk_id = citation.get("chunk_id")
        if isinstance(chunk_id, int):
            source_numbers_by_chunk_id.setdefault(chunk_id, []).append(index)

    sections: list[dict[str, Any]] = []
    for raw_section in raw_sections:
        if not isinstance(raw_section, dict):
            continue
        content = raw_section.get("content")
        chunk_ids = raw_section.get("chunk_ids")
        if not isinstance(content, str) or not content.strip() or not isinstance(chunk_ids, list):
            continue
        citation_numbers: list[int] = []
        for chunk_id in chunk_ids:
            if isinstance(chunk_id, int):
                citation_numbers.extend(source_numbers_by_chunk_id.get(chunk_id, []))
        citation_numbers = list(dict.fromkeys(citation_numbers))[:2]
        sections.append({"content": content.strip(), "citation_numbers": citation_numbers})
    return sections


def _coverage_status_from_sections(sections: list[dict[str, Any]], valid_citation_count: int) -> str:
    if valid_citation_count <= 0:
        return "needs_verification"
    substantive_sections = [section for section in sections if not section["content"].lstrip().startswith("#")]
    if not substantive_sections:
        return "well_supported"
    covered_sections = [section for section in substantive_sections if section.get("citation_numbers")]
    if len(covered_sections) == len(substantive_sections):
        return "well_supported"
    if covered_sections:
        return "partially_supported"
    return "needs_verification"


def _validate_citations(
    raw_citations: list[Any],
    chunks_by_id: dict[int, Any],
) -> tuple[list[dict[str, Any]], int]:
    validated: list[dict[str, Any]] = []
    seen_pairs: set[tuple[int, str]] = set()
    rejected_count = 0

    for citation in raw_citations:
        if not isinstance(citation, dict):
            rejected_count += 1
            continue
        chunk_id = citation.get("chunk_id")
        if not isinstance(chunk_id, int):
            rejected_count += 1
            continue
        chunk = chunks_by_id.get(chunk_id)
        if chunk is None:
            rejected_count += 1
            continue
        resolved = _resolve_exact_quote_offsets(chunk, str(citation.get("quote_text") or ""))
        if resolved is None:
            rejected_count += 1
            continue
        quote_start, quote_end, quote_text = resolved
        dedupe_key = (chunk_id, _normalize_for_match(quote_text))
        if dedupe_key in seen_pairs:
            rejected_count += 1
            continue
        seen_pairs.add(dedupe_key)
        validated.append(
            {
                "chunk_id": chunk_id,
                "quote_text": quote_text,
                "quote_start": quote_start,
                "quote_end": quote_end,
            }
        )
    return validated, rejected_count


def _build_evidence_locator(chunk, span_start_char: int, span_end_char: int) -> tuple[str, dict[str, Any]]:
    document = chunk.document
    meta = chunk.metadata or {}
    file_extension = _file_extension_for_document(document)
    locator_payload: dict[str, Any] = {
        "start_char": span_start_char,
        "end_char": span_end_char,
    }

    if file_extension == "pdf":
        words = list(
            DocumentWord.objects.filter(
                document_id=document.id,
                end_char__gt=span_start_char,
                start_char__lt=span_end_char,
            ).order_by("page_number", "reading_order", "id")
        )
        if words:
            locator_payload.update(
                {
                    "page_number": words[0].page_number,
                    "word_start_index": words[0].reading_order,
                    "word_end_index": words[-1].reading_order,
                    "bboxes": [word.bbox for word in words],
                    "extraction_source": words[0].extraction_source,
                }
            )
        elif meta.get("page_number") is not None:
            locator_payload["page_number"] = meta.get("page_number")
        return EvidenceSpan.LOCATOR_PDF_PAGE_BBOX, locator_payload

    if file_extension == "docx":
        if meta.get("paragraph_start_index") is not None:
            locator_payload["paragraph_start_index"] = meta.get("paragraph_start_index")
            locator_payload["paragraph_end_index"] = meta.get("paragraph_end_index")
        return EvidenceSpan.LOCATOR_DOCX_PARAGRAPH_RANGE, locator_payload

    if file_extension == "pptx":
        if meta.get("slide_number") is not None:
            locator_payload["slide_number"] = meta.get("slide_number")
        if meta.get("shape_index") is not None:
            locator_payload["shape_index"] = meta.get("shape_index")
        return EvidenceSpan.LOCATOR_PPTX_SLIDE_TEXT_RANGE, locator_payload

    if file_extension in {"csv", "xlsx"}:
        for key in ("sheet_name", "row_start", "row_end", "column_start", "column_end"):
            if meta.get(key) is not None:
                locator_payload[key] = meta.get(key)
        return EvidenceSpan.LOCATOR_SHEET_CELL_RANGE, locator_payload

    if document.source_type == document.SOURCE_URL:
        return EvidenceSpan.LOCATOR_HTML_DOM_TEXT_RANGE, locator_payload

    if meta.get("section_heading") is not None:
        locator_payload["section_heading"] = meta.get("section_heading")
    return EvidenceSpan.LOCATOR_TEXT_CHAR_RANGE, locator_payload


def _build_source_from_evidence(evidence_span: EvidenceSpan) -> dict[str, Any]:
    document = evidence_span.document
    locator_payload = evidence_span.locator_payload or {}
    file_extension = _file_extension_for_document(document)
    return {
        "evidence_span_id": evidence_span.id,
        "document_id": document.id,
        "document_title": document.title,
        "quote_text": evidence_span.quote_text,
        "file_extension": file_extension,
        "page_number": locator_payload.get("page_number"),
        "review_status": evidence_span.review_status,
        "location_label": _label_for_locator(
            {
                "page_number": locator_payload.get("page_number"),
                "locator_payload": locator_payload,
            }
        ),
    }


def load_session_context(state: RetrievalState) -> RetrievalState:
    session_context = build_session_context(state.get("session_id"))
    return {
        "session_context": session_context,
        "contextual_question": build_contextual_question(
            state["question"],
            session_context,
        ),
    }


def classify_question(state: RetrievalState) -> RetrievalState:
    return {"intent": classify_query(state["contextual_question"])}


def load_repair_memory(state: RetrievalState) -> RetrievalState:
    return {
        "repair_memory": get_query_repair_memory(
            state["contextual_question"],
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
            state["contextual_question"],
            brain_id=state.get("brain_id"),
            preferred_chunk_ids=(repair_memory.recommended_chunk_ids if repair_memory else []),
            related_entity_ids=list(
                dict.fromkeys(
                    [entity.id for entity in graph_context.get("entities", [])]
                    + (repair_memory.related_entity_ids if repair_memory else [])
                )
            ),
        ),
        intent=state.get("intent"),
    )
    # With smaller 400-token chunks, we can provide 8 chunks to the LLM (approx 3200 tokens)
    top_chunks = [result["chunk"] for result in results[:8]]
    return {"results": results, "top_chunks": top_chunks}


def expand_graph_context(state: RetrievalState) -> RetrievalState:
    return {
        "graph_context": expand_graph(
            state["contextual_question"],
            brain_id=state.get("brain_id"),
        )
    }


def assess_gaps(state: RetrievalState) -> RetrievalState:
    gaps: list[str] = []
    top_chunks = state.get("top_chunks", [])
    question = state["contextual_question"].lower()
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
        session_context=str(state.get("session_context", {}).get("summary", "")),
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
    raw_citations = payload.get("grounded_citations", [])
    validated_citations, rejected_citation_count = _validate_citations(raw_citations, chunks_by_id)
    answer_text = str(payload.get("answer_markdown") or payload.get("answer") or "")

    session = (
        ChatSession.objects.create(title=state["question"][:80], brain_id=brain_id)
        if not state.get("session_id")
        else ChatSession.objects.get(id=state["session_id"])
    )
    coverage_placeholder = "needs_verification"
    message_metadata = to_json_safe(
        {
            "intent": state["intent"],
            "knowledge_gaps": payload.get("knowledge_gaps", []),
            "contradiction_warnings": state["graph_context"].get("contradiction_warnings", []),
            "related_entities": [
                {"id": entity.id, "name": entity.name, "type": entity.entity_type}
                for entity in state["graph_context"].get("entities", [])[:6]
            ],
            "citation_coverage_status": coverage_placeholder,
            "valid_citation_count": 0,
            "rejected_citation_count": rejected_citation_count,
            "answer_sections": [],
        }
    )
    with transaction.atomic():
        ChatMessage.objects.create(session=session, role=ChatMessage.ROLE_USER, content=state["question"])
        assistant_message = ChatMessage.objects.create(
            session=session,
            role=ChatMessage.ROLE_ASSISTANT,
            content=answer_text,
            confidence_score=payload["confidence_score"],
            sources=[],
            metadata=message_metadata,
        )
        evidence_spans: list[EvidenceSpan] = []
        for citation in validated_citations:
            chunk = chunks_by_id[citation["chunk_id"]]
            chunk_meta = chunk.metadata or {}
            quote_start = citation["quote_start"]
            quote_end = citation["quote_end"]
            quote_text = citation["quote_text"]
            span_start_char = int(chunk_meta.get("start_char", 0)) + quote_start
            span_end_char = int(chunk_meta.get("start_char", 0)) + quote_end
            locator_type, locator_payload = _build_evidence_locator(chunk, span_start_char, span_end_char)
            evidence_spans.append(
                EvidenceSpan.objects.create(
                    document=chunk.document,
                    chunk=chunk,
                    chat_message=assistant_message,
                    quote_text=quote_text,
                    span_start_char=span_start_char,
                    span_end_char=span_end_char,
                    primary_locator_type=locator_type,
                    locator_payload=locator_payload,
                    created_from=EvidenceSpan.CREATED_FROM_CHAT,
                )
            )
        sources = to_json_safe([_build_source_from_evidence(evidence_span) for evidence_span in evidence_spans])
        answer_sections = _sections_from_payload(payload.get("answer_sections", []), validated_citations)
        if not answer_sections:
            answer_sections = _derive_answer_sections(answer_text, sources)
        coverage_status = _coverage_status_from_sections(answer_sections, len(sources))
        message_metadata = to_json_safe(
            {
                **(message_metadata or {}),
                "citation_coverage_status": coverage_status,
                "valid_citation_count": len(sources),
                "rejected_citation_count": rejected_citation_count,
                "answer_sections": answer_sections,
                "support_summary": _build_support_summary(
                    payload["confidence_score"],
                    state["intent"],
                    payload.get("knowledge_gaps", []),
                    state["graph_context"].get("contradiction_warnings", []),
                    coverage_status,
                ),
            }
        )
        assistant_message.sources = sources
        assistant_message.metadata = message_metadata
        assistant_message.save(update_fields=["sources", "metadata"])
        refresh_session_summary(session)

    task_created = False
    if payload["confidence_score"] < 0.6 or payload.get("knowledge_gaps"):
        SelfHealingTask.objects.create(
            task_type=SelfHealingTask.TYPE_LOW_CONFIDENCE_ANSWER,
            priority=2,
            title="Low-confidence answer detected",
            description="The system found weak coverage for a user question.",
            brain_id=brain_id,
            status=SelfHealingTask.STATUS_PENDING,
            payload=to_json_safe(
                {
                    "question": state["question"],
                    "contextual_question": state["contextual_question"],
                    "session_id": session.id,
                    "session_summary": state.get("session_context", {}).get("summary", ""),
                    "answer": answer_text,
                    "confidence_score": payload["confidence_score"],
                    "top_chunk_ids": payload.get("source_chunk_ids", []),
                    "related_entity_ids": payload.get("related_entity_ids", []),
                    "knowledge_gaps": payload.get("knowledge_gaps", []),
                }
            ),
        )
        task_created = True

    return to_json_safe(
        {
            "session_id": session.id,
            "answer": answer_text,
            "confidence_score": payload["confidence_score"],
            "intent": state["intent"],
            "support_summary": message_metadata.get("support_summary"),
            "sources": sources,
            "related_entities": [
                {"id": entity.id, "name": entity.name, "type": entity.entity_type}
                for entity in state["graph_context"].get("entities", [])[:6]
            ],
            "knowledge_gaps": payload.get("knowledge_gaps", []),
            "contradiction_warnings": state["graph_context"].get("contradiction_warnings", []),
            "citation_coverage_status": message_metadata.get("citation_coverage_status"),
            "valid_citation_count": message_metadata.get("valid_citation_count"),
            "rejected_citation_count": message_metadata.get("rejected_citation_count"),
            "answer_sections": message_metadata.get("answer_sections", []),
            "self_healing_task_created": task_created or payload.get("should_create_self_healing_task", False),
        }
    )


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
        load_session_context,
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
    state: RetrievalState = {
        "question": question,
        "session_id": session_id,
        "brain_id": brain_id,
        "llm_provider": llm_provider,
        "llm_model": llm_model,
    }

    yield {
        "type": "status",
        "stage": "searching_knowledge",
        "label": "Searching knowledge",
    }

    for step in (
        load_session_context,
        classify_question,
        load_repair_memory,
        expand_graph_context,
        retrieve_chunks,
        assess_gaps,
    ):
        state.update(step(state))

    yield {
        "type": "context",
        "payload": {
            "confidence_score": state["confidence"],
            "knowledge_gaps": state["gaps"],
        },
    }
    yield {
        "type": "status",
        "stage": "generating_answer",
        "label": "Generating answer",
    }

    graph_context = state["graph_context"]
    answer_parts: list[str] = []
    for token in stream_answer_text(
        question=state["question"],
        session_context=str(state.get("session_context", {}).get("summary", "")),
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

    streamed_answer = "".join(answer_parts).strip()
    yield {
        "type": "status",
        "stage": "grounding_citations",
        "label": "Grounding citations",
    }
    payload = synthesize_answer_payload(
        question=state["question"],
        session_context=str(state.get("session_context", {}).get("summary", "")),
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
    payload["answer_markdown"] = streamed_answer or payload.get("answer_markdown", "")
    yield {
        "type": "status",
        "stage": "saving_response",
        "label": "Saving response",
    }
    final_payload = persist_retrieval_result(state, payload)
    yield {"type": "citations", "payload": final_payload}
    yield {
        "type": "complete",
        "payload": {"session_id": final_payload["session_id"]},
    }


def build_retrieval_graph():
    builder = StateGraph(RetrievalState)
    builder.add_node("load_session_context", load_session_context)
    builder.add_node("classify_question", classify_question)
    builder.add_node("load_repair_memory", load_repair_memory)
    builder.add_node("expand_graph_context", expand_graph_context)
    builder.add_node("retrieve_chunks", retrieve_chunks)
    builder.add_node("assess_gaps", assess_gaps)
    builder.add_node("synthesize_answer", synthesize_answer)
    builder.add_node("persist_chat_and_tasks", persist_chat_and_tasks)
    builder.add_edge(START, "load_session_context")
    builder.add_edge("load_session_context", "classify_question")
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
