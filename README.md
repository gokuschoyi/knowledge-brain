# Knowledge Brain

Knowledge Brain is an autonomous knowledge-engineering agent that ingests messy content, converts it into a structured knowledge base, answers questions with source-grounded retrieval, visualises relationships, and self-heals over time.

## Why it is AI-native

This is not just chunk retrieval. Knowledge Brain extracts entities, claims, and relationships, scores knowledge quality, detects duplicates and contradictions, and generates repair tasks when the knowledge base is weak or inconsistent.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Django + Django REST Framework
- PostgreSQL + pgvector
- Redis + Celery
- LangChain for structured LLM interactions
- LangGraph for workflow orchestration
- Provider-selectable OpenAI, Anthropic, and Gemini model support
- Fixed Gemini embeddings for retrieval consistency, with deterministic fallback when needed
- Optional live LLM extraction and answer generation with deterministic fallbacks

## Architecture

`Ingest -> Structure -> Retrieve -> Evaluate -> Repair`

The backend now uses LangGraph `StateGraph` workflows for ingestion, retrieval, and self-healing execution. LangChain powers structured-output extraction and answer synthesis when an LLM is configured, with deterministic fallback logic preserved for local/offline development.

## Key features

- Document ingestion for text, files, and URLs
- Chunking and embeddings
- Entity, claim, and relationship extraction
- Source-grounded chat answers with confidence scoring
- Knowledge graph API and frontend
- Self-healing task queue
- LangGraph-driven ingestion, retrieval, and repair orchestration
- Duplicate entity repair
- Missing definition repair
- Low-confidence answer repair
- Contradiction detection and review

## Running locally

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with the `pgvector` extension and Redis locally, or use Docker Compose.
3. Add API keys if you want live LLM calls.
4. For local venv-based backend testing, set `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, and `POSTGRES_PORT` in `.env`.
5. Choose your default generation provider with `DEFAULT_LLM_PROVIDER` and `DEFAULT_LLM_MODEL`.
6. Retrieval embeddings are fixed to Gemini (`gemini-embedding-001`) to keep the vector space consistent across all documents and queries.
7. Add `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, and/or `OPENAI_API_KEY` depending on which generation providers you want enabled.
8. Optionally set `DATABASE_URL` if you prefer a single connection string override.
9. Run `docker compose up --build` for the full containerized stack, or run the backend/frontend separately in local dev.
10. Open `http://localhost:5173`.

For scanned or image-based PDFs, the Docker backend image already includes the OCR toolchain needed for fallback extraction.

If you are running the backend directly from a local venv instead of Docker, install OCR tools locally so the backend can fall back to OCR:

```bash
sudo apt-get install tesseract-ocr ocrmypdf ghostscript qpdf pngquant unpaper
```

The ingestion pipeline now tries PyMuPDF text extraction first, then pypdf, then OCRmyPDF for scanned PDFs.

If you already ingested documents before enabling live embeddings, refresh the stored vectors with:

```bash
cd backend
source .venv/bin/activate
python ../scripts/reembed_chunks.py
```

## Demo flow

1. Open Dashboard.
2. Ingest one of the sample texts.
3. Watch ingestion progress.
4. Open Knowledge Graph.
5. Ask: `What is Smart Tutor and how does it relate to lesson plans?`
6. Review the answer sources and confidence.
7. Open Self-Healing and run duplicate repair.
8. Run missing definition repair.
9. Ingest conflicting pricing notes.
10. Review the contradiction task.

## Repo layout

- `backend/`: Django API, Celery tasks, ingestion/retrieval/self-healing services
- `frontend/`: React app for dashboard, ingestion, chat, graph, and repair workflows
- `scripts/`: demo helpers
- `docs/`: architecture and demo notes
