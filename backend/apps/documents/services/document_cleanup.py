from __future__ import annotations

from django.db import transaction
from django.db.models import Count

from apps.documents.models import Document
from apps.knowledge.models import Claim, ChunkEntityMention, Entity, Relationship
from apps.self_healing.models import SelfHealingTask


def cleanup_orphan_entities() -> int:
    orphan_entities = Entity.objects.annotate(
        orphan_mention_refs=Count("mentions", distinct=True),
        orphan_claim_refs=Count("claims", distinct=True),
        orphan_outgoing_refs=Count("outgoing_relationships", distinct=True),
        orphan_incoming_refs=Count("incoming_relationships", distinct=True),
    ).filter(
        orphan_mention_refs=0,
        orphan_claim_refs=0,
        orphan_outgoing_refs=0,
        orphan_incoming_refs=0,
    )
    deleted_count = orphan_entities.count()
    orphan_entities.delete()
    return deleted_count


def clear_document_knowledge(document: Document) -> dict:
    with transaction.atomic():
        SelfHealingTask.objects.filter(related_document=document).delete()
        Relationship.objects.filter(evidence_chunk__document=document).delete()
        Claim.objects.filter(source_chunk__document=document).delete()
        ChunkEntityMention.objects.filter(chunk__document=document).delete()
        deleted_orphan_entities = cleanup_orphan_entities()
    return {
        "document_id": document.id,
        "deleted_orphan_entities": deleted_orphan_entities,
    }


def delete_document_and_cleanup(document: Document) -> dict:
    document_id = document.id
    with transaction.atomic():
        SelfHealingTask.objects.filter(related_document=document).delete()
        document.delete()
        deleted_orphan_entities = cleanup_orphan_entities()
    return {
        "document_id": document_id,
        "deleted_orphan_entities": deleted_orphan_entities,
    }
