from __future__ import annotations

from collections import defaultdict

from apps.core.utils import normalise_name
from apps.documents.models import Document
from apps.knowledge.models import Entity
from apps.self_healing.models import SelfHealingTask


def _is_weak_definition(entity: Entity) -> bool:
    description = (entity.description or "").strip()
    if not description:
        return True
    if len(description) < 80:
        return True
    generic_markers = [
        "knowledge-base concept derived from ingested sources",
        "appears in evidence discussing",
        "concept derived from ingested sources",
    ]
    lowered = description.lower()
    return any(marker in lowered for marker in generic_markers)


def generate_tasks_for_document(document: Document) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    entities = Entity.objects.filter(mentions__chunk__document=document).distinct()
    grouped: dict[str, list[Entity]] = defaultdict(list)
    for entity in entities:
        grouped[normalise_name(entity.name)].append(entity)

    for _, candidates in grouped.items():
        if len(candidates) > 1:
            canonical = min(candidates, key=lambda entity: len(entity.name))
            tasks.append(
                SelfHealingTask.objects.create(
                    task_type=SelfHealingTask.TYPE_DUPLICATE_ENTITY,
                    priority=3,
                    title=f"Merge duplicate entities around {canonical.name}",
                    description="Names or aliases look like the same concept.",
                    related_document=document,
                    related_entity=canonical,
                    payload={
                        "candidate_entity_ids": [entity.id for entity in candidates],
                        "suggested_canonical_name": canonical.name,
                    },
                )
            )

    for entity in entities:
        mentions = entity.mentions.filter(chunk__document=document).count()
        if mentions >= 2 and _is_weak_definition(entity):
            if SelfHealingTask.objects.filter(
                task_type=SelfHealingTask.TYPE_MISSING_DEFINITION,
                related_document=document,
                related_entity=entity,
                status__in=[
                    SelfHealingTask.STATUS_PENDING,
                    SelfHealingTask.STATUS_RUNNING,
                ],
            ).exists():
                continue
            tasks.append(
                SelfHealingTask.objects.create(
                    task_type=SelfHealingTask.TYPE_MISSING_DEFINITION,
                    priority=2,
                    title=f"Generate missing definition for {entity.name}",
                    description="This entity is referenced repeatedly but lacks a useful definition.",
                    related_document=document,
                    related_entity=entity,
                    payload={"entity_id": entity.id},
                )
            )
    return tasks
