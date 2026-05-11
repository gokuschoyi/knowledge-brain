from __future__ import annotations

from collections.abc import Iterator

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model, invoke_structured_output
from apps.agents.prompts import ANSWER_PROMPT, STREAMING_ANSWER_PROMPT
from apps.agents.schemas import AnswerResponse


def _chunk_context_label(chunk) -> str:
    meta = chunk.metadata or {}
    parts = [f"chunk:{chunk.id}", chunk.document.title]
    if meta.get("page_number") is not None:
        parts.append(f"page {meta['page_number']}")
    if meta.get("section_heading"):
        parts.append(str(meta["section_heading"]))
    content_type = meta.get("content_type")
    if content_type:
        parts.append(f"type={content_type}")
    certainty = meta.get("certainty_level")
    if isinstance(certainty, (int, float)):
        parts.append(f"certainty={certainty:.2f}")
    return " | ".join(parts)


def _chunk_context_excerpt(chunk) -> str:
    text = (chunk.text or "").strip()
    if len(text) <= 700:
        return text
    return f"{text[:697]}..."


def infer_answer_mode(question: str) -> str:
    lowered = question.lower()
    if any(marker in lowered for marker in ("what is", "who is", "define", "overview", "explain")):
        return "definition"
    if any(marker in lowered for marker in ("exact", "how much", "price", "cost", "when", "date", "duration")):
        return "precision"
    return "general"


def build_answer_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", ANSWER_PROMPT),
            (
                "human",
                "Question: {question}\n\n"
                "Session context:\n{session_context}\n\n"
                "Answer mode: {answer_mode}\n\n"
                "Top chunks:\n{chunk_context}\n\n"
                "Top entity definitions:\n{entity_context}\n\n"
                "Related relationships:\n{relationship_context}\n\n"
                "Grounded claims:\n{claim_context}\n\n"
                "Contradiction warnings:\n{contradiction_context}\n\n"
                "Knowledge gaps already detected:\n{knowledge_gaps}",
            ),
        ]
    )


def build_streaming_answer_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", STREAMING_ANSWER_PROMPT),
            (
                "human",
                "Question: {question}\n\n"
                "Session context:\n{session_context}\n\n"
                "Answer mode: {answer_mode}\n\n"
                "Top chunks:\n{chunk_context}\n\n"
                "Top entity definitions:\n{entity_context}\n\n"
                "Related relationships:\n{relationship_context}\n\n"
                "Grounded claims:\n{claim_context}\n\n"
                "Contradiction warnings:\n{contradiction_context}\n\n"
                "Knowledge gaps already detected:\n{knowledge_gaps}",
            ),
        ]
    )


def build_answer_prompt_inputs(
    question: str,
    session_context: str,
    top_chunks: list,
    related_entities: list,
    relationships: list,
    claims: list,
    contradiction_warnings: list[str],
    knowledge_gaps: list[str],
) -> dict[str, str]:
    answer_mode = infer_answer_mode(question)
    chunk_context = "\n\n".join(
        f"[{_chunk_context_label(chunk)}]\n{_chunk_context_excerpt(chunk)}" for chunk in top_chunks
    )
    entity_context = "\n".join(
        f"- {entity.name} ({entity.entity_type}, confidence {entity.confidence:.2f}): "
        f"{(entity.description or 'No definition available.')[:260]}"
        for entity in related_entities[:6]
    )
    relationship_context = "\n".join(
        f"{rel.source_entity.name} {rel.normalized_type or rel.relationship_type} {rel.target_entity.name}"
        for rel in relationships[:8]
    )
    claim_context = "\n".join(
        f"- {claim.text[:260]}" + (" [conflicting evidence]" if claim.contradiction_flag else "")
        for claim in claims[:8]
    )
    contradiction_context = "\n".join(contradiction_warnings) or "None"
    return {
        "question": question,
        "session_context": session_context or "None",
        "answer_mode": answer_mode,
        "chunk_context": chunk_context or "No chunks found.",
        "entity_context": entity_context or "No high-confidence entity definitions found.",
        "relationship_context": relationship_context or "No relationships found.",
        "claim_context": claim_context or "No grounded claims found.",
        "contradiction_context": contradiction_context,
        "knowledge_gaps": "\n".join(knowledge_gaps) or "None",
    }


def build_fallback_answer_text(
    question: str,
    session_context: str,
    top_chunks: list,
    related_entities: list,
    relationships: list,
    claims: list,
    contradiction_warnings: list[str],
    knowledge_gaps: list[str],
) -> str:
    answer_mode = infer_answer_mode(question)
    bullet_points = [chunk.summary or chunk.text[:180] for chunk in top_chunks[:4]]
    answer = "I've analyzed the knowledge brain context and found the following information:\n\n"
    if session_context:
        answer += f"Conversation context:\n- {session_context[:220]}\n\n"
    if answer_mode == "definition" and related_entities:
        answer += "\n".join(
            f"- **{entity.name}**: {(entity.description or 'No strong definition is available yet.')[:220]}"
            for entity in related_entities[:3]
        )
    else:
        answer += (
            "\n".join(f"- {point[:220]}" for point in bullet_points)
            if bullet_points
            else "- No supporting chunks were found."
        )
    if claims:
        answer += "\n\nGrounded claims:\n"
        answer += "\n".join(f"- {claim.text[:220]}" for claim in claims[:4])
    if relationships:
        answer += "\n\nRelated relationships:\n"
        answer += "\n".join(
            f"- {rel.source_entity.name} {rel.normalized_type or rel.relationship_type} {rel.target_entity.name}"
            for rel in relationships[:5]
        )
    if contradiction_warnings:
        answer += "\n\nConflicts to keep in mind:\n"
        answer += "\n".join(f"- {warning}" for warning in contradiction_warnings[:3])
    if knowledge_gaps:
        answer += "\n\nUncertainty:\n" + "\n".join(f"- {gap}" for gap in knowledge_gaps)
    return answer


