# Knowledge Brain

Knowledge Brain is an autonomous knowledge-engineering agent that ingests unstructured content, converts it into a structured knowledge graph, answers questions with source-grounded retrieval, and self-heals over time — detecting duplicates, missing definitions, and contradictions automatically.

## Why it's different from plain RAG

Standard RAG chunks text and retrieves by similarity. Knowledge Brain goes further:

- **Extracts** entities, claims, and relationships from every chunk using structured LLM output
- **Calibrates** confidence with heuristics — raw model scores are preserved but not trusted directly
- **Retrieves** by combining vector similarity with graph expansion (entity definitions, claims, relationships)
- **Evaluates** every answer for gaps and confidence, and surfaces what it doesn't know
- **Repairs** weak knowledge automatically — merging duplicates, writing missing definitions, flagging contradictions

---

## Tech Stack

### Frontend

| Library | Version | Role |
|---------|---------|------|
| React | 18.3 | UI framework |
| TypeScript | 5.6 | Type safety |
| Vite | 5.4 | Build tool and dev server |
| Chakra UI | 3.35 | Component library |
| React Router | 6.27 | Client-side routing |
| TanStack React Query | 5.59 | Server state, caching, background refetch |
| React Flow | 11.11 | Knowledge graph canvas |
| elkjs | 0.11 | Client-side graph layout (ELK hierarchical) |
| Framer Motion | 12 | Animations |
| React Markdown | 10.1 | Markdown rendering in chat answers |

### Backend

| Library | Version | Role |
|---------|---------|------|
| Python | 3.12 | Runtime |
| Django | 5.1 | Web framework |
| Django REST Framework | 3.15 | REST API |
| Celery | 5.4 | Async task queue |
| Redis | 5.0 (client) | Celery broker and result backend |
| psycopg | 3.2 | PostgreSQL driver |
| pgvector | 0.3.4 | Vector similarity search extension |
| LangChain | 0.3.27 | Structured LLM interactions and output parsing |
| LangGraph | 0.2.39 | StateGraph workflow orchestration |
| langchain-anthropic | 0.2 | Anthropic (Claude) provider |
| langchain-openai | 0.2 | OpenAI provider |
| langchain-google-genai | 2.0 | Google Gemini provider (+ embeddings) |
| PyMuPDF | 1.27 | Primary PDF text extraction |
| pypdf | 4.3 | PDF fallback extraction |
| OCRmyPDF / Tesseract | — | Scanned PDF fallback (via system packages) |
| BeautifulSoup4 | 4.12 | HTML parsing for URL ingestion |

### Infrastructure

| Component | Role |
|-----------|------|
| PostgreSQL 17 + pgvector | Primary database with vector index |
| Redis 7 | Celery broker (db 0) and result backend (db 1) |
| Docker Compose | Full-stack local deployment |
| Celery Beat | Scheduled auto-repair scanning |

---

## Architecture

```
Ingest → Structure → Retrieve → Evaluate → Repair
```

The system combines one queue-based ingestion pipeline with two LangGraph `StateGraph` workflows:

- **Ingestion** — queue-based chunk-level LLM extraction, document-scoped consolidation, knowledge graph persistence
- **Retrieval** — query classification, graph context expansion, vector search, multi-signal reranking, answer synthesis
- **Self-Healing** — task-type-routed repair handlers for duplicates, missing definitions, low-confidence answers, and contradictions

Retrieval embeddings are fixed to Gemini (`gemini-embedding-001`) across all documents and queries to keep the vector space consistent regardless of which generation provider is active. All LLM calls fall back to deterministic logic when no API key is configured.

---

## Key Features

- Document ingestion from text, file upload, and URL
- Parallel chunk extraction with bundled entity/claim/relationship prompts
- Confidence calibration layer — heuristic scoring, not raw LLM values
- Source-grounded chat with streaming answers and confidence scoring
- Knowledge gap detection and surfacing in chat responses
- Interactive knowledge graph (React Flow + ELK layout)
- Self-healing task queue: duplicate merge, definition writing, contradiction review
- Configurable auto-repair scheduling per knowledge brain
- Multi-tenant knowledge brains (isolated domains)
- Optional LangSmith tracing for workflow observability

---

## Quick Start

```bash
cp .env.example .env
# Fill in SECRET_KEY, database/Redis settings, and at least one LLM API key
docker compose up --build
```

Open `http://localhost:5173`.

Full setup instructions, manual venv path, and troubleshooting: [docs/guides/local-setup.md](docs/guides/local-setup.md)

All environment variables explained: [docs/guides/configuration.md](docs/guides/configuration.md)

---

## Documentation

| Section | What it covers |
|---------|---------------|
| [docs/index.md](docs/index.md) | Full documentation index |
| [docs/architecture/overview.md](docs/architecture/overview.md) | System diagram and end-to-end data flow |
| [docs/architecture/backend.md](docs/architecture/backend.md) | Django apps, models, Celery task graph |
| [docs/architecture/frontend.md](docs/architecture/frontend.md) | React routing, state management, streaming |
| [docs/backend/api.md](docs/backend/api.md) | All REST endpoints with request/response examples |
| [docs/backend/ingestion.md](docs/backend/ingestion.md) | V2 pipeline deep-dive: extraction, chunking, confidence calibration |
| [docs/backend/retrieval.md](docs/backend/retrieval.md) | 6-step retrieval: vector search, graph expansion, answer synthesis |
| [docs/backend/self-healing.md](docs/backend/self-healing.md) | Repair task types, handlers, and auto-repair scheduling |
| [docs/frontend/pages.md](docs/frontend/pages.md) | All 8 pages — purpose, interactions, API calls |
| [docs/frontend/components.md](docs/frontend/components.md) | Component library, graph visualisation pattern |
| [docs/guides/local-setup.md](docs/guides/local-setup.md) | Docker Compose and manual venv setup |
| [docs/guides/configuration.md](docs/guides/configuration.md) | All environment variables explained |
| [docs/guides/demo.md](docs/guides/demo.md) | Step-by-step demo walkthrough with talking points |

---

## Repo Layout

```
backend/     Django API, Celery tasks, ingestion / retrieval / self-healing services
frontend/    React app — dashboard, ingest, chat, graph, repair console
docs/        Full documentation
scripts/     Utility scripts (re-embedding, demo helpers)
```
