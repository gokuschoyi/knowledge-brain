from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import ANSWER_PROMPT
from apps.agents.schemas import AnswerResponse


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
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", ANSWER_PROMPT),
                (
                    "human",
                    "Question: {question}\n\nTop chunks:\n{chunk_context}\n\nRelated relationships:\n{relationship_context}\n\nKnowledge gaps already detected:\n{knowledge_gaps}",
                ),
            ]
        )
        chunk_context = "\n\n".join(
            f"[chunk:{chunk.id}] {chunk.document.title}: {chunk.text[:450]}"
            for chunk in top_chunks
        )
        relationship_context = "\n".join(
            f"{rel.source_entity.name} {rel.relationship_type} {rel.target_entity.name}"
            for rel in relationships[:8]
        )
        try:
            chain = prompt | model.with_structured_output(AnswerResponse)
            response = chain.invoke(
                {
                    "question": question,
                    "chunk_context": chunk_context or "No chunks found.",
                    "relationship_context": relationship_context or "No relationships found.",
                    "knowledge_gaps": "\n".join(knowledge_gaps) or "None",
                }
            )
            payload = response.model_dump()
            payload["source_chunk_ids"] = payload.get("source_chunk_ids") or source_chunk_ids
            payload["related_entity_ids"] = payload.get("related_entity_ids") or related_entity_ids
            return payload
        except Exception:
            pass

    bullet_points = [chunk.summary or chunk.text[:180] for chunk in top_chunks]
    answer = "I found the strongest grounded evidence in these source chunks:\n\n"
    answer += "\n".join(f"- {point[:220]}" for point in bullet_points) if bullet_points else "- No supporting chunks were found."
    if relationships:
        answer += "\n\nRelated relationships:\n"
        answer += "\n".join(
            f"- {rel.source_entity.name} {rel.relationship_type} {rel.target_entity.name}"
            for rel in relationships[:5]
        )
    if knowledge_gaps:
        answer += "\n\nUncertainty:\n" + "\n".join(f"- {gap}" for gap in knowledge_gaps)

    return {
        "answer": answer,
        "confidence_score": fallback_confidence,
        "source_chunk_ids": source_chunk_ids,
        "related_entity_ids": related_entity_ids,
        "knowledge_gaps": knowledge_gaps,
        "should_create_self_healing_task": fallback_confidence < 0.6 or bool(knowledge_gaps),
    }
