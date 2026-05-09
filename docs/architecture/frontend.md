# Frontend Architecture

The frontend is a React 18 + TypeScript application built with Vite. It uses React Query for all server state, React Context for app-level state, and React Router for navigation. Styling is handled by Chakra UI with Tailwind CSS utilities.

---

## Page Routing

All pages are children of the root `App` layout component, which renders the persistent sidebar and header. Route definitions live in [src/routes.tsx](../../frontend/src/routes.tsx).

| Path | Page Component | Title |
|------|---------------|-------|
| `/` | `DashboardPage` | System Overview |
| `/brains` | `BrainsPage` | Knowledge Brains |
| `/documents` | `DocumentsPage` | Documents |
| `/documents/:id` | `DocumentDetailPage` | Document Intelligence |
| `/chat` | `ChatPage` | Research Chat |
| `/ingest` | `IngestPage` | Ingest Docs |
| `/graph` | `KnowledgeGraphPage` | Knowledge Graph |
| `/self-healing` | `SelfHealingPage` | Diagnostic Console |

Each route has a `handle` object carrying `title` and `subtitle` strings that the layout renders in the page header.

---

## State Management

Knowledge Brain separates server state from app state:

**React Query** (`@tanstack/react-query`) — all API calls and server state. Provides caching, background refetching, loading/error states, and invalidation. Every feature module has its own query hooks in `src/api/`.

**React Context** — app-level state that spans pages:
- `BrainContext` — the currently selected brain ID. Passed as a query param to most API calls so all pages display data for the same brain.

There is no Redux or Zustand. The rule is: if it comes from the server, React Query owns it; if it needs to be shared between unrelated page trees, Context owns it.

---

## API Client Layer

All API calls are defined in [src/api/](../../frontend/src/api/). Each file corresponds to a backend feature:

| File | Covers |
|------|--------|
| `documents.ts` | Document list, detail, ingest, delete, retry |
| `ingestion.ts` | Ingestion job detail and SSE event stream |
| `chat.ts` | Chat query (POST) and streaming query (SSE) |
| `graph.ts` | Knowledge graph endpoint |
| `entities.ts` | Entity list, detail, relationships |
| `claims.ts` | Claim list |
| `selfHealing.ts` | Task list, run task, ignore task, run all |
| `dashboard.ts` | Dashboard metrics |
| `brains.ts` | Brain CRUD |
| `models.ts` | Model catalog |

The base URL is configured via the `VITE_API_BASE_URL` environment variable and defaults to `http://localhost:8000` in development.

---

## Streaming Responses

Two flows use Server-Sent Events (SSE) rather than standard JSON responses:

**Chat streaming** (`POST /api/chat/query/stream/`) — the browser opens a persistent connection and receives a sequence of events:
- `{ type: "status", message: "retrieval_started" }` — early feedback
- `{ type: "chunk", content: "…" }` — streaming answer tokens
- `{ type: "sources", sources: […] }` — grounded source chunks
- `{ type: "confidence", score: 0.82 }` — final confidence
- `{ type: "gaps", gaps: […] }` — any detected knowledge gaps
- `{ type: "done" }` — stream complete

**Ingestion events** (`GET /api/ingestion/jobs/:id/events/`) — emits stage progress events as the pipeline advances through extraction, chunking, LLM extraction, and finalization.

Both streams are consumed using `EventSource` (or `fetch` with `ReadableStream`) and feed into React Query's cache invalidation on completion.

---

## Component Structure

```
src/
├── pages/          ← 8 feature pages (one per route)
├── components/
│   ├── brains/     ← Brain selector, creation modal
│   ├── chat/       ← ChatWindow, MessageBubble, SourcePanel, KnowledgeGapPanel, ChatHistorySidebar
│   ├── dashboard/  ← Metric cards, quality indicators
│   ├── documents/  ← Document list, document detail, chunk views
│   ├── graph/      ← ElkKnowledgeGraphView, NodeDetailsPanel, IsolatedEntitiesPanel
│   ├── ingest/     ← IngestForm, IngestionProgress, DocumentList
│   ├── selfHealing/← Task cards, task detail panel, results view
│   ├── common/     ← LoadingState, error boundaries, shared Card
│   ├── ui/         ← Base design-system components
│   └── layout/     ← App shell, sidebar, header
├── api/            ← API client functions + React Query hooks
├── context/        ← BrainContext
└── routes.tsx      ← createBrowserRouter config
```

Pages are kept thin: they compose feature components and pass data via props. Logic lives in React Query hooks and component state, not in pages.

---

## Graph Visualisation

The knowledge graph page uses [React Flow](https://reactflow.dev/) for node/edge rendering and [ELK](https://eclipse.dev/elk/) (Eclipse Layout Kernel) for automatic layout computation.

The flow:
1. `GET /api/graph/?brain_id=…` returns `connected_graph` (entities + relationships) and `isolated_entities`
2. ELK runs client-side to compute node positions using a layered hierarchical algorithm
3. React Flow renders the positioned graph with custom node and edge components
4. A `NodeDetailsPanel` slides in when a node is selected, showing entity description, confidence, and linked claims

The graph tab bar switches between the connected graph view and the isolated entities panel without a full page reload.

---

## Related docs

- [frontend/pages.md](../frontend/pages.md) — each page described in detail
- [frontend/components.md](../frontend/components.md) — component library and key shared components
- [architecture/overview.md](overview.md) — system-level context
