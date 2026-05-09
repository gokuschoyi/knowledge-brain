# Pages

The frontend has eight pages, all children of the root `App` layout. Every page scopes its data to the active brain selected in the top-level `BrainContext`.

---

## Dashboard (`/`)

**Purpose:** Live system health overview — gives a quick sense of what is in the brain and whether it is healthy.

**What it shows:**
- Document count, chunk count, entity count, claim count, relationship count
- Average document quality score
- Pending self-healing task count
- Recent ingestion activity

**Key interactions:**
- Read-only metrics view; acts as the landing page and starting point for demos

**API calls:**
- `GET /api/dashboard/?brain_id=…`

---

## Knowledge Brains (`/brains`)

**Purpose:** Manage isolated knowledge workspaces. Each brain is a completely separate knowledge domain — documents, entities, and repair tasks do not cross brain boundaries.

**What it shows:**
- List of all brains with name and creation date
- Auto-repair configuration per brain (enabled/disabled, interval, eligible task types)

**Key interactions:**
- Create a new brain
- Select a brain (sets `BrainContext`, scopes all other pages)
- Edit brain name and auto-repair settings
- Delete a brain (cascades to all its data)

**API calls:**
- `GET /api/dashboard/brains/`
- `POST /api/dashboard/brains/`
- `PATCH /api/dashboard/brains/:id/`
- `DELETE /api/dashboard/brains/:id/`

---

## Ingest (`/ingest`)

**Purpose:** Upload documents and monitor their ingestion progress.

**What it shows:**
- Upload form (drag-and-drop file, paste text, or enter URL)
- LLM provider/model selector (from model catalog)
- Recent ingestion jobs with status indicators
- Per-job stage breakdown: text extraction → chunking → chunk extraction → finalization
- Per-chunk artifact status (how many chunks completed, how many failed)

**Key interactions:**
- Upload a document — triggers `POST /api/documents/ingest/`
- Watch real-time progress via the SSE event stream (`GET /api/ingestion/jobs/:id/events/`)
- Retry a failed document or individual chunk
- Navigate to Document Detail from any completed document

**API calls:**
- `POST /api/documents/ingest/`
- `GET /api/ingestion/jobs/:id/`
- `GET /api/ingestion/jobs/:id/events/` (SSE)
- `POST /api/documents/:id/retry/`
- `POST /api/documents/:doc_id/chunks/:chunk_id/retry/`

---

## Documents (`/documents`)

**Purpose:** Browse all ingested documents in the active brain.

**What it shows:**
- Document list with title, source type, status, quality score, and ingestion date
- Status indicators (pending / processing / completed / failed)

**Key interactions:**
- Filter by status
- Click a document to navigate to Document Detail
- Delete a document (with confirmation modal)

**API calls:**
- `GET /api/documents/?brain_id=…`
- `DELETE /api/documents/:id/delete/`

---

## Document Detail (`/documents/:id`)

**Purpose:** Deep inspection of a single document's extracted knowledge.

**What it shows:**
- Document metadata (title, quality score, summary, source type)
- Chunk list with text, summary, quality score, and extraction artifact status
- Entities extracted from this document (name, confidence, description)
- Relationships extracted from this document (source → label → target)

**Key interactions:**
- Expand a chunk to view its full text, extraction status, and linked entities
- Retry a failed chunk extraction
- Click an entity to see its description and relationships

**API calls:**
- `GET /api/documents/:id/`
- `GET /api/documents/:id/chunks/`
- `GET /api/documents/:id/entities/`
- `GET /api/documents/:id/relationships/`

---

## Research Chat (`/chat`)

**Purpose:** Ask questions about the knowledge in the active brain and receive source-grounded answers.

**What it shows:**
- Chat message thread with streaming answer rendering
- Source panel: the evidence chunks that grounded the answer, with document and confidence
- Knowledge gaps panel: gaps detected during retrieval
- Confidence badge on each assistant response
- Session history sidebar (prior conversations)

**Key interactions:**
- Submit a question (keyboard shortcut: `Enter`)
- Watch the answer stream token-by-token via SSE
- Expand a source chunk to read the original evidence
- Start a new session or switch to a prior session from the sidebar

**API calls:**
- `POST /api/chat/query/stream/` (SSE — primary path)
- `POST /api/chat/query/` (non-streaming fallback)
- `GET /api/chat/sessions/?brain_id=…`
- `GET /api/chat/sessions/:id/`

---

## Knowledge Graph (`/graph`)

**Purpose:** Visually explore the entity graph built from ingested documents.

**What it shows:**
- Main graph view: entity nodes connected by relationship edges, laid out by ELK
- Node labels (entity names) and edge labels (relationship types)
- Colour/opacity coding for confidence levels
- Isolated entities panel: entities with no relationships (separate tab)
- Node details panel: slides in on node selection — shows entity description, confidence, and linked claims

**Key interactions:**
- Pan and zoom the graph canvas
- Click a node to select it and open the details panel
- Search for an entity by name (centres and highlights the matching node)
- Switch between connected graph and isolated entities tabs

**API calls:**
- `GET /api/graph/?brain_id=…`

---

## Diagnostic Console (`/self-healing`)

**Purpose:** Monitor, review, and execute repair tasks.

**What it shows:**
- Task list filtered by status (pending, running, completed, failed, ignored) and type
- Task cards showing type, trigger entity/document, status, and creation date
- Task detail panel: full `payload` (input) and `result` (output) for selected task
- Auto-repair configuration panel for the active brain

**Key interactions:**
- Run a single task manually
- Ignore a task (marks it so auto-repair skips it)
- Delete a task record
- Run all pending tasks in one action
- Configure auto-repair settings per brain

**API calls:**
- `GET /api/self-healing/tasks/?brain_id=…`
- `POST /api/self-healing/tasks/:id/run/`
- `POST /api/self-healing/tasks/:id/ignore/`
- `DELETE /api/self-healing/tasks/:id/`
- `POST /api/self-healing/run/`
- `GET/PATCH /api/dashboard/brains/:id/`

---

## Related docs

- [frontend/components.md](components.md) — components used inside these pages
- [architecture/frontend.md](../architecture/frontend.md) — routing, state management, streaming
- [backend/api.md](../backend/api.md) — endpoint reference for all calls listed above
