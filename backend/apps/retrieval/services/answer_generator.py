from __future__ import annotations

from collections.abc import Iterator

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import ANSWER_PROMPT
from apps.agents.schemas import AnswerResponse


def build_answer_prompt() -> ChatPromptTemplate:
    return ChatPromptTemplate.from_messages(
        [
            ("system", ANSWER_PROMPT),
            (
                "human",
                "Question: {question}\n\nTop chunks:\n{chunk_context}\n\nRelated relationships:\n{relationship_context}\n\nKnowledge gaps already detected:\n{knowledge_gaps}",
            ),
        ]
    )


def build_answer_prompt_inputs(
    question: str,
    top_chunks: list,
    relationships: list,
    knowledge_gaps: list[str],
) -> dict[str, str]:
    chunk_context = "\n\n".join(
        f"[chunk:{chunk.id}] {chunk.document.title}: {chunk.text[:450]}"
        for chunk in top_chunks
    )
    relationship_context = "\n".join(
        f"{rel.source_entity.name} {rel.relationship_type} {rel.target_entity.name}"
        for rel in relationships[:8]
    )
    return {
        "question": question,
        "chunk_context": chunk_context or "No chunks found.",
        "relationship_context": relationship_context or "No relationships found.",
        "knowledge_gaps": "\n".join(knowledge_gaps) or "None",
    }


def build_fallback_answer_text(top_chunks: list, relationships: list, knowledge_gaps: list[str]) -> str:
    bullet_points = [chunk.summary or chunk.text[:180] for chunk in top_chunks]
    answer = "I've analyzed the knowledge brain context and found the following information:\n\n"
    answer += "\n".join(f"- {point[:220]}" for point in bullet_points) if bullet_points else "- No supporting chunks were found."
    if relationships:
        answer += "\n\nRelated relationships:\n"
        answer += "\n".join(
            f"- {rel.source_entity.name} {rel.relationship_type} {rel.target_entity.name}"
            for rel in relationships[:5]
        )
    if knowledge_gaps:
        answer += "\n\nUncertainty:\n" + "\n".join(f"- {gap}" for gap in knowledge_gaps)
    return answer


def build_answer_payload(
    answer_text: str,
    fallback_confidence: float,
    source_chunk_ids: list[int],
    related_entity_ids: list[int],
    knowledge_gaps: list[str],
) -> dict:
    return {
        "answer": answer_text,
        "confidence_score": fallback_confidence,
        "source_chunk_ids": source_chunk_ids,
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


def stream_answer_text(
    question: str,
    top_chunks: list,
    relationships: list,
    knowledge_gaps: list[str],
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> Iterator[str]:
    model = get_chat_model(llm_provider, llm_model)
    if model is not None:
        prompt = build_answer_prompt()
        try:
            chain = prompt | model
            for chunk in chain.stream(
                build_answer_prompt_inputs(
                    question=question,
                    top_chunks=top_chunks,
                    relationships=relationships,
                    knowledge_gaps=knowledge_gaps,
                )
            ):
                text = _coerce_stream_text(getattr(chunk, "content", ""))
                if text:
                    yield text
            return
        except Exception:
            pass

    fallback_answer = build_fallback_answer_text(top_chunks, relationships, knowledge_gaps)
    for start in range(0, len(fallback_answer), 120):
        yield fallback_answer[start:start + 120]


def synthesize_answer_payload(
    question: str,
    top_chunks: list,
    related_entities: list,
    relationships: list,
    fallback_confidence: float,
    knowledge_gaps: list[str],
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> dict:
    model = get_chat_model(llm_provider, llm_model)
    source_chunk_ids = [chunk.id for chunk in top_chunks]
    related_entity_ids = [entity.id for entity in related_entities[:6]]

    if model is not None:
        prompt = build_answer_prompt()
        try:
            chain = prompt | model.with_structured_output(AnswerResponse)
            response = chain.invoke(
                build_answer_prompt_inputs(
                    question=question,
                    top_chunks=top_chunks,
                    relationships=relationships,
                    knowledge_gaps=knowledge_gaps,
                )
            )
            payload = response.model_dump()
            payload["source_chunk_ids"] = payload.get("source_chunk_ids") or source_chunk_ids
            payload["related_entity_ids"] = payload.get("related_entity_ids") or related_entity_ids
            return payload
        except Exception:
            pass

    return build_answer_payload(
        answer_text=build_fallback_answer_text(top_chunks, relationships, knowledge_gaps),
        fallback_confidence=fallback_confidence,
        source_chunk_ids=source_chunk_ids,
        related_entity_ids=related_entity_ids,
        knowledge_gaps=knowledge_gaps,
    )
