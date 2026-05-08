from __future__ import annotations

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import RELATIONSHIP_EXTRACTION_PROMPT
from apps.agents.schemas import RelationshipExtractionResponse
from apps.documents.models import Chunk
from apps.knowledge.models import Relationship
from apps.knowledge.services.retrieval_enrichment import normalize_relationship_type

KEYWORDS = {
    "uses": "uses",
    "requires": "requires",
    "generates": "generates",
    "supports": "supports",
    "depends on": "depends_on",
    "belongs to": "belongs_to",
}


def _llm_relationships(chunk: Chunk, llm_provider: str | None = None, llm_model: str | None = None) -> list[dict]:
    model = get_chat_model(llm_provider, llm_model)
    if model is None:
        return []
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", RELATIONSHIP_EXTRACTION_PROMPT),
            ("human", "Chunk text:\n{chunk_text}"),
        ]
    )
    try:
        chain = prompt | model.with_structured_output(RelationshipExtractionResponse)
        response = chain.invoke({"chunk_text": chunk.text})
        if response is None:
            return []
        return [relationship.model_dump() for relationship in response.relationships]
    except Exception:
        return []


def extract_relationships_for_chunk(
    chunk: Chunk,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> list[Relationship]:
    mentions = list(chunk.entity_mentions.select_related("entity")[:4])
    if len(mentions) < 2:
        return []

    mention_map = {mention.entity.name: mention.entity for mention in mentions}
    llm_payloads = _llm_relationships(chunk, llm_provider, llm_model)
    lowered = chunk.text.lower()
    relationship_type = "related_to"
    for marker, value in KEYWORDS.items():
        if marker in lowered:
            relationship_type = value
            break

    created: list[Relationship] = []
    if llm_payloads:
        for payload in llm_payloads:
            source = mention_map.get(payload["source"])
            target = mention_map.get(payload["target"])
            if source is None or target is None or source.id == target.id:
                continue
            relationship, was_created = Relationship.objects.get_or_create(
                source_entity=source,
                target_entity=target,
                evidence_chunk=chunk,
                relationship_type=payload.get("type", "related_to"),
                defaults={
                    "confidence": payload.get("confidence", 0.66),
                    "normalized_type": normalize_relationship_type(
                        payload.get("type", "related_to")
                    ),
                },
            )
            if was_created:
                created.append(relationship)
        if created:
            return created

    for index in range(len(mentions) - 1):
        source = mentions[index].entity
        target = mentions[index + 1].entity
        if source.id == target.id:
            continue
        relationship, was_created = Relationship.objects.get_or_create(
            source_entity=source,
            target_entity=target,
            evidence_chunk=chunk,
            relationship_type=relationship_type,
            defaults={
                "confidence": 0.66,
                "normalized_type": normalize_relationship_type(relationship_type),
            },
        )
        if was_created:
            created.append(relationship)
    return created
