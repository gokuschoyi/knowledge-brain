from __future__ import annotations

from copy import deepcopy

from apps.core.utils import to_json_safe
from apps.documents.models import IngestionJob

STAGE_DEFINITIONS = [
    ("extracting_text", "Extracting Text"),
    ("cleaning_text", "Cleaning Text"),
    ("chunking", "Chunking"),
    ("persisting_chunks", "Persisting Chunks"),
    ("chunk_extraction_fanout", "Queueing Chunk Extraction"),
    ("chunk_extraction_in_progress", "Extracting Chunk Knowledge"),
    ("consolidating_document_knowledge", "Consolidating Document Knowledge"),
    ("persisting_knowledge", "Persisting Knowledge"),
    ("enrichment", "Enrichment"),
    ("contradiction_detection", "Contradiction Detection"),
    ("scoring_quality", "Scoring Quality"),
    ("generating_self_healing_tasks", "Generating Self-Healing Tasks"),
    ("completed", "Completed"),
]

STAGE_LABELS = {key: label for key, label in STAGE_DEFINITIONS}
TERMINAL_STAGE_STATUSES = {"completed", "failed", "warning", "skipped"}


def _default_stages() -> dict[str, dict]:
    return {
        key: {
            "key": key,
            "label": label,
            "status": "pending",
            "message": "",
            "started_at": None,
            "completed_at": None,
        }
        for key, label in STAGE_DEFINITIONS
    }


def ensure_stage_metadata(job: IngestionJob) -> dict:
    metadata = dict(job.metadata or {})
    stages = _default_stages()
    stages.update(to_json_safe(metadata.get("stages", {})) or {})
    metadata["stages"] = stages
    metadata.setdefault("warnings", [])
    metadata.setdefault("finalization", {})
    return metadata


def set_stage_status(
    job: IngestionJob,
    step: str,
    stage_status: str,
    message: str,
    *,
    progress: int | None = None,
    status: str | None = None,
) -> None:
    metadata = ensure_stage_metadata(job)
    stages = deepcopy(metadata["stages"])
    stage = dict(stages.get(step) or {})
    stage["key"] = step
    stage["label"] = stage.get("label") or STAGE_LABELS.get(step, step.replace("_", " ").title())
    if stage.get("started_at") is None:
        stage["started_at"] = job.updated_at.isoformat() if job.updated_at else None
    stage["status"] = stage_status
    stage["message"] = message
    if stage_status in TERMINAL_STAGE_STATUSES:
        stage["completed_at"] = job.updated_at.isoformat() if job.updated_at else None
    stages[step] = stage
    metadata["stages"] = stages

    log = list(job.log)
    log.append({"step": step, "status": stage_status, "message": message})
    job.current_step = step
    if progress is not None:
        job.progress = progress
    job.log = log
    job.metadata = metadata
    if status:
        job.status = status
    update_fields = ["current_step", "log", "metadata", "updated_at"]
    if progress is not None:
        update_fields.append("progress")
    if status:
        update_fields.append("status")
    job.save(update_fields=update_fields)


def append_warning(job: IngestionJob, message: str) -> None:
    metadata = ensure_stage_metadata(job)
    warnings = list(metadata.get("warnings", []))
    warnings.append(message)
    metadata["warnings"] = warnings
    job.metadata = metadata
    job.save(update_fields=["metadata", "updated_at"])


def update_progress(job: IngestionJob, step: str, progress: int, message: str, status: str | None = None) -> None:
    stage_status = "completed" if progress >= 100 or step == "completed" else "running"
    set_stage_status(job, step, stage_status, message, progress=progress, status=status)
