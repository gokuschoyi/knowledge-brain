from celery import shared_task

from apps.documents.services.ingestion_pipeline import run_ingestion_pipeline


@shared_task
def run_document_ingestion(document_id: int, job_id: int) -> None:
    run_ingestion_pipeline(document_id=document_id, job_id=job_id)

