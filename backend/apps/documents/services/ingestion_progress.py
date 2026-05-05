from __future__ import annotations

from apps.documents.models import IngestionJob


def update_progress(job: IngestionJob, step: str, progress: int, message: str, status: str | None = None) -> None:
    log = list(job.log)
    log.append({"step": step, "message": message})
    job.current_step = step
    job.progress = progress
    job.log = log
    if status:
        job.status = status
    job.save(update_fields=["current_step", "progress", "log", "status", "updated_at"])

