# Local Setup

Two ways to run Knowledge Brain locally: Docker Compose (recommended, requires nothing extra) or a manual venv setup (useful for backend-only development).

---

## Prerequisites

- Docker Desktop (for the Docker path)
- Node.js 20+ (for the manual frontend path)
- Python 3.12+ (for the manual backend path)
- At least one LLM provider API key (Anthropic, OpenAI, or Google) — optional, the app runs with deterministic fallbacks if none are set

---

## Option A — Docker Compose (Recommended)

This path starts PostgreSQL + pgvector, Redis, the Django backend, two Celery workers, Celery Beat, and the Vite dev server in one command.

**1. Copy the environment file:**
```bash
cp .env.example .env
```

**2. Fill in your `.env`** — see [guides/configuration.md](configuration.md) for every variable explained. At minimum:

```bash
# Django
DEBUG=true
SECRET_KEY=any-long-random-string

# Ports (pick values that don't conflict with local services)
BACKEND_BIND_HOST=0.0.0.0
BACKEND_PORT=8000
FRONTEND_BIND_HOST=0.0.0.0
FRONTEND_PORT=5173
POSTGRES_PORT=5432
POSTGRES_HOST_PORT=5432
REDIS_PORT=6379
REDIS_HOST_PORT=6379

# Database
POSTGRES_DB=knowledge_brain
POSTGRES_USER=kb
POSTGRES_PASSWORD=kb
POSTGRES_HOST=db

# Redis / Celery
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
CELERY_TASK_DEFAULT_QUEUE=default

# Ingestion
EXTRACTION_VERSION=V2
INGESTION_V2_CHUNK_QUEUE=ingestion
INGESTION_V2_MAX_PARALLEL_CHUNK_TASKS=4

# LLM (add at least one)
GOOGLE_API_KEY=your-key-here     # required for Gemini embeddings
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_LLM_MODEL=claude-sonnet-4-6

# Frontend
VITE_API_BASE_URL=http://localhost:8000

# Auto-repair
AUTO_REPAIR_BEAT_INTERVAL_MINUTES=30
```

**3. Start everything:**
```bash
docker compose up --build
```

**4. Open the app:** `http://localhost:5173`

Django admin: `http://localhost:8000/admin/` (create a superuser with `docker compose exec backend python manage.py createsuperuser`).

---

## Option B — Manual Setup

Useful when you want to run only the backend for API testing, or when you prefer native hot-reload without Docker.

### Backend

```bash
# Create and activate venv
cd backend
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install OCR tools (for scanned PDF fallback)
sudo apt-get install tesseract-ocr ocrmypdf ghostscript qpdf pngquant unpaper

# Copy and fill .env
cp ../.env.example ../.env
# Edit .env — set POSTGRES_HOST=localhost and REDIS_URL=redis://localhost:6379/0

# Run migrations
python manage.py migrate

# Start Django dev server
python manage.py runserver 0.0.0.0:8000
```

In a separate terminal, start the Celery workers:

```bash
cd backend
source .venv/bin/activate

# Default queue worker
celery -A config worker -l info -Q default

# Ingestion queue worker (separate terminal)
celery -A config worker -l info -Q ingestion -c 4

# Beat scheduler (separate terminal)
celery -A config beat -l info
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # if it exists, or create one
echo "VITE_API_BASE_URL=http://localhost:8000" >> .env.local
npm run dev
```

Open `http://localhost:5173`.

---

## Re-embedding Chunks

If you ingest documents before enabling live Gemini embeddings (e.g. you start with the app in offline mode and then add `GOOGLE_API_KEY`), refresh the stored vectors:

```bash
cd backend
source .venv/bin/activate
python ../scripts/reembed_chunks.py
```

---

## Common Issues

**Port conflicts:** If `5432`, `6379`, or `8000` are in use, change `POSTGRES_HOST_PORT`, `REDIS_HOST_PORT`, or `BACKEND_PORT` in `.env`. The internal container ports (`POSTGRES_PORT`, `REDIS_PORT`) stay the same.

**pgvector extension:** The `pgvector/pgvector:pg17-trixie` Docker image includes the extension. If you use a local Postgres instance, install pgvector manually and run `CREATE EXTENSION IF NOT EXISTS vector;` in your database.

**No LLM responses:** The app runs without API keys using deterministic fallbacks. Ingested documents will have empty entity descriptions and answers will be verbatim chunk excerpts. To enable LLM extraction, add at least one provider key and set `DEFAULT_LLM_PROVIDER` and `DEFAULT_LLM_MODEL`.

**Scanned PDFs not extracting:** OCR requires the toolchain to be installed. In Docker this is automatic. In the manual setup, run the `apt-get install` command above.
