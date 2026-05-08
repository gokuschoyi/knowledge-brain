from __future__ import annotations

import logging
from django.db import transaction
from langchain_core.prompts import ChatPromptTemplate

from apps.agents.llm import get_chat_model
from apps.agents.prompts import BUNDLED_EXTRACTION_PROMPT
from apps.agents.schemas import BundledExtractionResponse
from apps.core.utils import deterministic_embedding
from apps.documents.models import Chunk
from apps.knowledge.models import ChunkEntityMention, Entity, Claim, Relationship
from apps.knowledge.services.retrieval_enrichment import normalize_relationship_type

logger = logging.getLogger(__name__)

def _llm_bundled(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    model = get_chat_model(llm_provider, llm_model)
    if model is None:
        logger.warning(
            "Bundled extraction skipped because no live chat model is available "
            "(document_id=%s, chunk_id=%s, provider=%s, model=%s).",
            document_id,
            chunk_id,
            llm_provider,
            llm_model,
        )
        return {"entities": [], "claims": [], "relationships": []}
    
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", BUNDLED_EXTRACTION_PROMPT),
            (
                "human",
                "Document title: {document_title}\n\nChunk text:\n{chunk_text}",
            ),
        ]
    )
    try:
        chain = prompt | model.with_structured_output(BundledExtractionResponse)
        response = chain.invoke({"document_title": document_title, "chunk_text": text})
        if response is None:
            logger.warning(
                "Bundled extraction returned no structured response "
                "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s).",
                document_id,
                chunk_id,
                llm_provider,
                llm_model,
                len(text),
            )
            return {"entities": [], "claims": [], "relationships": []}
        return response.model_dump()
    except Exception as e:
        logger.exception(
            "Error in bundled extraction LLM call "
            "(document_id=%s, chunk_id=%s, provider=%s, model=%s, text_len=%s): %s",
            document_id,
            chunk_id,
            llm_provider,
            llm_model,
            len(text),
            e,
        )
        return {"entities": [], "claims": [], "relationships": []}

def extract_bundled_for_chunk(
    chunk: Chunk,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
):
    """
    Performs bundled extraction for a single chunk.
    Saves entities, then claims, then relationships in a single transaction.
    """
    payload = extract_bundled_payload(
        chunk.text,
        document_title,
        llm_provider,
        llm_model,
        chunk_id=chunk.id,
        document_id=chunk.document_id,
    )
    
    with transaction.atomic():
        # 1. Save Entities
        saved_entities = {}
        for ent_data in payload.get("entities", []):
            name = ent_data["name"].strip()
            if not name:
                continue
            entity_brain = chunk.document.brain
            entity, _ = Entity.objects.get_or_create(
                brain=entity_brain,
                name=name,
                defaults={
                    "brain": entity_brain,
                    "canonical_name": name,
                    "entity_type": ent_data.get("type", "concept"),
                    "description": ent_data.get("description", ""),
                    "confidence": ent_data.get("confidence", 0.72),
                    "embedding": deterministic_embedding(name),
                    "aliases": ent_data.get("aliases", []),
                },
            )
            ChunkEntityMention.objects.get_or_create(chunk=chunk, entity=entity)
            saved_entities[name] = entity

        # 2. Save Claims
        # Try to find a default subject if none provided
        default_subject = next(iter(saved_entities.values()), None)
        
        for claim_data in payload.get("claims", []):
            text = claim_data["text"].strip()
            if len(text) < 20: # Slightly relaxed for bundled
                continue
            
            # Map subject name to entity object
            subject_name = claim_data.get("subject")
            subject_entity = saved_entities.get(subject_name) if subject_name else default_subject
            
            Claim.objects.get_or_create(
                source_chunk=chunk,
                text=text,
                defaults={
                    "subject_entity": subject_entity,
                    "confidence": claim_data.get("confidence", 0.68),
                },
            )

        # 3. Save Relationships
        for rel_data in payload.get("relationships", []):
            source = saved_entities.get(rel_data["source"])
            target = saved_entities.get(rel_data["target"])
            
            if source is None or target is None or source.id == target.id:
                continue
                
            Relationship.objects.get_or_create(
                source_entity=source,
                target_entity=target,
                evidence_chunk=chunk,
                relationship_type=rel_data.get("type", "related_to"),
                defaults={
                    "confidence": rel_data.get("confidence", 0.66),
                    "normalized_type": normalize_relationship_type(
                        rel_data.get("type", "related_to")
                    ),
                },
            )


def extract_bundled_payload(
    text: str,
    document_title: str,
    llm_provider: str | None = None,
    llm_model: str | None = None,
    *,
    chunk_id: int | None = None,
    document_id: int | None = None,
) -> dict:
    return _llm_bundled(
        text,
        document_title,
        llm_provider,
        llm_model,
        chunk_id=chunk_id,
        document_id=document_id,
    )
