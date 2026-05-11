from __future__ import annotations

from collections import defaultdict

from apps.core.utils import normalise_name
from apps.documents.models import Document
from apps.knowledge.models import Entity
from apps.self_healing.models import SelfHealingTask

ACTIVE_TASK_STATUSES = [
    SelfHealingTask.STATUS_PENDING,
    SelfHealingTask.STATUS_RUNNING,
]


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


def _latest_related_document_for_entity(entity: Entity) -> Document | None:
    return Document.objects.filter(chunks__entity_mentions__entity=entity).order_by("-created_at", "-id").first()


def _latest_related_document_for_entities(entities: list[Entity]) -> Document | None:
    entity_ids = [entity.id for entity in entities]
    if not entity_ids:
        return None
    return (
        Document.objects.filter(chunks__entity_mentions__entity_id__in=entity_ids)
        .distinct()
        .order_by("-created_at", "-id")
        .first()
    )


def _create_duplicate_entity_task(
    *,
    brain_id,
    candidates: list[Entity],
    related_document: Document | None,
) -> SelfHealingTask | None:
    candidate_ids = sorted(entity.id for entity in candidates)
    candidate_key = ",".join(str(entity_id) for entity_id in candidate_ids)
    if SelfHealingTask.objects.filter(
        task_type=SelfHealingTask.TYPE_DUPLICATE_ENTITY,
        brain_id=brain_id,
        payload__candidate_key=candidate_key,
        status__in=ACTIVE_TASK_STATUSES,
    ).exists():
        return None
    canonical = min(candidates, key=lambda entity: len(entity.name))
    return SelfHealingTask.objects.create(
        task_type=SelfHealingTask.TYPE_DUPLICATE_ENTITY,
        priority=3,
        title=f"Merge duplicate entities around {canonical.name}",
        description="Names or aliases look like the same concept.",
        brain_id=brain_id,
        related_document=related_document,
        related_entity=canonical,
        payload={
            "candidate_entity_ids": candidate_ids,
            "candidate_key": candidate_key,
            "suggested_canonical_name": canonical.name,
        },
    )


def _create_missing_definition_task(
    *,
    entity: Entity,
    related_document: Document | None,
) -> SelfHealingTask | None:
    if SelfHealingTask.objects.filter(
        task_type=SelfHealingTask.TYPE_MISSING_DEFINITION,
        brain_id=entity.brain_id,
        related_entity=entity,
        status__in=ACTIVE_TASK_STATUSES,
    ).exists():
        return None
    return SelfHealingTask.objects.create(
        task_type=SelfHealingTask.TYPE_MISSING_DEFINITION,
        priority=2,
        title=f"Generate missing definition for {entity.name}",
        description="This entity is referenced repeatedly but lacks a useful definition.",
        brain_id=entity.brain_id,
        related_document=related_document,
        related_entity=entity,
        payload={"entity_id": entity.id},
    )


def _generate_duplicate_tasks(
    *,
    brain_id,
    grouped_entities: dict[str, list[Entity]],
    related_document_resolver,
) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    for candidates in grouped_entities.values():
        if len(candidates) > 1:
            task = _create_duplicate_entity_task(
                brain_id=brain_id,
                candidates=candidates,
                related_document=related_document_resolver(candidates),
            )
            if task is not None:
                tasks.append(task)
    return tasks


def generate_tasks_for_document(document: Document) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    entities = list(Entity.objects.filter(mentions__chunk__document=document).distinct())
    grouped: dict[str, list[Entity]] = defaultdict(list)
    for entity in entities:
        grouped[normalise_name(entity.name)].append(entity)

    tasks.extend(
        _generate_duplicate_tasks(
            brain_id=document.brain_id,
            grouped_entities=grouped,
            related_document_resolver=lambda _candidates: document,
        )
    )
    for entity in entities:
        mentions = entity.mentions.filter(chunk__document=document).count()
        if mentions >= 2 and _is_weak_definition(entity):
            task = _create_missing_definition_task(
                entity=entity,
                related_document=document,
            )
            if task is not None:
                tasks.append(task)
    return tasks


def generate_tasks_for_brain(brain_id) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    entities = list(Entity.objects.filter(brain_id=brain_id))
    grouped: dict[str, list[Entity]] = defaultdict(list)
    for entity in entities:
        grouped[normalise_name(entity.name)].append(entity)

    tasks.extend(
        _generate_duplicate_tasks(
            brain_id=brain_id,
            grouped_entities=grouped,
            related_document_resolver=_latest_related_document_for_entities,
        )
    )
    for entity in entities:
        if entity.mentions.count() >= 2 and _is_weak_definition(entity):
            task = _create_missing_definition_task(
                entity=entity,
                related_document=_latest_related_document_for_entity(entity),
            )
            if task is not None:
                tasks.append(task)
    return tasks
