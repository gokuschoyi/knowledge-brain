from __future__ import annotations

from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

from apps.documents.models import Chunk, Document, IngestionJob
from apps.documents.services.chunking import chunk_text
from apps.documents.services.ingestion_progress import update_progress
from apps.documents.services.text_cleaning import clean_text
from apps.documents.services.text_extraction import extract_text
from apps.knowledge.services.bundled_extraction import extract_bundled_for_chunk
from apps.knowledge.services.claim_extraction import extract_claims_for_chunk
from apps.knowledge.services.contradiction_detector import detect_contradictions_for_document
from apps.knowledge.services.entity_extraction import extract_entities_for_chunk
from apps.knowledge.services.graph_builder import build_graph_for_document
from apps.knowledge.services.quality_scoring import score_chunk_quality, score_document_quality
from apps.knowledge.services.retrieval_enrichment import enrich_document_knowledge, summarize_chunk_text
from apps.knowledge.services.relationship_extraction import extract_relationships_for_chunk
from apps.retrieval.services.embedding import embed_text
from apps.self_healing.services.task_generator import generate_tasks_for_document
from django.conf import settings


class IngestionState(TypedDict, total=False):
    document_id: int
    job_id: int
    document: Document
    job: IngestionJob
    raw_text: str
    cleaned_text: str
    chunks_data: list[dict[str, Any]]
    chunk_ids: list[int]


def load_records(state: IngestionState) -> IngestionState:
    document = Document.objects.get(id=state["document_id"])
    job = IngestionJob.objects.get(id=state["job_id"])
    document.status = Document.STATUS_PROCESSING
    document.save(update_fields=["status", "updated_at"])
    update_progress(job, "extracting_text", 10, "Extracting text", IngestionJob.STATUS_PROCESSING)
    return {"document": document, "job": job}


def extract_document_text(state: IngestionState) -> IngestionState:
    document = state["document"]
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
    return {"raw_text": raw_text}


def clean_document_text(state: IngestionState) -> IngestionState:
    cleaned_text = clean_text(state["raw_text"])
    document = state["document"]
    job = state["job"]
    document.raw_text = cleaned_text
    update_progress(job, "cleaning_text", 20, f"Prepared {len(cleaned_text)} characters")
    return {"cleaned_text": cleaned_text}


def create_document_chunks(state: IngestionState) -> IngestionState:
    job = state["job"]
    chunks_data = chunk_text(state["cleaned_text"])
    if not chunks_data:
        raise ValueError("Text extraction succeeded but produced no usable chunks.")
    update_progress(job, "chunking", 35, f"Created {len(chunks_data)} chunks")
    return {"chunks_data": chunks_data}


def persist_chunks(state: IngestionState) -> IngestionState:
    document = state["document"]
    chunk_ids: list[int] = []
    document.chunks.all().delete()
    for index, chunk_data in enumerate(state["chunks_data"]):
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
        chunk_ids.append(chunk.id)
    return {"chunk_ids": chunk_ids}


def extract_entities(state: IngestionState) -> IngestionState:
    job = state["job"]
    document = state["document"]
    update_progress(job, "extracting_entities", 55, "Extracting entities")
    for chunk in Chunk.objects.filter(id__in=state["chunk_ids"]):
        extract_entities_for_chunk(
            chunk,
            document.title,
            document.llm_provider,
            document.llm_model,
        )
    return {"chunk_ids": state["chunk_ids"]}


def extract_claims(state: IngestionState) -> IngestionState:
    job = state["job"]
    document = state["document"]
    update_progress(job, "extracting_claims", 70, "Extracting claims")
    for chunk in Chunk.objects.filter(id__in=state["chunk_ids"]):
        extract_claims_for_chunk(chunk, document.llm_provider, document.llm_model)
    return {"chunk_ids": state["chunk_ids"]}


def extract_relationships(state: IngestionState) -> IngestionState:
    job = state["job"]
    document = state["document"]
    update_progress(job, "extracting_relationships", 80, "Extracting relationships")
    for chunk in Chunk.objects.filter(id__in=state["chunk_ids"]):
        extract_relationships_for_chunk(chunk, document.llm_provider, document.llm_model)
    return {"chunk_ids": state["chunk_ids"]}


