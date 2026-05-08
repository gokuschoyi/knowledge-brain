from __future__ import annotations

import re

from django.utils import timezone

from apps.documents.models import Chunk, Document
from apps.knowledge.models import Claim, Entity, Relationship

RELATIONSHIP_TYPE_MAP = {
    "uses": "uses",
    "require": "requires",
    "requires": "requires",
    "generates": "generates",
    "supports": "supports",
    "depends_on": "depends_on",
    "depends on": "depends_on",
    "belongs_to": "belongs_to",
    "belongs to": "belongs_to",
    "related_to": "related_to",
    "related to": "related_to",
}

GENERIC_DEFINITION_MARKERS = (
    "knowledge-base concept derived from ingested sources",
    "appears in evidence discussing",
)


def summarize_chunk_text(text: str, max_length: int = 240) -> str:
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text.strip())
        if sentence.strip()
    ]
    if not sentences:
        return text.strip()[:max_length]

    summary_parts: list[str] = []
    current_length = 0
    for sentence in sentences:
        projected = current_length + len(sentence) + (1 if summary_parts else 0)
        if projected > max_length and summary_parts:
            break
        summary_parts.append(sentence)
        current_length = projected
        if current_length >= max_length * 0.7:
            break
    summary = " ".join(summary_parts).strip()
    return summary[:max_length]


def normalize_relationship_type(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "").strip().lower())
    return RELATIONSHIP_TYPE_MAP.get(cleaned, "related_to")


def build_claim_subject_key(claim: Claim) -> str:
    if claim.subject_entity_id and claim.subject_entity:
        return claim.subject_entity.name.strip().lower()
    lowered = claim.text.lower()
    if "pro plan" in lowered:
        return "pro plan"
    if "plan" in lowered and "cost" in lowered:
        return "pricing plan"
    return lowered[:80].strip()


def build_entity_retrieval_text(entity: Entity) -> str:
    evidence_chunks = list(
        Chunk.objects.filter(entity_mentions__entity=entity)
        .distinct()
        .order_by("document_id", "chunk_index")[:3]
    )
    evidence_summaries = [chunk.summary or summarize_chunk_text(chunk.text, max_length=180) for chunk in evidence_chunks]
    parts = [
        entity.name,
        entity.canonical_name,
        " ".join(entity.aliases),
        entity.entity_type,
        entity.description,
        " ".join(evidence_summaries),
    ]
    return "\n".join(part.strip() for part in parts if part and part.strip())


def enrich_entity(entity: Entity) -> Entity:
    mentions = entity.mentions.select_related("chunk__document").order_by("chunk_id")
    mention_count = mentions.count()
    source_document_count = mentions.values("chunk__document_id").distinct().count()
    top_evidence_chunk_ids = list(
        mentions.values_list("chunk_id", flat=True).distinct()[:5]
    )
    retrieval_text = build_entity_retrieval_text(entity)
    metadata = {
        **entity.metadata,
        "has_generic_definition": any(
            marker in (entity.description or "").lower()
            for marker in GENERIC_DEFINITION_MARKERS
        ),
    }
    Entity.objects.filter(id=entity.id).update(
        retrieval_text=retrieval_text,
        mention_count=mention_count,
        source_document_count=source_document_count,
        top_evidence_chunk_ids=top_evidence_chunk_ids,
        last_enriched_at=timezone.now(),
        metadata=metadata,
        updated_at=timezone.now(),
    )
    entity.refresh_from_db()
    return entity


def enrich_claim(claim: Claim) -> Claim:
    claim.subject_key = build_claim_subject_key(claim)
    claim.save(update_fields=["subject_key"])
    return claim


def enrich_relationship(relationship: Relationship) -> Relationship:
    relationship.normalized_type = normalize_relationship_type(
        relationship.normalized_type or relationship.relationship_type
    )
    relationship.save(update_fields=["normalized_type"])
    return relationship


def enrich_document_knowledge(document: Document) -> None:
    chunks = Chunk.objects.filter(document=document)
    for chunk in chunks:
        summary = summarize_chunk_text(chunk.text)
        if chunk.summary != summary:
            chunk.summary = summary
            chunk.save(update_fields=["summary"])

    entity_ids = (
        Entity.objects.filter(mentions__chunk__document=document)
        .values_list("id", flat=True)
        .distinct()
    )
    for entity in Entity.objects.filter(id__in=entity_ids):
        enrich_entity(entity)

    for claim in Claim.objects.filter(source_chunk__document=document).select_related("subject_entity"):
        enrich_claim(claim)

    for relationship in Relationship.objects.filter(evidence_chunk__document=document):
        enrich_relationship(relationship)


def enrich_entities_for_brain(brain_id) -> int:
    count = 0
    for entity in Entity.objects.filter(brain_id=brain_id):
        enrich_entity(entity)
        count += 1
    return count


def mark_entities_with_contradictions(entity_ids: list[int]) -> None:
    if not entity_ids:
        return
    for entity in Entity.objects.filter(id__in=entity_ids):
        metadata = {
            **entity.metadata,
            "has_contradictions": True,
        }
        Entity.objects.filter(id=entity.id).update(metadata=metadata, updated_at=timezone.now())
