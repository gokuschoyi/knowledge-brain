from __future__ import annotations

from django.db import transaction
from django.db.models import Count

from apps.documents.models import Document
from apps.knowledge.models import Entity
from apps.self_healing.models import SelfHealingTask


def cleanup_orphan_entities() -> int:
    orphan_entities = Entity.objects.annotate(
        mention_count=Count("mentions", distinct=True),
        claim_count=Count("claims", distinct=True),
        outgoing_count=Count("outgoing_relationships", distinct=True),
        incoming_count=Count("incoming_relationships", distinct=True),
    ).filter(
        mention_count=0,
        claim_count=0,
        outgoing_count=0,
        incoming_count=0,
    )
    deleted_count = orphan_entities.count()
    orphan_entities.delete()
    return deleted_count


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

