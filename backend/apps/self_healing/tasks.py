from celery import shared_task

from apps.agents.self_healing_agent import run_task
from apps.self_healing.services.auto_repair import (
    queue_brain_auto_repairs,
    queue_enabled_auto_repairs,
    run_brain_retrieval_enrichment,
)
from apps.self_healing.models import SelfHealingTask


@shared_task
def run_self_healing_task(task_id: int) -> None:
    task = SelfHealingTask.objects.get(id=task_id)
    run_task(task)


@shared_task
def run_brain_auto_repairs_task(brain_id: str, safe_only: bool = True, limit: int = 20) -> list[int]:
    task_ids = queue_brain_auto_repairs(brain_id, safe_only=safe_only, limit=limit)
    for task_id in task_ids:
        run_self_healing_task.delay(task_id)
    return task_ids


@shared_task
def run_enabled_auto_repairs_task(limit_per_brain: int = 20) -> dict[str, list[int]]:
    queued = queue_enabled_auto_repairs(limit_per_brain=limit_per_brain)
    for _, task_ids in queued.items():
        for task_id in task_ids:
            run_self_healing_task.delay(task_id)
    return queued


@shared_task
def run_brain_retrieval_enrichment_task(brain_id: str) -> int:
    return run_brain_retrieval_enrichment(brain_id)
