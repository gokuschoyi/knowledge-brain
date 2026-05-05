from celery import shared_task

from apps.self_healing.models import SelfHealingTask
from apps.self_healing.services.repair_runner import run_task


@shared_task
def run_self_healing_task(task_id: int) -> None:
    task = SelfHealingTask.objects.get(id=task_id)
    run_task(task)

