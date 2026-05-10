# Backend Architecture

The backend is a Django 5 + Celery application split across six focused apps. All async work is brokered through Redis and executed by Celery workers. LLM interactions are handled through LangChain, with queue-based ingestion and LangGraph workflows for retrieval and self-healing.

---

## App Breakdown

### `core`

Foundational models and shared utilities.

**Key models:**

| Model | Purpose |
|-------|---------|
| `Brain` | Multi-tenant workspace. Each brain is an isolated knowledge domain. Holds auto-repair settings (enabled, interval, task types). |

**Endpoints:** Dashboard metrics (`GET /api/dashboard/`), Brain CRUD (`/api/dashboard/brains/`), model catalog (`GET /api/models/`).

---

### `documents`

Owns the full lifecycle from raw upload to embedded chunks.

**Key models:**

| Model | Key fields |
|-------|-----------|
| `Document` | `brain`, `title`, `source_type` (text/file/url), `source_authority`, `source_published_at`, `source_observed_at`, `status` (pending/processing/completed/failed), `quality_score`, `summary` |
| `IngestionJob` | `document`, `status`, `stages` (JSON progress log), `error_message` |
| `Chunk` | `document`, `index`, `text`, `summary`, `embedding` (pgvector), `quality_score`, `token_count` |
| `ChunkExtractionArtifact` | `chunk`, `job`, `status` (queued/running/completed/failed), `payload` (raw bundled extraction JSON), `error_message`, `attempt_count` |

**Services:**
- `parallel_ingestion_v2.py` — the V2 pipeline coordinator
- `text_extraction.py` — PyMuPDF → pypdf → OCR fallback chain
- `text_cleaning.py` — whitespace, encoding, noise removal
- `chunking.py` — token-aware text splitting
- `confidence_calibration.py` — heuristic confidence conversion
- `ingestion_progress.py` — real-time progress event emission
- `document_cleanup.py` — cascading deletion

---

### `knowledge`

Owns the structured knowledge graph produced by ingestion.

**Key models:**

| Model | Key fields |
|-------|-----------|
| `Entity` | `brain`, `name`, `canonical_name`, `description`, `aliases`, `confidence`, `retrieval_text`, `mention_count`, `is_contradictory` |
| `ChunkEntityMention` | `chunk`, `entity`, `mention_text`, `confidence` |
| `Claim` | `text`, `subject_entity`, `confidence`, `contradiction_flag`, `contradiction_review_state`, `metadata` |
| `Relationship` | `source_entity`, `target_entity`, `label`, `normalized_type`, `confidence`, `evidence_chunk` |
| `ChatSession` | `brain`, `title`, `summary` |
| `ChatMessage` | `session`, `role`, `content`, `sources`, `metadata` |

---

### `agents`

Owns all LLM integration: model selection, prompts, structured output schemas, and agent workflow entrypoints.

**Key files:**

| File | Purpose |
|------|---------|
| `llm.py` | Builds the active LLM client from `DEFAULT_LLM_PROVIDER` + `DEFAULT_LLM_MODEL`. Supports OpenAI, Anthropic, Gemini. Returns `None` when no key is configured (triggers deterministic fallback). |
| `prompts.py` | All prompt templates: bundled extraction, entity definition, answer synthesis, repair prompts. |
| `schemas.py` | Pydantic models for structured LLM output: `ExtractionPayload`, `AnswerPayload`, `RepairResult`. |
| `retrieval_agent.py` | Retrieval LangGraph workflow: `answer_question()` and `stream_question_answer()` entrypoints. |
| `self_healing_agent.py` | Self-healing LangGraph workflow: routes by task type and executes the appropriate repair handler. |

---

### `retrieval`

Owns the retrieval pipeline and chat answer management.

**Key services:**
- Vector search over `Chunk.embedding` using pgvector cosine similarity
- Graph expansion: pulls in entity definitions, claims, and relationship edges connected to top chunks
- Multi-signal reranking: combines retrieval score, chunk quality, document quality, graph hints, source authority, and source freshness
- `confidence.py` — computes final answer confidence from reranked scores and gap penalties
- Session context: bounded recent-turn summaries that help follow-up questions retrieve against the current topic
- Repair memory: reusable query-answer pairs persisted from prior low-confidence recovery

---

### `self_healing`

Owns repair task records and the repair runner.

**Key model:**

| Model | Key fields |
|-------|-----------|
| `SelfHealingTask` | `brain`, `task_type`, `status` (pending/running/resolved/unresolved/review_required/failed/ignored), `payload` (repair input), `result` (repair output), `related_document`, `related_entity` |

**Task types:** `duplicate_entity`, `missing_definition`, `low_confidence_answer`, `contradiction`, `orphan_chunk`

---

## Celery Task Graph

```
run_document_ingestion(document_id, job_id)
  ├─ [fan out] run_chunk_bundled_extraction(artifact_id)  ← ingestion queue, parallel
  │               runs bundled LLM extraction for one chunk
  │               stores result in ChunkExtractionArtifact
  │
  └─ finalize_document_ingestion(job_id)
       consolidates all artifact payloads
       persists entities / claims / relationships / mentions
       runs enrichment + contradiction detection + scoring
       generates SelfHealingTask records
```

Two dedicated Celery queues keep ingestion throughput high:
- **Default queue** — handles `run_document_ingestion` and `finalize_document_ingestion`
- **Ingestion queue** (`INGESTION_V2_CHUNK_QUEUE`) — handles `run_chunk_bundled_extraction` with up to `INGESTION_V2_MAX_PARALLEL_CHUNK_TASKS` concurrent workers

**Celery Beat** runs on a configurable interval (`AUTO_REPAIR_BEAT_INTERVAL_MINUTES`) to scan for brains with overdue auto-repair and enqueue self-healing runs.

---

## Redis Role

| Usage | Key |
|-------|-----|
| Celery broker | `CELERY_BROKER_URL` → `redis://…/0` |
| Celery result backend | `CELERY_RESULT_BACKEND` → `redis://…/1` |

Redis also serves as the message channel for SSE streaming: the retrieval agent emits events that are streamed to the browser via `ChatQueryStreamView`.

---

## Related docs

- [architecture/overview.md](overview.md) — end-to-end system diagram
- [backend/ingestion.md](../backend/ingestion.md) — V2 pipeline implementation detail
- [backend/self-healing.md](../backend/self-healing.md) — repair handlers and scheduling
- [backend/api.md](../backend/api.md) — all REST endpoints
