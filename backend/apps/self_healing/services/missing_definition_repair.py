from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import MISSING_DEFINITION_PROMPT
from apps.agents.schemas import MissingDefinitionResponse
from apps.knowledge.models import Entity


def repair_missing_definition(
    entity_id: int,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> dict:
    entity = Entity.objects.get(id=entity_id)
    mentions = entity.mentions.select_related("chunk").all()[:5]
    evidence_chunk_ids = [mention.chunk_id for mention in mentions]
    evidence_text = "\n\n".join(mention.chunk.text[:400] for mention in mentions)
    description = ""
    model = get_chat_model(llm_provider, llm_model)
    if model is not None:
        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", MISSING_DEFINITION_PROMPT),
                (
                    "human",
                    "Entity: {entity_name}\nCurrent description: {current_description}\n\nEvidence:\n{evidence_text}",
                ),
            ]
        )
        try:
            chain = prompt | model.with_structured_output(MissingDefinitionResponse)
            response = chain.invoke(
                {
                    "entity_name": entity.name,
                    "current_description": entity.description,
                    "evidence_text": evidence_text,
                }
            )
            description = response.definition
            evidence_chunk_ids = response.evidence_chunk_ids or evidence_chunk_ids
            entity.confidence = max(entity.confidence, response.confidence)
        except Exception:
            description = ""
    if not description:
        description = (
            f"{entity.name} is a knowledge-base concept derived from ingested sources. "
            f"It appears in evidence discussing {evidence_text[:220].strip()}."
        )
    entity.description = description
    entity.confidence = max(entity.confidence, 0.8)
    entity.save(update_fields=["description", "confidence", "updated_at"])
    return {"definition": description, "confidence": entity.confidence, "evidence_chunk_ids": evidence_chunk_ids}
