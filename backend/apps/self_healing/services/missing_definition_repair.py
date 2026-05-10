from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model, invoke_structured_output
from apps.agents.prompts import MISSING_DEFINITION_PROMPT
from apps.agents.schemas import MissingDefinitionResponse
from apps.knowledge.models import Entity
from apps.knowledge.services.retrieval_enrichment import enrich_entity


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
            response = invoke_structured_output(
                prompt=prompt,
                schema=MissingDefinitionResponse,
                payload={
                    "entity_name": entity.name,
                    "current_description": entity.description,
                    "evidence_text": evidence_text,
                },
                llm_provider=llm_provider,
                llm_model=llm_model,
                operation="missing_definition_repair",
            )
            if response is None:
                raise ValueError("Missing definition repair returned no structured response.")
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
    enrich_entity(entity)
    return {"definition": description, "confidence": entity.confidence, "evidence_chunk_ids": evidence_chunk_ids}
