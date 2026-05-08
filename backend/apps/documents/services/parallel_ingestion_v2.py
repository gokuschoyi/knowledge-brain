from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.core.utils import deterministic_embedding, normalise_name
from apps.documents.models import Chunk, ChunkExtractionArtifact, Document, IngestionJob
from apps.documents.services.chunking import chunk_text
from apps.documents.services.document_cleanup import clear_document_knowledge
from apps.documents.services.ingestion_progress import append_warning, ensure_stage_metadata, set_stage_status
from apps.documents.services.text_cleaning import clean_text
from apps.documents.services.text_extraction import extract_text
from apps.knowledge.models import Claim, ChunkEntityMention, Entity, Relationship
from apps.knowledge.services.bundled_extraction import extract_bundled_payload
from apps.knowledge.services.contradiction_detector import detect_contradictions_for_document
from apps.knowledge.services.graph_builder import build_graph_for_document
from apps.knowledge.services.quality_scoring import score_chunk_quality, score_document_quality
from apps.knowledge.services.retrieval_enrichment import (
    enrich_document_knowledge,
    normalize_relationship_type,
    summarize_chunk_text,
)
from apps.retrieval.services.embedding import embed_text
from apps.self_healing.services.task_generator import generate_tasks_for_document


@dataclass
class ConsolidatedEntity:
    key: str
    names: Counter = field(default_factory=Counter)
    aliases: set[str] = field(default_factory=set)
    entity_types: Counter = field(default_factory=Counter)
    description: str = ""
    confidence: float = 0.0
    mentions_by_chunk: dict[int, dict] = field(default_factory=dict)


@dataclass
class ConsolidatedClaim:
    chunk_id: int
    text: str
    subject_key: str | None
    confidence: float


@dataclass
class ConsolidatedRelationship:
    chunk_id: int
    source_key: str
    target_key: str
    relationship_type: str
    confidence: float


def _resolve_entity_key(name: str | None, local_lookup: dict[str, str], entities: dict[str, ConsolidatedEntity]) -> str | None:
    normalized = normalise_name(name or "")
    if not normalized:
        return None
    if normalized in local_lookup:
        return local_lookup[normalized]
    if normalized in entities:
        return normalized
    for entity in entities.values():
        if normalized in {normalise_name(alias) for alias in entity.aliases}:
            return entity.key
    return None


def _select_primary_name(entity: ConsolidatedEntity) -> str:
    if not entity.names:
        return entity.key
    ranked_names = sorted(
        entity.names.items(),
        key=lambda item: (-item[1], len(item[0]), item[0].lower()),
    )
    return ranked_names[0][0]


def _consolidate_artifacts(artifacts: list[ChunkExtractionArtifact]) -> tuple[dict[str, ConsolidatedEntity], list[ConsolidatedClaim], list[ConsolidatedRelationship]]:
    entities: dict[str, ConsolidatedEntity] = {}
    claims: dict[tuple[int, str], ConsolidatedClaim] = {}
    relationships: dict[tuple[int, str, str, str], ConsolidatedRelationship] = {}

    for artifact in artifacts:
        payload = artifact.payload or {}
        chunk_id = artifact.chunk_id
        local_lookup: dict[str, str] = {}
        default_subject_key: str | None = None

        for entity_data in payload.get("entities", []):
            name = (entity_data.get("name") or "").strip()
            key = normalise_name(name)
            if not key:
                continue
            consolidated = entities.setdefault(key, ConsolidatedEntity(key=key))
            consolidated.names[name] += 1
            consolidated.entity_types[(entity_data.get("type") or "concept").strip() or "concept"] += 1
            description = (entity_data.get("description") or "").strip()
            if len(description) > len(consolidated.description):
                consolidated.description = description
            consolidated.confidence = max(consolidated.confidence, float(entity_data.get("confidence") or 0.0))
            aliases = {
                alias.strip()
                for alias in entity_data.get("aliases", [])
                if isinstance(alias, str) and alias.strip()
            }
            aliases.add(name)
            consolidated.aliases.update(aliases)

            existing_mention = consolidated.mentions_by_chunk.get(chunk_id)
            mention_confidence = float(entity_data.get("confidence") or 0.0)
            if existing_mention is None or mention_confidence >= existing_mention["confidence"]:
                consolidated.mentions_by_chunk[chunk_id] = {
                    "mention_text": name,
                    "confidence": mention_confidence,
                }

            local_lookup[key] = key
            for alias in aliases:
                alias_key = normalise_name(alias)
                if alias_key:
                    local_lookup[alias_key] = key
            if default_subject_key is None:
                default_subject_key = key

        for claim_data in payload.get("claims", []):
            text = (claim_data.get("text") or "").strip()
            if len(text) < 20:
                continue
            subject_key = _resolve_entity_key(claim_data.get("subject"), local_lookup, entities) or default_subject_key
            claim_key = (chunk_id, text)
            if claim_key not in claims:
                claims[claim_key] = ConsolidatedClaim(
                    chunk_id=chunk_id,
                    text=text,
                    subject_key=subject_key,
                    confidence=float(claim_data.get("confidence") or 0.0),
                )

        for relationship_data in payload.get("relationships", []):
            source_key = _resolve_entity_key(relationship_data.get("source"), local_lookup, entities)
            target_key = _resolve_entity_key(relationship_data.get("target"), local_lookup, entities)
            if not source_key or not target_key or source_key == target_key:
                continue
            relationship_type = (relationship_data.get("type") or "related_to").strip() or "related_to"
            relationship_key = (
                chunk_id,
                source_key,
                target_key,
                normalize_relationship_type(relationship_type),
            )
            if relationship_key not in relationships:
                relationships[relationship_key] = ConsolidatedRelationship(
                    chunk_id=chunk_id,
                    source_key=source_key,
                    target_key=target_key,
                    relationship_type=relationship_type,
                    confidence=float(relationship_data.get("confidence") or 0.0),
                )

    return entities, list(claims.values()), list(relationships.values())


