from __future__ import annotations

from django.db import transaction

from apps.core.models import Brain
from apps.documents.models import IngestionJob
from apps.knowledge.services.contradiction_detector import detect_contradictions_for_brain
from apps.self_healing.services.task_generator import generate_tasks_for_brain

TERMINAL_JOB_STATUSES = {
    IngestionJob.STATUS_COMPLETED,
    IngestionJob.STATUS_FAILED,
}


def build_ingestion_job_metadata(batch_token: str | None = None) -> dict:
    metadata: dict[str, object] = {}
    if batch_token:
        metadata["batch_token"] = batch_token
    return metadata


def request_brain_repair_rescan_for_job(job_id: int) -> bool:
    job = IngestionJob.objects.select_related("document__brain").get(id=job_id)
    if job.status not in TERMINAL_JOB_STATUSES or job.document.brain_id is None:
        return False
    batch_token = (job.metadata or {}).get("batch_token")
    if isinstance(batch_token, str) and batch_token.strip():
        return _request_batch_rescan(job.document.brain_id, batch_token)
    return _request_single_job_rescan(job_id)


def run_brain_post_ingestion_repair_sweep(brain_id) -> int:
    while True:
        with transaction.atomic():
            brain = Brain.objects.select_for_update().get(id=brain_id)
            if brain.completed_ingestion_repair_rescan_version >= brain.pending_ingestion_repair_rescan_version:
                brain.ingestion_repair_rescan_running = False
                brain.save(
                    update_fields=[
                        "ingestion_repair_rescan_running",
                        "updated_at",
                    ]
                )
                return brain.completed_ingestion_repair_rescan_version
            target_version = brain.pending_ingestion_repair_rescan_version

        try:
            detect_contradictions_for_brain(brain_id)
            generate_tasks_for_brain(brain_id)
        except Exception:
            with transaction.atomic():
                brain = Brain.objects.select_for_update().get(id=brain_id)
                brain.ingestion_repair_rescan_running = False
                brain.save(
                    update_fields=[
                        "ingestion_repair_rescan_running",
                        "updated_at",
                    ]
                )
            raise

        with transaction.atomic():
            brain = Brain.objects.select_for_update().get(id=brain_id)
            brain.completed_ingestion_repair_rescan_version = max(
                brain.completed_ingestion_repair_rescan_version,
                target_version,
            )
            brain.save(
                update_fields=[
                    "completed_ingestion_repair_rescan_version",
                    "updated_at",
                ]
            )


def _request_single_job_rescan(job_id: int) -> bool:
    with transaction.atomic():
        job = IngestionJob.objects.select_for_update().get(id=job_id)
        brain_id = job.document.brain_id
        metadata = dict(job.metadata or {})
        if metadata.get("repair_rescan_requested"):
            return False
        metadata["repair_rescan_requested"] = True
        job.metadata = metadata
        job.save(update_fields=["metadata", "updated_at"])
        _queue_brain_rescan(brain_id)
    return True


def _request_batch_rescan(brain_id, batch_token: str) -> bool:
    with transaction.atomic():
        jobs = list(
            IngestionJob.objects.select_for_update()
            .filter(
                document__brain_id=brain_id,
                metadata__batch_token=batch_token,
            )
            .order_by("id")
        )
        if not jobs:
            return False
        if any(job.status not in TERMINAL_JOB_STATUSES for job in jobs):
            return False
        if any((job.metadata or {}).get("repair_rescan_requested") for job in jobs):
            return False
        for job in jobs:
            metadata = dict(job.metadata or {})
            metadata["repair_rescan_requested"] = True
            job.metadata = metadata
            job.save(update_fields=["metadata", "updated_at"])
        _queue_brain_rescan(brain_id)
    return True


def _queue_brain_rescan(brain_id) -> None:
    should_enqueue = False
    with transaction.atomic():
        brain = Brain.objects.select_for_update().get(id=brain_id)
        brain.pending_ingestion_repair_rescan_version += 1
        if not brain.ingestion_repair_rescan_running:
            brain.ingestion_repair_rescan_running = True
            should_enqueue = True
        brain.save(
            update_fields=[
                "pending_ingestion_repair_rescan_version",
                "ingestion_repair_rescan_running",
                "updated_at",
            ]
        )

    if should_enqueue:
        from apps.self_healing.tasks import run_post_ingestion_repair_sweep_task

        transaction.on_commit(lambda: run_post_ingestion_repair_sweep_task.delay(str(brain_id)))
