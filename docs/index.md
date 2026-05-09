# Knowledge Brain — Documentation

This index is the starting point for understanding how Knowledge Brain is built, how to run it, and how to explore or demo it.

---

## Architecture

High-level system design, data flow, and structural decisions.

| Document | What it covers |
|----------|---------------|
| [architecture/overview.md](architecture/overview.md) | End-to-end system diagram, the `Ingest → Structure → Retrieve → Repair` pipeline, and the six backend apps |
| [architecture/backend.md](architecture/backend.md) | Django app breakdown, key models, Celery task graph, Redis role |
| [architecture/frontend.md](architecture/frontend.md) | React page routing, state management, API client layer, streaming |

---

## Backend

Implementation detail for each backend subsystem.

| Document | What it covers |
|----------|---------------|
| [backend/api.md](backend/api.md) | All REST endpoints — method, path, request params, response shape |
| [backend/ingestion.md](backend/ingestion.md) | V2 pipeline deep-dive: text extraction, chunking, bundled LLM extraction, confidence calibration |
| [backend/retrieval.md](backend/retrieval.md) | 6-step retrieval flow: vector search, graph expansion, reranking, gap detection, answer synthesis |
| [backend/self-healing.md](backend/self-healing.md) | Task types, detection logic, repair handlers, auto-repair scheduling |

---

## Frontend

UI structure, pages, and component patterns.

| Document | What it covers |
|----------|---------------|
| [frontend/pages.md](frontend/pages.md) | All 8 pages — purpose, key interactions, API endpoints used |
| [frontend/components.md](frontend/components.md) | Component folder layout, key shared components, graph visualisation pattern |

---

## Guides

Practical guides for getting up and running.

| Document | What it covers |
|----------|---------------|
| [guides/local-setup.md](guides/local-setup.md) | Docker Compose setup (recommended) and manual venv setup |
| [guides/configuration.md](guides/configuration.md) | All environment variables explained with purpose and defaults |
| [guides/demo.md](guides/demo.md) | Step-by-step demo walkthrough with talking points |