def _persist_consolidated_knowledge(
    document: Document,
    entities: dict[str, ConsolidatedEntity],
    claims: list[ConsolidatedClaim],
    relationships: list[ConsolidatedRelationship],
) -> None:
    clear_document_knowledge(document)
    entity_map: dict[str, Entity] = {}

    for consolidated in entities.values():
        primary_name = _select_primary_name(consolidated)
        canonical_name = primary_name
        aliases = sorted(
            {
                alias
                for alias in consolidated.aliases
                if alias and alias.strip() and alias.strip().lower() != primary_name.lower()
            }
        )
        entity_type = consolidated.entity_types.most_common(1)[0][0] if consolidated.entity_types else "concept"
        entity, created = Entity.objects.get_or_create(
            brain=document.brain,
            name=primary_name,
            defaults={
                "brain": document.brain,
                "canonical_name": canonical_name,
                "entity_type": entity_type,
                "description": consolidated.description,
                "confidence": consolidated.confidence,
                "embedding": deterministic_embedding(primary_name),
                "aliases": aliases,
            },
        )
        if not created:
            merged_aliases = sorted({*entity.aliases, *aliases})
            entity.canonical_name = entity.canonical_name or canonical_name
            entity.entity_type = entity_type or entity.entity_type
            if len(consolidated.description) > len(entity.description or ""):
                entity.description = consolidated.description
            entity.confidence = max(entity.confidence, consolidated.confidence)
            entity.aliases = merged_aliases
            if entity.embedding is None:
                entity.embedding = deterministic_embedding(primary_name)
            entity.save(
                update_fields=[
                    "canonical_name",
                    "entity_type",
                    "description",
                    "confidence",
                    "aliases",
                    "embedding",
                    "updated_at",
                ]
            )
        entity_map[consolidated.key] = entity

        for chunk_id, mention in consolidated.mentions_by_chunk.items():
            ChunkEntityMention.objects.get_or_create(
                chunk_id=chunk_id,
                entity=entity,
                defaults={
                    "mention_text": mention["mention_text"],
                    "confidence": mention["confidence"],
                },
            )

    for claim in claims:
        Claim.objects.get_or_create(
            source_chunk_id=claim.chunk_id,
            text=claim.text,
            defaults={
                "subject_entity": entity_map.get(claim.subject_key) if claim.subject_key else None,
                "confidence": claim.confidence,
            },
        )

    for relationship in relationships:
        source = entity_map.get(relationship.source_key)
        target = entity_map.get(relationship.target_key)
        if source is None or target is None or source.id == target.id:
            continue
        Relationship.objects.get_or_create(
            source_entity=source,
            target_entity=target,
            evidence_chunk_id=relationship.chunk_id,
            relationship_type=relationship.relationship_type,
            defaults={
                "confidence": relationship.confidence,
                "normalized_type": normalize_relationship_type(relationship.relationship_type),
            },
        )


