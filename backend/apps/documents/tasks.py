from celery import shared_task

from apps.documents.services.ingestion_pipeline import run_ingestion_pipeline
from apps.documents.services.parallel_ingestion_v2 import (
    check_or_finalize_ingestion,
    run_chunk_bundled_extraction_for_artifact,
)


@shared_task
def run_document_ingestion(document_id: int, job_id: int) -> None:
    run_ingestion_pipeline(document_id=document_id, job_id=job_id)


@shared_task
def run_chunk_bundled_extraction(artifact_id: int) -> None:
    run_chunk_bundled_extraction_for_artifact(artifact_id)
    from apps.documents.models import ChunkExtractionArtifact

    artifact = ChunkExtractionArtifact.objects.only("ingestion_job_id").get(id=artifact_id)
    finalize_document_ingestion.delay(artifact.ingestion_job_id)


@shared_task
def finalize_document_ingestion(job_id: int) -> None:
    check_or_finalize_ingestion(job_id)
