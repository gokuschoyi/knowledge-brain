# System Overview

Knowledge Brain is an autonomous knowledge-engineering system that ingests unstructured documents, builds a structured knowledge graph, answers questions with source-grounded retrieval, and continuously improves itself through self-healing repair tasks.

---

## The Pipeline

```
Ingest → Structure → Retrieve → Evaluate → Repair
```

Every document follows this path:

1. **Ingest** — upload a file, URL, or raw text
2. **Structure** — extract entities, claims, and relationships with LLM assistance
3. **Retrieve** — answer questions using vector search + graph expansion
4. **Evaluate** — score confidence; detect gaps, contradictions, duplicates
5. **Repair** — run self-healing tasks to strengthen weak knowledge

These stages form a feedback loop: retrieval surfaces weak spots, and repairs make future retrieval stronger.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│              React + TypeScript + Chakra UI                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / SSE
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Django REST API                           │
│    documents │ retrieval │ knowledge │ self_healing │ core  │
└────┬────────────────────┬────────────────────────────────────┘
     │ Celery tasks       │ direct queries
     ▼                    ▼
┌──────────────┐   ┌──────────────────────────────────────────┐
│  Redis       │   │         PostgreSQL + pgvector            │
│  (broker +   │   │  Documents, Chunks, Entities, Claims,    │
│   cache)     │   │  Relationships, SelfHealingTasks         │
└──────────────┘   └──────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│                    Celery Workers                           │
│  worker (default queue)   │  celery-ingestion (chunk queue) │
│  celery-beat (scheduler)  │                                 │
└────────────────────────┬─────────────────────────────────────┘
                         │ LangChain / LangGraph
                         ▼
                 ┌───────────────────┐
                 │   LLM Providers   │
                 │  OpenAI / Gemini  │
                 │  / Anthropic      │
                 └───────────────────┘
```

---

## Six Backend Apps

| App | Responsibility |
|-----|---------------|
| `core` | Brain model (multi-tenant workspace), dashboard metrics, model catalog |
| `documents` | Document storage, text extraction, chunking, embedding, ingestion jobs, V2 pipeline |
| `knowledge` | Entities, claims, relationships, graph API, contradiction detection, enrichment |
| `agents` | LLM model selection, prompts, structured output schemas, LangGraph workflow entrypoints |
| `retrieval` | Vector search, graph expansion, reranking, answer synthesis, confidence scoring, chat sessions |
| `self_healing` | Repair task records, repair handlers, auto-repair scheduling |

---

## Data Flow: Ingestion

```
User uploads document
        │
        ▼
IngestionJob created → Celery task queued
        │
        ▼
V2 Pipeline (parallel_ingestion_v2.py)
  ├─ Extract raw text (PyMuPDF → pypdf → OCR fallback)
  ├─ Clean text
  ├─ Split into Chunks + persist embeddings + chunk quality scores
  ├─ Create one ChunkExtractionArtifact per chunk
  ├─ Fan out bundled LLM extraction tasks (parallel, separate Celery queue)
  ├─ Wait for all chunk tasks to reach terminal state
  ├─ Consolidate successful payloads (merge entities by name, resolve claims/relationships)
  ├─ Persist: Entities, Claims, Relationships, ChunkEntityMentions
  ├─ Enrich retrieval fields
  ├─ Detect contradictions
  ├─ Score document quality + generate summary
  └─ Generate SelfHealingTasks (duplicates, missing definitions, contradictions)
```

## Data Flow: Retrieval

```
Chat question arrives
        │
        ▼
Retrieval Agent (LangGraph)
  ├─ Classify question
  ├─ Load query repair memory (from prior repairs)
  ├─ Expand graph context (entities, claims, relationships)
  ├─ Vector search: retrieve and rerank Chunks
  ├─ Assess knowledge gaps
  ├─ Calculate answer confidence
  ├─ Generate answer (top chunks + entity definitions + claims + relationships)
  └─ If weak: create low_confidence_answer SelfHealingTask
```

---

## Key Design Decisions

**Parallel extraction, serialized persistence.** Chunk-level LLM work runs in parallel across a dedicated Celery queue for throughput, but all knowledge records are written in a single document-scoped consolidation step to avoid race conditions on shared entities.

**Calibrated confidence instead of raw LLM scores.** Raw model confidence is preserved in metadata but is not used directly. A heuristic calibration layer converts it to a product-facing score that avoids saturation at `1.0`.

**Graph is relationship-driven.** The graph endpoint returns connected entity nodes with their relationship edges, plus isolated entities separately. Document nodes are not part of the graph contract.

**Fixed Gemini embeddings.** Retrieval embeddings are locked to `gemini-embedding-001` across all documents and queries to keep the vector space consistent regardless of which generation provider is active.

**LangGraph for long-running workflows.** Retrieval and self-healing run as LangGraph `StateGraph` workflows. Ingestion uses a high-concurrency Celery pipeline with parallel LLM extraction artifacts and document-scoped consolidation.

---

## Related docs

- [architecture/backend.md](backend.md) — app-by-app model and task breakdown
- [architecture/frontend.md](frontend.md) — React page routing and state management
- [backend/ingestion.md](../backend/ingestion.md) — ingestion pipeline implementation detail
- [backend/retrieval.md](../backend/retrieval.md) — retrieval pipeline implementation detail
