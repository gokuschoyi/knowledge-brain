from __future__ import annotations

from apps.documents.models import Document, IngestionJob
from apps.documents.services.parallel_ingestion_v2 import run_parallel_v2_ingestion
from apps.self_healing.services.post_ingestion_repair import (
    request_brain_repair_rescan_for_job,
)


def _mark_ingestion_failed(document: Document, job: IngestionJob, error_message: str) -> None:
    document.status = Document.STATUS_FAILED
    document.error_message = error_message
    document.save(update_fields=["status", "error_message", "updated_at"])
    job.status = IngestionJob.STATUS_FAILED
    job.error_message = error_message
    job.save(update_fields=["status", "error_message", "updated_at"])
    request_brain_repair_rescan_for_job(job.id)


def run_ingestion_pipeline(document_id: int, job_id: int) -> None:
    document = Document.objects.get(id=document_id)
    job = IngestionJob.objects.get(id=job_id)
    try:
        run_parallel_v2_ingestion(document_id=document_id, job_id=job_id)
    except Exception as exc:
        _mark_ingestion_failed(document, job, str(exc))
        raise
