from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from apps.core.models import Brain
from apps.knowledge.services.retrieval_enrichment import enrich_entities_for_brain
from apps.self_healing.models import SelfHealingTask

SAFE_AUTO_REPAIR_TYPES = [SelfHealingTask.TYPE_MISSING_DEFINITION]


def _brain_is_due_for_auto_repair(brain: Brain, now=None) -> bool:
    now = now or timezone.now()
    if not brain.auto_repair_enabled:
        return False
    if brain.last_auto_repair_at is None:
        return True
    frequency_minutes = max(1, int(brain.auto_repair_frequency_minutes or 60))
    return brain.last_auto_repair_at <= now - timedelta(minutes=frequency_minutes)


def queue_brain_auto_repairs(
    brain_id,
    *,
    safe_only: bool = True,
    limit: int = 20,
) -> list[int]:
    queryset = SelfHealingTask.objects.filter(
        brain_id=brain_id,
        status=SelfHealingTask.STATUS_PENDING,
    ).order_by("-priority", "-created_at")
    if safe_only:
        queryset = queryset.filter(task_type__in=SAFE_AUTO_REPAIR_TYPES)
    queued_ids = list(queryset.values_list("id", flat=True)[:limit])
    Brain.objects.filter(id=brain_id).update(last_auto_repair_at=timezone.now())
    return queued_ids


def queue_enabled_auto_repairs(limit_per_brain: int = 20) -> dict[str, list[int]]:
    queued: dict[str, list[int]] = {}
    now = timezone.now()
    for brain in Brain.objects.filter(auto_repair_enabled=True):
        if not _brain_is_due_for_auto_repair(brain, now=now):
            continue
        queued[str(brain.id)] = queue_brain_auto_repairs(
            brain.id,
            safe_only=brain.auto_repair_safe_only,
            limit=limit_per_brain,
        )
    return queued


def run_brain_retrieval_enrichment(brain_id) -> int:
    return enrich_entities_for_brain(brain_id)