def _chunk_progress(job: IngestionJob) -> dict[str, int]:
    counts = {
        ChunkExtractionArtifact.STATUS_PENDING: 0,
        ChunkExtractionArtifact.STATUS_QUEUED: 0,
        ChunkExtractionArtifact.STATUS_RUNNING: 0,
        ChunkExtractionArtifact.STATUS_COMPLETED: 0,
        ChunkExtractionArtifact.STATUS_FAILED: 0,
    }
    aggregate = {
        item["status"]: item["count"]
        for item in job.chunk_artifacts.values("status").annotate(count=Count("id"))
    }
    counts.update(aggregate)
    counts["total"] = sum(counts[status] for status in (
        ChunkExtractionArtifact.STATUS_PENDING,
        ChunkExtractionArtifact.STATUS_QUEUED,
        ChunkExtractionArtifact.STATUS_RUNNING,
        ChunkExtractionArtifact.STATUS_COMPLETED,
        ChunkExtractionArtifact.STATUS_FAILED,
    ))
    counts["successful_artifacts"] = counts[ChunkExtractionArtifact.STATUS_COMPLETED]
    return counts


def _update_chunk_stage(job: IngestionJob) -> dict[str, int]:
    counts = _chunk_progress(job)
    total = max(1, counts["total"])
    processed = counts[ChunkExtractionArtifact.STATUS_COMPLETED] + counts[ChunkExtractionArtifact.STATUS_FAILED]
    progress = 60 + int((processed / total) * 18)
    if processed >= total and total > 0:
        status = "warning" if counts[ChunkExtractionArtifact.STATUS_FAILED] else "completed"
    else:
        status = "running"
    message = (
        f"Processed {processed}/{total} chunks "
        f"({counts[ChunkExtractionArtifact.STATUS_COMPLETED]} completed, "
        f"{counts[ChunkExtractionArtifact.STATUS_FAILED]} failed, "
        f"{counts[ChunkExtractionArtifact.STATUS_RUNNING]} running)"
    )
    set_stage_status(job, "chunk_extraction_in_progress", status, message, progress=progress)
    return counts


def run_parallel_v2_ingestion(document_id: int, job_id: int) -> None:
    from apps.documents.tasks import run_chunk_bundled_extraction

    document = Document.objects.get(id=document_id)
    job = IngestionJob.objects.get(id=job_id)
    document.status = Document.STATUS_PROCESSING
    document.save(update_fields=["status", "updated_at"])

    metadata = ensure_stage_metadata(job)
    metadata["finalization"] = {"is_finalizing": False, "is_finalized": False}
    job.metadata = metadata
    job.status = IngestionJob.STATUS_PROCESSING
    job.save(update_fields=["metadata", "status", "updated_at"])

    set_stage_status(job, "extracting_text", "running", "Extracting text", progress=10, status=IngestionJob.STATUS_PROCESSING)
    raw_text = extract_text(document)
    if not raw_text.strip():
        source_hint = "uploaded file"
        if document.source_type == Document.SOURCE_URL:
            source_hint = document.url or "URL"
        elif document.source_type == Document.SOURCE_FILE:
            source_hint = document.raw_file.name if document.raw_file else "uploaded file"
        raise ValueError(
            f"No readable text could be extracted from {source_hint}. "
            "If this is a scanned PDF, OCR is required before ingestion."
        )
    set_stage_status(job, "extracting_text", "completed", f"Extracted {len(raw_text)} characters", progress=15)

    set_stage_status(job, "cleaning_text", "running", "Cleaning extracted text", progress=20)
    cleaned_text = clean_text(raw_text)
    document.raw_text = cleaned_text
    document.save(update_fields=["raw_text", "updated_at"])
    set_stage_status(job, "cleaning_text", "completed", f"Prepared {len(cleaned_text)} characters", progress=25)

    set_stage_status(job, "chunking", "running", "Creating chunks", progress=30)
    chunks_data = chunk_text(cleaned_text)
    if not chunks_data:
        raise ValueError("Text extraction succeeded but produced no usable chunks.")
    set_stage_status(job, "chunking", "completed", f"Created {len(chunks_data)} chunks", progress=35)

    set_stage_status(job, "persisting_chunks", "running", "Persisting chunks and embeddings", progress=40)
    ChunkExtractionArtifact.objects.filter(ingestion_job=job).delete()
    document.chunks.all().delete()
    created_chunks: list[Chunk] = []
    for index, chunk_data in enumerate(chunks_data):
        text = chunk_data["text"]
        embedding, embedding_metadata = embed_text(text, input_type="document")
        chunk = Chunk.objects.create(
            document=document,
            text=text,
            summary=summarize_chunk_text(text),
            chunk_index=index,
            token_count=chunk_data["token_count"],
            embedding=embedding,
            importance_score=min(1.0, chunk_data["token_count"] / 1200),
            metadata={"source_type": document.source_type, **embedding_metadata},
        )
        chunk.quality_score = score_chunk_quality(chunk)
        chunk.save(update_fields=["quality_score"])
        created_chunks.append(chunk)
    set_stage_status(job, "persisting_chunks", "completed", f"Persisted {len(created_chunks)} chunks", progress=50)

    set_stage_status(job, "chunk_extraction_fanout", "running", "Queueing chunk extraction tasks", progress=55)
    artifacts = [
        ChunkExtractionArtifact(
            ingestion_job=job,
            document=document,
            chunk=chunk,
            status=ChunkExtractionArtifact.STATUS_QUEUED,
        )
        for chunk in created_chunks
    ]
    ChunkExtractionArtifact.objects.bulk_create(artifacts)
    queued_artifacts = list(
        ChunkExtractionArtifact.objects.filter(ingestion_job=job).order_by("chunk__chunk_index", "id")
    )
    for artifact in queued_artifacts:
        run_chunk_bundled_extraction.apply_async(
            args=[artifact.id],
            queue=settings.INGESTION_V2_CHUNK_QUEUE,
        )
    set_stage_status(
        job,
        "chunk_extraction_fanout",
        "completed",
        f"Queued {len(queued_artifacts)} chunk extraction tasks",
        progress=60,
    )
    set_stage_status(
        job,
        "chunk_extraction_in_progress",
        "running",
        f"Waiting on {len(queued_artifacts)} chunk extraction tasks",
        progress=60,
    )


