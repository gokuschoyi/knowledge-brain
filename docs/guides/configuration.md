# Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in the values before starting the app.

---

## Django Core

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `SECRET_KEY` | Yes | — | Django secret key. Any long random string in development. Must be kept secret in production. |
| `DEBUG` | No | `false` | Set `true` in local dev to enable Django debug mode and verbose error pages. Never `true` in production. |
| `ALLOWED_HOSTS` | No | `*` (in debug) | Comma-separated list of allowed hostnames. Example: `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | No | — | Comma-separated allowed origins for CORS. Example: `http://localhost:5173` |

---

## Network & Ports

These control which ports the services bind to and which ports are exposed on the host.

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `BACKEND_BIND_HOST` | Docker only | `0.0.0.0` | Host the Django server binds to inside the container |
| `BACKEND_PORT` | Docker only | `8000` | Exposed backend port |
| `FRONTEND_BIND_HOST` | Docker only | `0.0.0.0` | Host the Vite dev server binds to |
| `FRONTEND_PORT` | Docker only | `5173` | Exposed frontend port |
| `POSTGRES_PORT` | Docker only | `5432` | Internal Postgres port |
| `POSTGRES_HOST_PORT` | Docker only | `5432` | Host-side Postgres port |
| `REDIS_PORT` | Docker only | `6379` | Internal Redis port |
| `REDIS_HOST_PORT` | Docker only | `6379` | Host-side Redis port |
| `VITE_API_BASE_URL` | Yes (frontend) | `http://localhost:8000` | The base URL the frontend uses to reach the backend API |

---

## Database

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `POSTGRES_DB` | Yes | `knowledge_brain` | Database name |
| `POSTGRES_USER` | Yes | `kb` | Postgres username |
| `POSTGRES_PASSWORD` | Yes | `kb` | Postgres password |
| `POSTGRES_HOST` | Yes | `localhost` / `db` | `localhost` for manual setup; `db` (the Docker service name) inside Docker Compose |
| `DATABASE_URL` | No | — | Optional single-string override. If set, takes precedence over the individual `POSTGRES_*` vars. Format: `postgres://user:pass@host:port/db` |

---

## Redis & Celery

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `REDIS_URL` | Yes | `redis://localhost:6379/0` | Used by Django for general Redis access |
| `CELERY_BROKER_URL` | Yes | `redis://localhost:6379/0` | Celery task broker. Uses Redis database 0. |
| `CELERY_RESULT_BACKEND` | Yes | `redis://localhost:6379/1` | Celery result storage. Uses Redis database 1 to separate from the broker. |
| `CELERY_TASK_DEFAULT_QUEUE` | Yes | `default` | Name of the main Celery queue for standard tasks |

---

## Ingestion

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `INGESTION_V2_CHUNK_QUEUE` | Yes | `ingestion_chunk_extraction` | Dedicated Celery queue name for parallel chunk extraction tasks |
| `INGESTION_V2_MAX_PARALLEL_CHUNK_TASKS` | Yes | `5` | Celery worker concurrency for the ingestion queue. Higher values speed up extraction but require more memory and LLM API capacity. |
| `EXTRACTION_MAX_ENTITIES` | No | `20` | Maximum number of entities to extract per chunk. |
| `EXTRACTION_MAX_CLAIMS` | No | `30` | Maximum number of claims to extract per chunk. |
| `EXTRACTION_MAX_RELATIONSHIPS` | No | `20` | Maximum number of relationships to extract per chunk. |
| `EXTRACTION_MAX_OUTPUT_TOKENS` | No | `2048` | Maximum output token limit for extraction requests. |
| `MAX_UPLOAD_MB` | No | `50` | Maximum file upload size in megabytes |

---

## LLM Providers

Knowledge Brain supports three providers. Add keys for whichever ones you want enabled. If none are set, the app runs with deterministic fallbacks (no LLM calls).

| Variable | Required | Notes |
|----------|----------|-------|
| `DEFAULT_LLM_PROVIDER` | Yes (for live LLM) | Active generation provider: `openai`, `anthropic`, or `google` |
| `DEFAULT_LLM_MODEL` | Yes (for live LLM) | Model ID for the selected provider. Examples: `claude-sonnet-4-6`, `gpt-4o`, `gemini-2.0-flash` |
| `GOOGLE_API_KEY` | Yes* | Required for Gemini embeddings (used regardless of generation provider). Also required if `DEFAULT_LLM_PROVIDER=google`. |
| `ANTHROPIC_API_KEY` | No | Required if `DEFAULT_LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | No | Required if `DEFAULT_LLM_PROVIDER=openai` |
| `OPENAI_EMBEDDING_MODEL` | No | OpenAI embedding model override (not the default embedding path — Gemini is used for embeddings) |
| `OPENAI_CHAT_MODEL` | No | OpenAI chat model override |

**Important:** Retrieval embeddings are **always** generated using Gemini (`gemini-embedding-001`), regardless of the generation provider. This keeps the vector space consistent across all documents and queries. `GOOGLE_API_KEY` is required even if your generation provider is Anthropic or OpenAI.

---

## Auto-Repair Scheduling

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `AUTO_REPAIR_BEAT_INTERVAL_MINUTES` | No | `60` | How often Celery Beat checks which brains are due for auto-repair. Separate from per-brain `auto_repair_interval_hours`. |

---

## Observability (Optional)

| Variable | Required | Notes |
|----------|----------|-------|
| `LANGSMITH_TRACING` | No | `true` or `false`. Enables LangSmith tracing for LangGraph workflow runs. |
| `LANGSMITH_ENDPOINT` | No | LangSmith API endpoint URL |
| `LANGSMITH_API_KEY` | No | LangSmith API key |
| `LANGSMITH_PROJECT` | No | Project name in LangSmith for grouping traces |

LangSmith is optional and has no effect on app behaviour when disabled. It provides full trace inspection of ingestion, retrieval, and self-healing workflows — useful during development.
