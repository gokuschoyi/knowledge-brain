# Components

The component tree is organised by feature. Pages are thin orchestrators; logic and UI live in feature-specific component folders.

---

## Folder Structure

```
src/components/
├── brains/         ← Brain selection and management
├── chat/           ← Chat interface and panels
├── dashboard/      ← Metrics and quality indicators
├── documents/      ← Document browsing and detail
├── graph/          ← Knowledge graph visualisation
├── ingest/         ← Upload form and progress tracking
├── selfHealing/    ← Task cards and repair console
├── common/         ← Shared stateless primitives
├── ui/             ← Base design-system components
└── layout/         ← App shell (sidebar, header)
```

---

## Layout

`layout/` provides the persistent app shell that wraps all pages. It renders:
- The sidebar with navigation links to all 8 pages
- The brain selector (reads/writes `BrainContext`)
- The page header (title + subtitle from the route `handle`)
- The main content area where page components render

---

## Chat Components

| Component | Purpose |
|-----------|---------|
| `ChatWindow.tsx` | Renders the message thread. Manages the SSE connection for streaming, feeds tokens into `MessageBubble` components as they arrive. |
| `MessageBubble.tsx` | Renders a single chat turn (user or assistant). Assistant bubbles include a confidence badge and expand/collapse for source citations. |
| `SourcePanel.tsx` | Slide-in panel showing the source chunks that grounded an assistant answer. Each source shows document title, chunk text, and relevance score. |
| `KnowledgeGapPanel.tsx` | Slide-in panel listing the knowledge gaps detected for an answer. Prompts the user to consider ingesting more relevant documents. |
| `ChatHistorySidebar.tsx` | Lists prior chat sessions for the active brain. Clicking a session loads its message history. |
| `ConfidenceBadge.tsx` | Colour-coded badge showing the answer confidence score (green → amber → red). |

---

## Graph Components

| Component | Purpose |
|-----------|---------|
| `ElkKnowledgeGraphView.tsx` | Main graph canvas. Calls the ELK layout engine client-side, then passes positioned nodes and edges to React Flow for rendering. Handles pan, zoom, search, and selection. |
| `KnowledgeGraphView.tsx` | Wrapper that fetches graph data from the API and passes it to the ELK view. Manages the tab bar. |
| `GraphTabBar.tsx` | Switches between the connected graph tab and the isolated entities tab. |
| `IsolatedEntitiesPanel.tsx` | Renders isolated entities (no relationships) as a filterable card list instead of a graph — a graph with one node per card is not useful. |
| `NodeDetailsPanel.tsx` | Slide-in panel that appears when a graph node is selected. Shows entity name, description, confidence, aliases, and linked claims. |
| `GraphLegend.tsx` | Key explaining node colours and edge types. |

### ELK Layout

The graph uses [ELK](https://eclipse.dev/elk/) (Eclipse Layout Kernel) via `elkjs`. When graph data loads:
1. Entity nodes and relationship edges are converted to ELK's input format
2. ELK runs a layered hierarchical layout algorithm client-side (no server round-trip)
3. Computed `x`/`y` positions are mapped back to React Flow node objects
4. React Flow renders the final positioned graph

ELK was chosen over React Flow's built-in layout because it handles large, densely connected graphs more predictably.

---

## Ingest Components

| Component | Purpose |
|-----------|---------|
| `IngestForm.tsx` | Tabs for three source types (text, file, URL). Handles file drag-and-drop. Includes source authority, optional published date, and model provider/model selector populated from `GET /api/models/`. |
| `IngestionProgress.tsx` | Connects to the SSE event stream for a job and renders a live stage-by-stage progress view. Shows per-chunk artifact status with pass/fail counts. |
| `DocumentList.tsx` | Recent documents list shown below the upload form. Provides quick access to retry failed documents or navigate to detail. |

---

## Self-Healing Components

| Component | Purpose |
|-----------|---------|
| Task card (inline) | Compact summary: task type, outcome-aware status badge, related entity/document, creation date. Action buttons: Run, Add evidence, Ignore, Delete. |
| Task detail panel | Full inspection of `payload` (repair input) and `result` (repair output). Highlights `resolved`, `unresolved`, and `review_required` outcomes rather than generic completion. |
| `EvidenceUploadDialog.tsx` | Task-scoped evidence attachment flow that creates a normal ingestion job in the active brain from pasted text, file upload, or URL. |
| Auto-repair config panel | Toggle and interval controls for the active brain's auto-repair settings. Submits via `PATCH /api/dashboard/brains/:id/`. |

---

## Common and UI

`common/` contains stateless, context-free primitives reused across features:
- `LoadingState.tsx` — spinner with optional label, used during data fetching
- `Card.tsx` — styled container with consistent padding and border

`ui/` contains base design-system components built on Chakra UI. These are the lowest-level building blocks (custom buttons, modals, badges) that enforce the visual language across the app.

---

## Composition Pattern

Pages are thin. A typical page:

```tsx
export function SelfHealingPage() {
  const { brainId } = useBrainContext();
  const { data: tasks } = useSelfHealingTasks(brainId);

  return (
    <PageLayout>
      <AutoRepairConfig brainId={brainId} />
      <TaskList tasks={tasks} />
    </PageLayout>
  );
}
```

The page fetches data via a React Query hook and passes it down. Feature components handle their own local UI state (selected item, open/close panel) using `useState`. Nothing lives in global state that does not need to be shared.

---

## Related docs

- [frontend/pages.md](pages.md) — which components each page uses
- [architecture/frontend.md](../architecture/frontend.md) — state management and API client patterns