def run_chunk_bundled_extraction_for_artifact(artifact_id: int) -> None:
    artifact = ChunkExtractionArtifact.objects.select_related("chunk", "document", "ingestion_job").get(id=artifact_id)
    if artifact.status == ChunkExtractionArtifact.STATUS_COMPLETED:
        return

    artifact.status = ChunkExtractionArtifact.STATUS_RUNNING
    artifact.attempt_count += 1
    artifact.started_at = timezone.now()
    artifact.error_message = ""
    artifact.save(update_fields=["status", "attempt_count", "started_at", "error_message", "updated_at"])

    try:
        payload = extract_bundled_payload(
            artifact.chunk.text,
            artifact.document.title,
            artifact.document.llm_provider,
            artifact.document.llm_model,
            chunk_id=artifact.chunk_id,
            document_id=artifact.document_id,
        )
        artifact.payload = payload
        artifact.status = ChunkExtractionArtifact.STATUS_COMPLETED
        artifact.completed_at = timezone.now()
        artifact.save(update_fields=["payload", "status", "completed_at", "updated_at"])
    except Exception as exc:
        artifact.status = ChunkExtractionArtifact.STATUS_FAILED
        artifact.error_message = str(exc)
        artifact.completed_at = timezone.now()
        artifact.save(update_fields=["status", "error_message", "completed_at", "updated_at"])
    finally:
        job = artifact.ingestion_job
        _update_chunk_stage(job)


def check_or_finalize_ingestion(job_id: int) -> None:
    should_finalize = False
    with transaction.atomic():
        job = IngestionJob.objects.select_for_update().get(id=job_id)
        document = job.document
        counts = _chunk_progress(job)
        total = counts["total"]
        terminal = counts[ChunkExtractionArtifact.STATUS_COMPLETED] + counts[ChunkExtractionArtifact.STATUS_FAILED]
        metadata = ensure_stage_metadata(job)
        finalization = dict(metadata.get("finalization", {}))
        if finalization.get("is_finalized"):
            return

        if terminal < total:
            _update_chunk_stage(job)
            return

        if counts[ChunkExtractionArtifact.STATUS_COMPLETED] == 0:
            finalization["is_finalized"] = True
            metadata["finalization"] = finalization
            job.metadata = metadata
            document.status = Document.STATUS_FAILED
            document.error_message = "All chunk extraction tasks failed."
            document.save(update_fields=["status", "error_message", "updated_at"])
            set_stage_status(
                job,
                "chunk_extraction_in_progress",
                "failed",
                "All chunk extraction tasks failed.",
                progress=78,
                status=IngestionJob.STATUS_FAILED,
            )
            job.error_message = "All chunk extraction tasks failed."
            job.metadata = metadata
            job.save(update_fields=["error_message", "metadata", "updated_at"])
            return

        if finalization.get("is_finalizing"):
            return

        finalization["is_finalizing"] = True
        metadata["finalization"] = finalization
        job.metadata = metadata
        job.save(update_fields=["metadata", "updated_at"])
        should_finalize = True

    if should_finalize:
        finalize_ingestion_job(job_id)


