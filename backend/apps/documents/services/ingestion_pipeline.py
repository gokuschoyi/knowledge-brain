from __future__ import annotations

from apps.agents.ingestion_agent import run_ingestion_pipeline as run_ingestion_graph
from apps.documents.models import Document, IngestionJob


def run_ingestion_pipeline(document_id: int, job_id: int) -> None:
    document = Document.objects.get(id=document_id)
    job = IngestionJob.objects.get(id=job_id)
    try:
        run_ingestion_graph(document_id=document_id, job_id=job_id)
    except Exception as exc:
        document.status = Document.STATUS_FAILED
        document.error_message = str(exc)
        document.save(update_fields=["status", "error_message", "updated_at"])
        job.status = IngestionJob.STATUS_FAILED
        job.error_message = str(exc)
        job.save(update_fields=["status", "error_message", "updated_at"])
        raise

