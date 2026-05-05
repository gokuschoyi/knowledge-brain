from __future__ import annotations

import re

from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import ENTITY_EXTRACTION_PROMPT
from apps.agents.schemas import EntityExtractionResponse
from apps.core.utils import deterministic_embedding
from apps.documents.models import Chunk
from apps.knowledge.models import ChunkEntityMention, Entity

STOPWORDS = {
    "The",
    "This",
    "That",
    "These",
    "Those",
    "Product",
    "Notes",
    "Overview",
    "Roadmap",
    "Pricing",
}


def _candidate_entities(text: str) -> list[str]:
    matches = re.findall(r"\b(?:[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*)\b", text)
    unique: list[str] = []
    for match in matches:
        cleaned = match.strip()
        if cleaned in STOPWORDS or len(cleaned) < 3:
            continue
        if cleaned not in unique:
            unique.append(cleaned)
    return unique[:12]


def _llm_entities(text: str, document_title: str, llm_provider: str | None = None, llm_model: str | None = None) -> list[dict]:
    model = get_chat_model(llm_provider, llm_model)
    if model is None:
        return []
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", ENTITY_EXTRACTION_PROMPT),
            (
                "human",
                "Document title: {document_title}\n\nChunk text:\n{chunk_text}",
            ),
        ]
    )
    try:
        chain = prompt | model.with_structured_output(EntityExtractionResponse)
        response = chain.invoke({"document_title": document_title, "chunk_text": text})
        return [entity.model_dump() for entity in response.entities]
    except Exception:
        return []


def extract_entities_for_chunk(
    chunk: Chunk,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
) -> list[Entity]:
    results: list[Entity] = []
    candidate_payloads = _llm_entities(chunk.text, document_title, llm_provider, llm_model)
    if not candidate_payloads:
        candidate_payloads = [
            {
                "name": name,
                "type": "concept",
                "description": "",
                "confidence": 0.72,
                "aliases": [],
            }
            for name in _candidate_entities(chunk.text)
        ]

    for payload in candidate_payloads:
        name = payload["name"].strip()
        if not name:
            continue
        entity_brain = chunk.document.brain
        entity, _ = Entity.objects.get_or_create(
            brain=entity_brain,
            name=name,
            defaults={
                "brain": entity_brain,
                "canonical_name": name,
                "entity_type": payload.get("type", "concept"),
                "description": payload.get("description", ""),
                "confidence": payload.get("confidence", 0.72),
                "embedding": deterministic_embedding(name),
                "aliases": payload.get("aliases", []),
            },
        )
        ChunkEntityMention.objects.get_or_create(
            chunk=chunk,
            entity=entity,
            mention_text=name,
            defaults={"confidence": payload.get("confidence", 0.72)},
        )
        results.append(entity)
    return results