def build_answer_payload(
    answer_markdown: str,
    fallback_confidence: float,
    source_chunk_ids: list[int],
    grounded_citations: list[dict],
    answer_sections: list[dict],
    related_entity_ids: list[int],
    knowledge_gaps: list[str],
) -> dict:
    return {
        "answer_markdown": answer_markdown,
        "confidence_score": fallback_confidence,
        "source_chunk_ids": source_chunk_ids,
        "grounded_citations": grounded_citations,
        "answer_sections": answer_sections,
        "related_entity_ids": related_entity_ids,
        "knowledge_gaps": knowledge_gaps,
        "should_create_self_healing_task": fallback_confidence < 0.6 or bool(knowledge_gaps),
    }


def _coerce_stream_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
            else:
                text = getattr(item, "text", None)
                if isinstance(text, str):
                    parts.append(text)
        return "".join(parts)
    return ""


def _sanitize_stream_chunk(text: str) -> str:
    normalized = text.replace("\\n", "\n").replace("\\t", "\t")
    structured_markers = (
        "grounded_citations",
        "answer_sections",
        '"answer_markdown"',
        '"chunk_id"',
        '"quote_text"',
    )
    lines = normalized.splitlines(keepends=True)
    kept_lines: list[str] = []
    for line in lines:
        stripped = line.strip()
        if any(marker in stripped for marker in structured_markers):
            break
        if stripped in {"{", "}", "[", "]"}:
            continue
        kept_lines.append(line)
    return "".join(kept_lines)


def stream_answer_text(
    question: str,
    session_context: str,
    top_chunks: list,
    related_entities: list,
    relationships: list,
    claims: list,
    contradiction_warnings: list[str],
    knowledge_gaps: list[str],
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> Iterator[str]:
    model = get_chat_model(llm_provider, llm_model)
    if model is not None:
        prompt = build_streaming_answer_prompt()
        try:
            chain = prompt | model
            for chunk in chain.stream(
                build_answer_prompt_inputs(
                    question=question,
                    session_context=session_context,
                    top_chunks=top_chunks,
                    related_entities=related_entities,
                    relationships=relationships,
                    claims=claims,
                    contradiction_warnings=contradiction_warnings,
                    knowledge_gaps=knowledge_gaps,
                )
            ):
                text = _coerce_stream_text(getattr(chunk, "content", ""))
                if text:
                    cleaned = _sanitize_stream_chunk(text)
                    if cleaned:
                        yield cleaned
            return
        except Exception:
            pass

    fallback_answer = build_fallback_answer_text(
        question,
        session_context,
        top_chunks,
        related_entities,
        relationships,
        claims,
        contradiction_warnings,
        knowledge_gaps,
    )
    for start in range(0, len(fallback_answer), 120):
        yield fallback_answer[start : start + 120]


def synthesize_answer_payload(
    question: str,
    session_context: str,
    top_chunks: list,
    related_entities: list,
    relationships: list,
    claims: list,
    contradiction_warnings: list[str],
    fallback_confidence: float,
    knowledge_gaps: list[str],
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> dict:
    model = get_chat_model(llm_provider, llm_model)
    source_chunk_ids = [chunk.id for chunk in top_chunks]
    related_entity_ids = [entity.id for entity in related_entities[:6]]
    fallback_answer = build_fallback_answer_text(
        question,
        session_context,
        top_chunks,
        related_entities,
        relationships,
        claims,
        contradiction_warnings,
        knowledge_gaps,
    )
    fallback_sections = [
        {"content": section.strip(), "chunk_ids": source_chunk_ids[:1]}
        for section in fallback_answer.split("\n\n")
        if section.strip()
    ]

    if model is not None:
        prompt = build_answer_prompt()
        try:
            response = invoke_structured_output(
                prompt=prompt,
                schema=AnswerResponse,
                payload=build_answer_prompt_inputs(
                    question=question,
                    session_context=session_context,
                    top_chunks=top_chunks,
                    related_entities=related_entities,
                    relationships=relationships,
                    claims=claims,
                    contradiction_warnings=contradiction_warnings,
                    knowledge_gaps=knowledge_gaps,
                ),
                llm_provider=llm_provider,
                llm_model=llm_model,
                operation="answer_synthesis",
            )
            if response is None:
                raise ValueError("Answer synthesis returned no structured response.")
            payload = response.model_dump()
            payload["answer_markdown"] = payload["answer_markdown"].replace("\\n", "\n").replace("\\t", "\t")
            payload["source_chunk_ids"] = payload.get("source_chunk_ids") or source_chunk_ids
            payload["grounded_citations"] = payload.get("grounded_citations") or []
            payload["answer_sections"] = payload.get("answer_sections") or fallback_sections
            payload["related_entity_ids"] = payload.get("related_entity_ids") or related_entity_ids
            return payload
        except Exception:
            pass

    return build_answer_payload(
        answer_markdown=fallback_answer,
        fallback_confidence=fallback_confidence,
        source_chunk_ids=source_chunk_ids,
        grounded_citations=[],
        answer_sections=fallback_sections,
        related_entity_ids=related_entity_ids,
        knowledge_gaps=knowledge_gaps,
    )