def extract_bundled(state: IngestionState) -> IngestionState:
    job = state["job"]
    document = state["document"]
    update_progress(job, "knowledge_extraction_v2", 65, "Extracting knowledge (v2 Bundled)")

    chunks = Chunk.objects.filter(id__in=state["chunk_ids"])
    total = chunks.count()

    for index, chunk in enumerate(chunks):
        extract_bundled_for_chunk(
            chunk,
            document.title,
            document.llm_provider,
            document.llm_model,
        )
        if (index + 1) % 5 == 0:
            progress = 55 + int(((index + 1) / total) * 30)
            update_progress(job, "knowledge_extraction_v2", progress, f"Extracted {index+1}/{total} chunks (v2)")

    update_progress(job, "knowledge_extraction_v2", 85, "Bundled extraction complete")
    return {"chunk_ids": state["chunk_ids"]}


def build_graph_records(state: IngestionState) -> IngestionState:
    job = state["job"]
    update_progress(job, "building_graph", 88, "Building graph records")
    build_graph_for_document(state["document"])
    enrich_document_knowledge(state["document"])
    return {"document": state["document"]}


def finalize_quality_and_tasks(state: IngestionState) -> IngestionState:
    document = state["document"]
    job = state["job"]
    update_progress(job, "scoring_quality", 93, "Scoring knowledge quality")
    document.quality_score = score_document_quality(document)
    document.summary = state["cleaned_text"][:400]
    document.status = Document.STATUS_COMPLETED
    document.save(update_fields=["quality_score", "summary", "status", "raw_text", "updated_at"])
    detect_contradictions_for_document(document)
    generate_tasks_for_document(document)
    update_progress(job, "completed", 100, "Ingestion complete", IngestionJob.STATUS_COMPLETED)
    return {"document": document}


def choose_extraction_path(state: IngestionState) -> str:
    version = getattr(settings, "EXTRACTION_VERSION", "V1")
    if version == "V2":
        return "extract_bundled"
    return "extract_entities"


def build_ingestion_graph():
    builder = StateGraph(IngestionState)
    builder.add_node("load_records", load_records)
    builder.add_node("extract_document_text", extract_document_text)
    builder.add_node("clean_document_text", clean_document_text)
    builder.add_node("create_document_chunks", create_document_chunks)
    builder.add_node("persist_chunks", persist_chunks)
    builder.add_node("extract_entities", extract_entities)
    builder.add_node("extract_claims", extract_claims)
    builder.add_node("extract_relationships", extract_relationships)
    builder.add_node("extract_bundled", extract_bundled)
    builder.add_node("build_graph_records", build_graph_records)
    builder.add_node("finalize_quality_and_tasks", finalize_quality_and_tasks)
    builder.add_edge(START, "load_records")
    builder.add_edge("load_records", "extract_document_text")
    builder.add_edge("extract_document_text", "clean_document_text")
    builder.add_edge("clean_document_text", "create_document_chunks")
    builder.add_edge("create_document_chunks", "persist_chunks")

    builder.add_conditional_edges(
        "persist_chunks",
        choose_extraction_path,
        {
            "extract_entities": "extract_entities",
            "extract_bundled": "extract_bundled"
        }
    )

    builder.add_edge("extract_entities", "extract_claims")
    builder.add_edge("extract_claims", "extract_relationships")
    builder.add_edge("extract_relationships", "build_graph_records")

    builder.add_edge("extract_bundled", "build_graph_records")

    builder.add_edge("build_graph_records", "finalize_quality_and_tasks")
    builder.add_edge("finalize_quality_and_tasks", END)
    return builder.compile()


INGESTION_GRAPH = build_ingestion_graph()


def run_ingestion_pipeline(document_id: int, job_id: int) -> None:
    INGESTION_GRAPH.invoke({"document_id": document_id, "job_id": job_id})


__all__ = ["run_ingestion_pipeline", "INGESTION_GRAPH", "build_ingestion_graph"]
