# API Reference

All endpoints are prefixed with `/api/`. The base URL in development is `http://localhost:8000`.

Authentication is not required for the current build (single-user, local deployment). The `brain_id` query parameter is the primary scoping mechanism — most read endpoints filter by it.

---

## Health

### `GET /api/health/`

Service liveness check.

**Response `200`:**
```json
{ "status": "ok" }
```

---

## Dashboard

### `GET /api/dashboard/`

Returns aggregate metrics for the active brain.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `brain_id` | UUID | Filter to a specific brain |

**Response `200`:**
```json
{
  "document_count": 12,
  "chunk_count": 340,
  "entity_count": 87,
  "claim_count": 203,
  "relationship_count": 54,
  "pending_tasks": 3,
  "avg_document_quality": 0.74
}
```

---

## Brains

### `GET /api/dashboard/brains/`

List all brains.

**Response `200`:** Array of brain objects:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Research Notes",
    "auto_repair_enabled": true,
    "auto_repair_interval_hours": 24,
    "created_at": "2025-01-01T12:00:00Z"
  }
]
```

### `POST /api/dashboard/brains/`

Create a brain.

**Request body:**
```json
{ "name": "My Brain" }
```

**Response `201`:** Brain object (same shape as list item).

### `GET /api/dashboard/brains/:id/`

Retrieve a single brain.

### `PATCH /api/dashboard/brains/:id/`

Update brain settings (name, auto-repair config).

### `DELETE /api/dashboard/brains/:id/`

Delete a brain and all its data.

---

## Documents

### `POST /api/documents/ingest/`

Upload a document for ingestion. Accepts `multipart/form-data` (file upload) or JSON.

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `brain_id` | UUID | Yes | Target brain |
| `source_type` | string | Yes | `"text"`, `"file"`, or `"url"` |
| `title` | string | No | Display name |
| `content` | string | For `text` | Raw text content |
| `file` | file | For `file` | Uploaded file (PDF, TXT, DOCX, …) |
| `url` | string | For `url` | URL to fetch and ingest |

**Response `201`:**
```json
{ "document_id": 42, "job_id": 17, "status": "pending" }
```

### `GET /api/documents/`

List documents.

**Query params:** `brain_id` (UUID)

**Response `200`:** Array of document objects with `id`, `title`, `status`, `quality_score`, `source_type`, `created_at`.

### `GET /api/documents/:id/`

Retrieve a single document with full detail including `summary` and `error_message`.

### `DELETE /api/documents/:id/delete/`

Delete a document and cascade-remove all associated chunks, entities, claims, and relationships.

**Response `204`:** No content.

### `POST /api/documents/:id/retry/`

Re-queue a failed document for ingestion.

**Response `202`:**
```json
{ "document_id": 42, "job_id": 18, "status": "pending" }
```

### `GET /api/documents/:id/chunks/`

List all chunks for a document with text, summary, quality score, and extraction artifact status.

### `POST /api/documents/:doc_id/chunks/:chunk_id/retry/`

Re-queue a single failed chunk extraction artifact.

**Response `202`:**
```json
{ "artifact_id": 55, "status": "queued" }
```

### `GET /api/documents/:id/entities/`

List entities extracted from a specific document.

### `GET /api/documents/:id/relationships/`

List relationships extracted from a specific document.

---

## Ingestion Jobs

### `GET /api/ingestion/jobs/:id/`

Retrieve an ingestion job with stage progress and per-chunk artifact statuses.

**Response `200`:**
```json
{
  "id": 17,
  "document_id": 42,
  "status": "completed",
  "stages": [
    { "stage": "text_extraction", "status": "completed", "ts": "…" },
    { "stage": "chunking", "status": "completed", "chunk_count": 18, "ts": "…" },
    { "stage": "chunk_extraction", "status": "completed", "ts": "…" },
    { "stage": "finalization", "status": "completed", "ts": "…" }
  ],
  "chunk_artifacts": [
    { "chunk_id": 101, "status": "completed" },
    { "chunk_id": 102, "status": "failed", "error_message": "…" }
  ]
}
```

### `GET /api/ingestion/jobs/:id/events/`

SSE stream of real-time progress events during ingestion.

**Stream event shape:**
```
data: {"type": "stage_update", "stage": "chunking", "status": "started"}
data: {"type": "chunk_artifact_update", "artifact_id": 55, "status": "completed"}
data: {"type": "done"}
```

---

## Chat

### `POST /api/chat/query/`

Submit a question and receive a complete answer in one response.

**Request body:**
```json
{
  "question": "What is Smart Tutor?",
  "brain_id": "550e8400-…",
  "session_id": 3
}
```

`session_id` is optional. If omitted, a new session is created.

**Response `200`:**
```json
{
  "answer": "Smart Tutor is …",
  "confidence_score": 0.82,
  "sources": [
    { "chunk_id": 101, "text": "…", "document_title": "…", "score": 0.91 }
  ],
  "knowledge_gaps": ["Pricing details not found in knowledge base"],
  "session_id": 3
}
```

### `POST /api/chat/query/stream/`

Same as above, but returns an SSE stream for progressive rendering.

**Same request body as `POST /api/chat/query/`.**

**Stream events:**
```
data: {"type": "status", "message": "retrieval_started"}
data: {"type": "chunk", "content": "Smart Tutor is "}
data: {"type": "chunk", "content": "an AI-powered …"}
data: {"type": "sources", "sources": […]}
data: {"type": "confidence", "score": 0.82}
data: {"type": "gaps", "gaps": ["…"]}
data: {"type": "done"}
```

### `GET /api/chat/sessions/`

List chat sessions.

**Query params:** `brain_id` (UUID)

**Response `200`:** Array of session objects with `id`, `title`, `brain_id`, `created_at`, and `messages`.

### `GET /api/chat/sessions/:id/`

Retrieve a single session with full message history.

---

## Knowledge

### `GET /api/entities/`

List entities.

**Query params:** `brain_id` (UUID)

**Response `200`:** Array of entity objects with `id`, `name`, `description`, `confidence`, `mention_count`, `aliases`, `is_contradictory`.

### `GET /api/entities/:id/`

Retrieve a single entity with full detail.

### `GET /api/entities/:id/relationships/`

List relationships where this entity is source or target.

### `GET /api/claims/`

List claims.

**Query params:** `brain_id` (UUID)

**Response `200`:** Array of claim objects with `id`, `text`, `subject_entity`, `confidence`, `is_contradicted`.

---

## Knowledge Graph

### `GET /api/graph/`

Returns the full graph payload for a brain, pre-shaped for the frontend.

**Query params:** `brain_id` (UUID, required)

**Response `200`:**
```json
{
  "connected_graph": {
    "nodes": [
      { "id": "e-12", "label": "Smart Tutor", "type": "entity", "confidence": 0.87 }
    ],
    "edges": [
      { "id": "r-5", "source": "e-12", "target": "e-8", "label": "uses", "confidence": 0.71 }
    ]
  },
  "isolated_entities": [
    { "id": "e-19", "label": "Pricing", "confidence": 0.61 }
  ]
}
```

Document nodes are intentionally excluded. `connected_graph` contains only entity nodes with at least one relationship edge. `isolated_entities` contains entity nodes with no edges.

---

## Self-Healing

### `GET /api/self-healing/tasks/`

List repair tasks.

**Query params:** `brain_id` (UUID), `status` (pending/running/completed/failed/ignored), `task_type`

**Response `200`:** Array of task objects with `id`, `task_type`, `status`, `payload`, `result`, `related_document`, `related_entity`, `created_at`.

### `POST /api/self-healing/tasks/:id/run/`

Execute a single repair task immediately.

**Response `200`:** Updated task object with `status: "completed"` or `"failed"` and `result`.

### `POST /api/self-healing/tasks/:id/ignore/`

Mark a task as ignored (will not be auto-repaired).

**Response `200`:** Updated task object.

### `DELETE /api/self-healing/tasks/:id/`

Delete a repair task record.

**Response `204`:** No content.

### `POST /api/self-healing/run/`

Run all pending tasks for a brain in sequence.

**Request body:**
```json
{ "brain_id": "550e8400-…" }
```

**Response `200`:**
```json
{ "ran": 5, "completed": 4, "failed": 1 }
```

---

## Models

### `GET /api/models/`

Returns the list of available LLM providers and models based on which API keys are configured.

**Response `200`:**
```json
{
  "providers": ["openai", "anthropic", "google"],
  "models": {
    "openai": ["gpt-4o", "gpt-4o-mini"],
    "anthropic": ["claude-opus-4-7", "claude-sonnet-4-6"],
    "google": ["gemini-2.0-flash"]
  },
  "default_provider": "anthropic",
  "default_model": "claude-sonnet-4-6"
}
```