def finalize_ingestion_job(job_id: int) -> None:
    job = IngestionJob.objects.get(id=job_id)
    document = job.document
    counts = _update_chunk_stage(job)
    failed_count = counts[ChunkExtractionArtifact.STATUS_FAILED]
    if failed_count:
        append_warning(job, f"{failed_count} chunk extraction task(s) failed. Finalizing with partial results.")

    artifacts = list(
        ChunkExtractionArtifact.objects.select_related("chunk")
        .filter(ingestion_job=job, status=ChunkExtractionArtifact.STATUS_COMPLETED)
        .order_by("chunk__chunk_index", "id")
    )

    try:
        set_stage_status(
            job,
            "consolidating_document_knowledge",
            "running",
            f"Consolidating knowledge from {len(artifacts)} successful chunk extractions",
            progress=80,
        )
        entities, claims, relationships = _consolidate_artifacts(artifacts)
        set_stage_status(
            job,
            "consolidating_document_knowledge",
            "completed",
            f"Consolidated {len(entities)} entities, {len(claims)} claims, and {len(relationships)} relationships",
            progress=84,
        )

        set_stage_status(job, "persisting_knowledge", "running", "Persisting consolidated knowledge", progress=86)
        _persist_consolidated_knowledge(document, entities, claims, relationships)
        set_stage_status(job, "persisting_knowledge", "completed", "Persisted consolidated knowledge", progress=88)

        set_stage_status(job, "enrichment", "running", "Enriching graph and retrieval fields", progress=90)
        build_graph_for_document(document)
        enrich_document_knowledge(document)
        set_stage_status(job, "enrichment", "completed", "Knowledge enrichment complete", progress=92)

        set_stage_status(job, "contradiction_detection", "running", "Checking for contradictions", progress=94)
        detect_contradictions_for_document(document)
        set_stage_status(job, "contradiction_detection", "completed", "Contradiction analysis complete", progress=95)

        set_stage_status(job, "scoring_quality", "running", "Scoring document quality", progress=96)
        document.quality_score = score_document_quality(document)
        document.summary = (document.raw_text or "")[:400]
        document.status = Document.STATUS_COMPLETED
        document.error_message = ""
        document.save(update_fields=["quality_score", "summary", "status", "error_message", "updated_at"])
        set_stage_status(job, "scoring_quality", "completed", "Quality scoring complete", progress=97)

        set_stage_status(
            job,
            "generating_self_healing_tasks",
            "running",
            "Generating self-healing tasks",
            progress=98,
        )
        generate_tasks_for_document(document)
        set_stage_status(
            job,
            "generating_self_healing_tasks",
            "completed",
            "Self-healing task generation complete",
            progress=99,
        )

        metadata = ensure_stage_metadata(job)
        finalization = dict(metadata.get("finalization", {}))
        finalization["is_finalizing"] = False
        finalization["is_finalized"] = True
        metadata["finalization"] = finalization
        job.metadata = metadata
        job.save(update_fields=["metadata", "updated_at"])
        completion_message = (
            f"Ingestion complete with {failed_count} failed chunk task(s)"
            if failed_count
            else "Ingestion complete"
        )
        set_stage_status(job, "completed", "completed", completion_message, progress=100, status=IngestionJob.STATUS_COMPLETED)
    except Exception as exc:
        metadata = ensure_stage_metadata(job)
        finalization = dict(metadata.get("finalization", {}))
        finalization["is_finalizing"] = False
        metadata["finalization"] = finalization
        job.metadata = metadata
        job.error_message = str(exc)
        document.status = Document.STATUS_FAILED
        document.error_message = str(exc)
        document.save(update_fields=["status", "error_message", "updated_at"])
        job.save(update_fields=["metadata", "error_message", "updated_at"])
        set_stage_status(
            job,
            "completed",
            "failed",
            f"Ingestion failed during finalization: {exc}",
            progress=job.progress,
            status=IngestionJob.STATUS_FAILED,
        )
        raise
