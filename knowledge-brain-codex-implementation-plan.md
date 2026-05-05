# Knowledge Brain — Codex Implementation Plan

## 0. Project Summary

Build a monorepo application called **Knowledge Brain**.

Knowledge Brain is an autonomous knowledge-engineering agent that ingests messy information, converts it into a structured knowledge base, provides source-grounded retrieval, visualises the knowledge graph, and self-heals over time.

The project must include:

- A React frontend for ingestion, chat, graph visualisation, and self-healing management.
- A Django backend for document ingestion, retrieval, knowledge extraction, and agent workflows.
- PostgreSQL with pgvector for vector search.
- Redis and Celery for background ingestion and self-healing jobs.
- LLM-powered extraction, retrieval, and repair workflows.
- A clear demo path showing that the system can ingest content, answer questions, detect issues, and improve itself.

Primary goal: **Do not build a basic RAG chatbot. Build an autonomous knowledge maintenance system.**

---

## 1. Judging Criteria Alignment

The app is intended for a challenge where the judging criteria are:

1. AI-nativeness: is the agent truly autonomous?
2. Creativity and ambition: bold ideas over safe ones.
3. Does it work? It must handle real-world messy content.
4. Code quality: clean structure, clear thinking, reliable implementation.

Implementation should therefore prioritise:

- Real ingestion pipeline, not mocked data.
- Structured extraction into entities, claims, and relationships.
- Hybrid retrieval using vector search plus graph context.
- Self-healing tasks that are visible and runnable.
- Clean service boundaries in the backend.
- A simple but polished frontend.

---

## 2. Recommended Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query or RTK Query
- React Flow for graph visualisation
- EventSource/SSE for ingestion progress

### Backend

- Django
- Django REST Framework
- PostgreSQL
- pgvector
- Celery
- Redis
- Python LLM client of choice

### AI / Agent Layer

Recommended options:

- OpenAI API for embeddings and LLM calls
- LangGraph for agent workflows, optional but recommended
- Simple service classes first, LangGraph orchestration later if time is limited

### DevOps

- Single Git repository
- Docker Compose for local development
- `.env.example`
- Clear README
- Seed/demo script

---

## 3. Monorepo Structure

Create the project as a single repo:

```txt
knowledge-brain/
  README.md
  docker-compose.yml
  docker-compose.dev.yml
  .env.example
  .gitignore

  backend/
    Dockerfile
    requirements.txt
    manage.py
    config/
      __init__.py
      settings.py
      urls.py
      asgi.py
      wsgi.py
      celery.py

    apps/
      core/
        __init__.py
        models.py
        utils.py

      documents/
        __init__.py
        models.py
        serializers.py
        views.py
        urls.py
        tasks.py
        services/
          text_extraction.py
          text_cleaning.py
          chunking.py
          ingestion_pipeline.py
          ingestion_progress.py

      knowledge/
        __init__.py
        models.py
        serializers.py
        views.py
        urls.py
        services/
          entity_extraction.py
          claim_extraction.py
          relationship_extraction.py
          graph_builder.py
          quality_scoring.py
          contradiction_detector.py
          duplicate_detector.py

      retrieval/
        __init__.py
        serializers.py
        views.py
        urls.py
        services/
          query_classifier.py
          embedding.py
          vector_search.py
          graph_search.py
          reranker.py
          answer_generator.py
          confidence.py

      self_healing/
        __init__.py
        models.py
        serializers.py
        views.py
        urls.py
        tasks.py
        services/
          task_generator.py
          duplicate_entity_repair.py
          missing_definition_repair.py
          low_confidence_repair.py
          contradiction_repair.py
          repair_runner.py

      agents/
        __init__.py
        ingestion_agent.py
        structuring_agent.py
        retrieval_agent.py
        quality_agent.py
        self_healing_agent.py
        prompts.py

  frontend/
    Dockerfile
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    src/
      main.tsx
      App.tsx
      routes.tsx
      styles.css

      api/
        client.ts
        documents.ts
        chat.ts
        graph.ts
        selfHealing.ts
        dashboard.ts

      pages/
        Dashboard.tsx
        Ingest.tsx
        Chat.tsx
        KnowledgeGraph.tsx
        SelfHealing.tsx
        DocumentDetail.tsx

      components/
        layout/
          AppShell.tsx
          Sidebar.tsx
          Topbar.tsx

        ingest/
          IngestForm.tsx
          IngestionProgress.tsx
          DocumentList.tsx

        chat/
          ChatWindow.tsx
          MessageBubble.tsx
          SourcePanel.tsx
          ConfidenceBadge.tsx
          KnowledgeGapPanel.tsx

        graph/
          KnowledgeGraphView.tsx
          NodeDetailsPanel.tsx
          GraphLegend.tsx

        selfHealing/
          TaskList.tsx
          TaskCard.tsx
          RepairResultPanel.tsx

        common/
          Button.tsx
          Card.tsx
          Badge.tsx
          EmptyState.tsx
          LoadingState.tsx

  scripts/
    seed_demo_data.py
    reset_local_db.sh

  docs/
    architecture.md
    demo-script.md
```

---

## 4. Main User Flows

### Flow 1: Ingest content

1. User opens the Ingest page.
2. User enters a title.
3. User chooses source type.
4. User either uploads a PDF/text file, pastes text, or adds a URL.
5. Frontend submits to backend.
6. Backend creates an ingestion job.
7. Celery processes the job.
8. Frontend shows progress using polling or SSE.
9. When complete, user can view created chunks, entities, relationships, and self-healing tasks.

### Flow 2: Ask a question

1. User opens Chat page.
2. User asks a question.
3. Backend classifies query intent.
4. Backend performs vector search.
5. Backend extracts entities from query.
6. Backend expands context using graph relationships.
7. Backend generates an answer with citations.
8. Backend calculates confidence score.
9. If confidence is low, backend creates a self-healing task.
10. Frontend displays answer, sources, confidence, and gaps.

### Flow 3: View knowledge graph

1. User opens Knowledge Graph page.
2. Frontend fetches graph data from backend.
3. React Flow renders nodes and edges.
4. User clicks entity/document/claim node.
5. Side panel shows metadata, sources, confidence, and connected items.

### Flow 4: Self-heal

1. User opens Self-Healing page.
2. Frontend lists generated repair tasks.
3. User clicks Run on a task.
4. Backend runs the corresponding repair service.
5. Task status updates.
6. Graph and retrieval quality improve.
7. Repair result is logged.

---

## 5. Backend Models

### 5.1 Document

```python
class Document(models.Model):
    STATUS_PENDING = "pending"
    STATUS_PROCESSING = "processing"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    SOURCE_TEXT = "text"
    SOURCE_FILE = "file"
    SOURCE_URL = "url"

    title = models.CharField(max_length=255)
    source_type = models.CharField(max_length=50)
    raw_text = models.TextField(blank=True)
    raw_file = models.FileField(upload_to="documents/", null=True, blank=True)
    url = models.URLField(blank=True)
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=50, default=STATUS_PENDING)
    summary = models.TextField(blank=True)
    quality_score = models.FloatField(default=0)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 5.2 IngestionJob

```python
class IngestionJob(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="ingestion_jobs")
    status = models.CharField(max_length=50, default="pending")
    current_step = models.CharField(max_length=100, blank=True)
    progress = models.IntegerField(default=0)
    log = models.JSONField(default=list, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 5.3 Chunk

```python
from pgvector.django import VectorField

class Chunk(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="chunks")
    text = models.TextField()
    summary = models.TextField(blank=True)
    chunk_index = models.IntegerField()
    token_count = models.IntegerField(default=0)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    importance_score = models.FloatField(default=0)
    quality_score = models.FloatField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["document_id", "chunk_index"]
```

### 5.4 Entity

```python
class Entity(models.Model):
    name = models.CharField(max_length=255)
    canonical_name = models.CharField(max_length=255, blank=True)
    entity_type = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    confidence = models.FloatField(default=0)
    embedding = VectorField(dimensions=1536, null=True, blank=True)
    aliases = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["name"])]
```

### 5.5 ChunkEntityMention

```python
class ChunkEntityMention(models.Model):
    chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="entity_mentions")
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name="mentions")
    mention_text = models.CharField(max_length=255)
    confidence = models.FloatField(default=0)
```

### 5.6 Claim

```python
class Claim(models.Model):
    text = models.TextField()
    source_chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="claims")
    subject_entity = models.ForeignKey(Entity, null=True, blank=True, on_delete=models.SET_NULL, related_name="claims")
    confidence = models.FloatField(default=0)
    verified_status = models.CharField(max_length=50, default="unverified")
    created_at = models.DateTimeField(auto_now_add=True)
```

### 5.7 Relationship

```python
class Relationship(models.Model):
    source_entity = models.ForeignKey(Entity, related_name="outgoing_relationships", on_delete=models.CASCADE)
    target_entity = models.ForeignKey(Entity, related_name="incoming_relationships", on_delete=models.CASCADE)
    relationship_type = models.CharField(max_length=100)
    evidence_chunk = models.ForeignKey(Chunk, on_delete=models.CASCADE, related_name="relationships")
    confidence = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["relationship_type"]),
        ]
```

### 5.8 ChatSession and ChatMessage

```python
class ChatSession(models.Model):
    title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ChatMessage(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=50)
    content = models.TextField()
    confidence_score = models.FloatField(null=True, blank=True)
    sources = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### 5.9 SelfHealingTask

```python
class SelfHealingTask(models.Model):
    TYPE_DUPLICATE_ENTITY = "duplicate_entity"
    TYPE_MISSING_DEFINITION = "missing_definition"
    TYPE_LOW_CONFIDENCE_ANSWER = "low_confidence_answer"
    TYPE_CONTRADICTION = "contradiction"
    TYPE_ORPHAN_CHUNK = "orphan_chunk"

    STATUS_PENDING = "pending"
    STATUS_RUNNING = "running"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"
    STATUS_IGNORED = "ignored"

    task_type = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default=STATUS_PENDING)
    priority = models.IntegerField(default=1)
    title = models.CharField(max_length=255)
    description = models.TextField()
    related_document = models.ForeignKey(Document, null=True, blank=True, on_delete=models.SET_NULL)
    related_chunk = models.ForeignKey(Chunk, null=True, blank=True, on_delete=models.SET_NULL)
    related_entity = models.ForeignKey(Entity, null=True, blank=True, on_delete=models.SET_NULL)
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
```

---

## 6. Backend API Endpoints

### 6.1 Documents

```http
POST   /api/documents/ingest/
GET    /api/documents/
GET    /api/documents/:id/
GET    /api/documents/:id/chunks/
GET    /api/documents/:id/entities/
GET    /api/documents/:id/relationships/
```

#### POST /api/documents/ingest/

Accept multipart or JSON.

Payload for text:

```json
{
  "title": "Product Notes",
  "source_type": "text",
  "raw_text": "...",
  "tags": ["demo", "product"]
}
```

Payload for URL:

```json
{
  "title": "Company Docs",
  "source_type": "url",
  "url": "https://example.com/docs",
  "tags": ["web"]
}
```

Response:

```json
{
  "document_id": 1,
  "job_id": 1,
  "status": "pending"
}
```

### 6.2 Ingestion Jobs

```http
GET /api/ingestion/jobs/:id/
GET /api/ingestion/jobs/:id/events/
```

Polling response:

```json
{
  "id": 1,
  "status": "processing",
  "current_step": "extracting_entities",
  "progress": 60,
  "log": [
    {"step": "text_extracted", "message": "Extracted 4200 characters"},
    {"step": "chunked", "message": "Created 12 chunks"}
  ]
}
```

### 6.3 Chat / Retrieval

```http
POST /api/chat/query/
GET  /api/chat/sessions/
GET  /api/chat/sessions/:id/
```

Payload:

```json
{
  "session_id": null,
  "question": "What does the knowledge base say about the training plan?"
}
```

Response:

```json
{
  "answer": "...",
  "confidence_score": 0.78,
  "sources": [
    {
      "document_id": 1,
      "document_title": "Migration Notes",
      "chunk_id": 4,
      "snippet": "..."
    }
  ],
  "related_entities": [
    {"id": 1, "name": "407 visa", "type": "visa"}
  ],
  "knowledge_gaps": [
    "The exact training plan duration is not clearly defined."
  ],
  "self_healing_task_created": true
}
```

### 6.4 Knowledge Graph

```http
GET /api/graph/
GET /api/entities/
GET /api/entities/:id/
GET /api/entities/:id/relationships/
GET /api/claims/
```

Graph response:

```json
{
  "nodes": [
    {
      "id": "entity-1",
      "type": "entity",
      "label": "Smart Tutor",
      "data": {
        "entity_id": 1,
        "entity_type": "product_feature",
        "confidence": 0.91,
        "description": "..."
      }
    }
  ],
  "edges": [
    {
      "id": "rel-1",
      "source": "entity-1",
      "target": "entity-2",
      "label": "generates",
      "data": {
        "relationship_id": 1,
        "confidence": 0.82
      }
    }
  ]
}
```

### 6.5 Self-Healing

```http
GET  /api/self-healing/tasks/
POST /api/self-healing/tasks/:id/run/
POST /api/self-healing/tasks/:id/ignore/
POST /api/self-healing/run/
```

Task response:

```json
{
  "id": 1,
  "task_type": "missing_definition",
  "status": "pending",
  "priority": 2,
  "title": "Generate missing definition for Smart Tutor",
  "description": "The entity appears in 8 chunks but has no description.",
  "payload": {
    "entity_id": 7
  }
}
```

---

## 7. Ingestion Pipeline

Implement ingestion as a Celery task.

### 7.1 Pipeline Steps

```txt
Document submitted
  ↓
Create IngestionJob
  ↓
Extract text
  ↓
Clean text
  ↓
Semantic chunking
  ↓
Generate embeddings
  ↓
Generate chunk summaries
  ↓
Extract entities
  ↓
Extract claims
  ↓
Extract relationships
  ↓
Build graph records
  ↓
Score quality
  ↓
Generate self-healing tasks
  ↓
Mark document completed
```

### 7.2 Text Extraction

Support initially:

- `.txt`
- `.md`
- `.pdf`
- pasted text
- URLs if time allows

Implementation guidance:

- For PDF, use `pypdf` first.
- If extraction is poor, create a `low_quality_extraction` self-healing task.
- For URLs, use `requests` + `BeautifulSoup` initially.

### 7.3 Chunking

Use semantic-ish chunking:

- Split by headings if available.
- Then split by paragraphs.
- Keep target chunk size around 700 to 1200 tokens.
- Add overlap around 100 to 150 tokens.

Each chunk should store:

- raw text
- summary
- token estimate
- embedding
- quality score
- source metadata

### 7.4 Progress Updates

Each stage should update `IngestionJob`:

```python
update_progress(job, step="chunking", progress=30, message="Created 12 chunks")
```

Frontend can poll every 1 to 2 seconds or use SSE.

Start with polling if faster.

---

## 8. LLM Prompt Contracts

Keep LLM outputs structured JSON. Validate every response.

### 8.1 Entity Extraction Prompt

Input:

- chunk text
- document title

Output JSON:

```json
{
  "entities": [
    {
      "name": "Smart Tutor",
      "type": "product_feature",
      "description": "AI-powered tutor feature",
      "confidence": 0.91,
      "aliases": ["AI Tutor"]
    }
  ]
}
```

Rules:

- Extract only important entities.
- Do not extract generic terms unless they are central.
- Use stable names.
- Include confidence between 0 and 1.

### 8.2 Claim Extraction Prompt

Output JSON:

```json
{
  "claims": [
    {
      "text": "Smart Tutor generates personalised lesson plans for students.",
      "subject": "Smart Tutor",
      "confidence": 0.87
    }
  ]
}
```

Rules:

- Claims must be supported by the chunk.
- Do not infer beyond the text.
- Prefer atomic claims.

### 8.3 Relationship Extraction Prompt

Output JSON:

```json
{
  "relationships": [
    {
      "source": "Smart Tutor",
      "target": "lesson plans",
      "type": "generates",
      "confidence": 0.88
    }
  ]
}
```

Rules:

- Use concise relationship types.
- Examples: `uses`, `requires`, `generates`, `belongs_to`, `mentions`, `supports`, `contradicts`, `depends_on`, `causes`, `summarises`.
- Only create relationships supported by the chunk.

### 8.4 Missing Definition Repair Prompt

Input:

- entity name
- current description
- related chunks
- related claims
- related relationships

Output JSON:

```json
{
  "definition": "Smart Tutor is an AI-powered learning assistant that helps students understand lessons and generate personalised learning support.",
  "confidence": 0.84,
  "evidence_chunk_ids": [1, 4, 8]
}
```

### 8.5 Contradiction Detection Prompt

Input:

- entity name
- claims about entity

Output JSON:

```json
{
  "contradictions": [
    {
      "claim_a_id": 12,
      "claim_b_id": 19,
      "reason": "The monthly price is listed as both $20 and $30.",
      "severity": "medium",
      "requires_human_review": true
    }
  ]
}
```

---

## 9. Retrieval Design

The retrieval system should use hybrid retrieval.

### 9.1 Query Flow

```txt
User question
  ↓
Classify query intent
  ↓
Generate query embedding
  ↓
Vector search chunks
  ↓
Extract query entities
  ↓
Graph expansion around matching entities
  ↓
Collect claims and relationships
  ↓
Generate answer
  ↓
Calculate confidence
  ↓
Create self-healing task if needed
```

### 9.2 Query Intent Types

Implement basic intent classification:

```txt
FACTUAL
SUMMARY
COMPARISON
RELATIONSHIP
TIMELINE
CONTRADICTION_CHECK
GAP_ANALYSIS
UNKNOWN
```

This can be LLM-based or rule-based at first.

### 9.3 Vector Search

Use pgvector to find relevant chunks.

Pseudo-query:

```sql
SELECT id, text, summary, document_id, embedding <-> %s AS distance
FROM documents_chunk
WHERE embedding IS NOT NULL
ORDER BY embedding <-> %s
LIMIT 8;
```

### 9.4 Graph Expansion

From entities detected in the question:

1. Find exact or fuzzy matching entities.
2. Pull outgoing relationships.
3. Pull incoming relationships.
4. Pull related claims.
5. Pull source chunks as supporting context.

### 9.5 Answer Generation

The answer prompt should include:

- User question
- Top retrieved chunks
- Related claims
- Related relationships
- Instruction to cite sources
- Instruction to admit uncertainty
- Instruction to list knowledge gaps when relevant

Response JSON:

```json
{
  "answer": "...",
  "confidence_score": 0.78,
  "source_chunk_ids": [1, 4, 9],
  "related_entity_ids": [2, 7],
  "knowledge_gaps": ["Exact duration is not stated."],
  "should_create_self_healing_task": true
}
```

---

## 10. Self-Healing System

This is the most important differentiator.

### 10.1 Self-Healing Task Types

Implement 4 ideas:

1. Duplicate entity repair
2. Missing definition repair
3. Low-confidence answer repair
4. Contradiction detection and review

---

## 10.2 Duplicate Entity Repair

### Problem

The system may create separate entities for the same concept:

```txt
React
React.js
ReactJS
```

### Detection

Run after ingestion and optionally on demand.

Detection logic:

- Compare entity names using simple normalisation.
- Compare embeddings.
- Compare aliases.
- If similarity exceeds threshold, create a task.

Example payload:

```json
{
  "candidate_entity_ids": [1, 7, 12],
  "suggested_canonical_name": "React",
  "reason": "Names and embeddings are highly similar."
}
```

### Repair

When task runs:

1. Choose canonical entity.
2. Move mentions to canonical entity.
3. Move relationships to canonical entity.
4. Move claims to canonical entity.
5. Merge aliases.
6. Delete or mark duplicate entities as merged.
7. Log result.

### UI Demo

Before:

```txt
React, React.js, ReactJS appear as three nodes.
```

After:

```txt
One React node remains with aliases.
```

---

## 10.3 Missing Definition Repair

### Problem

Important entities may have weak or empty descriptions.

### Detection

Create task if:

- Entity appears in 3 or more chunks.
- Description is empty or shorter than 30 characters.
- Confidence is below threshold.

### Repair

When task runs:

1. Retrieve chunks mentioning the entity.
2. Retrieve claims involving the entity.
3. Retrieve relationships involving the entity.
4. Ask LLM to synthesize a grounded definition.
5. Update entity description.
6. Store evidence chunk IDs in task result.

### UI Demo

Before:

```txt
Smart Tutor
Description: Missing
```

After:

```txt
Smart Tutor
Description: Smart Tutor is an AI-powered learning assistant...
```

---

## 10.4 Low-Confidence Answer Repair

### Problem

User asks a question and retrieval confidence is low.

### Detection

Create task if:

- Answer confidence score < 0.6.
- Fewer than 2 relevant chunks found.
- The answer generator reports knowledge gaps.

### Task Payload

```json
{
  "question": "What is the exact duration of the training plan?",
  "confidence_score": 0.42,
  "top_chunk_ids": [3, 8],
  "knowledge_gaps": ["Training plan duration is not clearly stated."]
}
```

### Repair

The repair should not invent information.

It should:

1. Re-run search with alternate query expansions.
2. Try entity-based search.
3. Try related claim search.
4. If better evidence is found, attach it to task result.
5. If evidence is not found, mark as unresolved knowledge gap.
6. Suggest what the user should upload or clarify.

### UI Demo

Ask an ambiguous question.

The system creates:

```txt
Low confidence answer detected: missing exact training duration.
```

Then it suggests:

```txt
Upload sponsor training plan or migration advice notes.
```

---

## 10.5 Contradiction Detection and Review

### Problem

Different sources may say conflicting things.

Example:

```txt
Document A: The plan costs $20/month.
Document B: The plan costs $30/month.
```

### Detection

After ingestion:

1. Group claims by subject entity.
2. Compare claims within each group.
3. Use LLM contradiction classifier for likely conflicts.
4. Create self-healing task requiring human review.

### Repair

Do not auto-delete or overwrite contradictory claims.

Instead:

1. Show both claims.
2. Show sources.
3. Show reason for contradiction.
4. Let user mark one as correct, both as context-dependent, or unresolved.

### UI Demo

Upload two conflicting snippets.

Self-healing page shows:

```txt
Contradiction detected:
Pricing is listed as both $20/month and $30/month.
```

User can choose:

- Keep both
- Mark latest source as preferred
- Mark one as incorrect
- Ignore

---

## 11. Frontend Plan

### 11.1 App Shell

Create a simple sidebar layout:

```txt
Knowledge Brain
- Dashboard
- Ingest
- Chat
- Knowledge Graph
- Self-Healing
- Documents
```

Use clean cards, badges, and simple layouts.

### 11.2 Dashboard Page

Show high-level metrics:

- Total documents
- Total chunks
- Total entities
- Total relationships
- Open self-healing tasks
- Average knowledge quality score

API:

```http
GET /api/dashboard/
```

Response:

```json
{
  "documents": 12,
  "chunks": 148,
  "entities": 320,
  "relationships": 512,
  "open_self_healing_tasks": 6,
  "average_quality_score": 0.82
}
```

### 11.3 Ingest Page

Form fields:

- Title
- Source type
- Paste text
- Upload file
- URL
- Tags

After submit:

- Display ingestion job progress.
- Show completed stats.

Components:

```txt
IngestForm
IngestionProgress
RecentDocuments
```

### 11.4 Chat Page

Layout:

```txt
Main chat column
Right source/context panel
```

Features:

- Ask question
- Show answer
- Show confidence badge
- Show source chunks
- Show related entities
- Show knowledge gaps
- Show whether self-healing task was created

### 11.5 Knowledge Graph Page

Use React Flow.

Node types:

```txt
document
entity
claim
```

Edge labels:

```txt
mentions
supports
uses
requires
generates
contradicts
related_to
```

Features:

- Click node to open details panel.
- Filter by node type.
- Filter by confidence.
- Toggle relationship labels.

### 11.6 Self-Healing Page

Display repair tasks.

Filters:

- Pending
- Running
- Completed
- Failed
- Ignored

Task card should show:

- Title
- Type
- Priority
- Description
- Related entity/document
- Run button
- Ignore button
- Result after completion

---

## 12. Docker Compose Plan

Create root `docker-compose.yml`.

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: knowledge_brain
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    command: python manage.py runserver 0.0.0.0:8000
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    env_file:
      - .env
    depends_on:
      - db
      - redis

  celery:
    build: ./backend
    command: celery -A config worker -l info
    volumes:
      - ./backend:/app
    env_file:
      - .env
    depends_on:
      - backend
      - db
      - redis

  frontend:
    build: ./frontend
    command: npm run dev -- --host 0.0.0.0
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://localhost:8000/api
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 13. Environment Variables

Create `.env.example`:

```env
DEBUG=True
SECRET_KEY=dev-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1,backend
CORS_ALLOWED_ORIGINS=http://localhost:5173

DATABASE_URL=postgres://postgres:postgres@db:5432/knowledge_brain
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4.1-mini

MAX_UPLOAD_MB=20
```

---

## 14. Implementation Phases for Codex

Use these as separate Codex tasks or pull requests.

---

### Phase 1: Repo and Docker Foundation

Codex task:

```txt
Create a monorepo with backend and frontend folders. Set up Django, Django REST Framework, React, Vite, TypeScript, Tailwind CSS, Docker Compose, Postgres with pgvector, Redis, and Celery. Add a README with local setup instructions. Ensure docker compose up starts frontend, backend, db, redis, and celery.
```

Acceptance criteria:

- `docker compose up --build` works.
- Frontend loads on `localhost:5173`.
- Backend health endpoint works on `localhost:8000/api/health/`.
- Celery starts without crashing.
- Database migrations run.

---

### Phase 2: Document Ingestion MVP

Codex task:

```txt
Implement document ingestion. Add Document, IngestionJob, and Chunk models. Add an endpoint to submit pasted text or uploaded text/PDF files. Create a Celery task that extracts text, cleans it, chunks it, stores chunks, and updates ingestion progress. Add frontend Ingest page with form and progress display.
```

Acceptance criteria:

- User can paste text and submit.
- Backend creates document and ingestion job.
- Celery creates chunks.
- Frontend shows progress and completed state.
- Document list displays ingested documents.

---

### Phase 3: Embeddings and Vector Retrieval

Codex task:

```txt
Add pgvector embedding support. Generate embeddings for chunks during ingestion. Implement vector search service and chat query endpoint. The endpoint should retrieve top chunks and generate a source-grounded answer using the configured LLM. Add Chat page in frontend showing answer, confidence, and sources.
```

Acceptance criteria:

- Chunks have embeddings.
- User can ask a question.
- Backend retrieves relevant chunks.
- Answer includes source snippets.
- Confidence score is returned.

---

### Phase 4: Structured Knowledge Extraction

Codex task:

```txt
Implement Entity, Claim, Relationship, and ChunkEntityMention models. During ingestion, extract entities, claims, and relationships from chunks using structured JSON LLM prompts. Store them in the database. Add endpoints to list entities and relationships.
```

Acceptance criteria:

- Ingested documents create entities.
- Ingested documents create claims.
- Ingested documents create relationships.
- Entities and relationships can be retrieved through API.

---

### Phase 5: Knowledge Graph Frontend

Codex task:

```txt
Add a Knowledge Graph page using React Flow. Fetch graph nodes and edges from the backend. Render documents, entities, and relationships. Add a node details side panel. Add basic filters for node type and confidence.
```

Acceptance criteria:

- Knowledge graph renders.
- Nodes are clickable.
- Details panel shows entity/document metadata.
- Relationship labels are visible.

---

### Phase 6: Self-Healing Task System

Codex task:

```txt
Implement SelfHealingTask model, API endpoints, and Self-Healing frontend page. Add task generation after ingestion for duplicate entities and missing definitions. Add services to run duplicate entity repair and missing definition repair. Add task status updates and results.
```

Acceptance criteria:

- Self-healing tasks are created automatically.
- User can view tasks.
- User can run a task.
- Duplicate entity repair works.
- Missing definition repair works.
- Task result is visible in frontend.

---

### Phase 7: Low-Confidence and Contradiction Detection

Codex task:

```txt
Extend self-healing with low-confidence answer repair and contradiction detection. When chat confidence is low, create a self-healing task. After ingestion, compare claims by entity and create contradiction review tasks where conflicts are detected. Add UI for reviewing contradiction tasks.
```

Acceptance criteria:

- Low-confidence answers create repair tasks.
- Contradictions between claims create review tasks.
- Contradiction task shows both claims and sources.
- User can mark contradiction task ignored or resolved.

---

### Phase 8: Dashboard and Polish

Codex task:

```txt
Create Dashboard page with metrics. Add seed demo data script. Improve frontend styling. Add loading states, empty states, error states, and README screenshots placeholders. Add demo script documentation.
```

Acceptance criteria:

- Dashboard shows counts and quality score.
- Demo seed script works.
- App has polished navigation.
- README explains what the app does and how to run it.
- Demo script exists.

---

## 15. Quality Scoring

Implement a simple scoring system.

### Document quality score

Based on:

- Text extraction success
- Number of chunks
- Average chunk quality
- Entity extraction coverage
- Relationship density
- Number of open repair tasks

Example formula:

```python
score = 1.0
score -= low_quality_chunk_ratio * 0.25
score -= orphan_chunk_ratio * 0.20
score -= duplicate_entity_ratio * 0.15
score -= contradiction_count_normalized * 0.20
score += relationship_density_bonus * 0.10
score = max(0, min(score, 1))
```

### Chunk quality score

Based on:

- Length within target range
- Has summary
- Has embedding
- Has at least one entity or claim

---

## 16. Demo Dataset

Create a demo seed script that ingests 3 to 5 sample texts.

Use intentionally messy content:

### Document 1: Product Overview

Mentions:

- Smart Tutor
- Lesson plans
- Student progress
- Curriculum

### Document 2: Product Roadmap

Mentions the same concepts with slightly different names:

- AI Tutor
- SmartTutor
- Learning plan generator

This creates duplicate entity repair opportunities.

### Document 3: Pricing Notes

Says:

```txt
The Pro plan costs $20/month.
```

### Document 4: Updated Pricing Notes

Says:

```txt
The Pro plan costs $30/month.
```

This creates contradiction detection opportunity.

### Document 5: Incomplete Training Notes

Mentions a training plan without duration.

This creates low-confidence retrieval and knowledge gap opportunities.

---

## 17. Demo Script

Use this exact demo flow:

1. Open Dashboard.
2. Show empty or initial metrics.
3. Go to Ingest page.
4. Paste/upload messy product notes.
5. Show ingestion progress.
6. Open Knowledge Graph.
7. Show entities and relationships.
8. Ask in Chat: `What is Smart Tutor and how does it relate to lesson plans?`
9. Show answer with sources and confidence.
10. Open Self-Healing page.
11. Show duplicate entity task: `Smart Tutor`, `SmartTutor`, `AI Tutor`.
12. Run duplicate repair.
13. Return to graph and show cleaner graph.
14. Show missing definition task.
15. Run missing definition repair.
16. Ask the same chat question again.
17. Show improved answer or improved entity detail.
18. Upload conflicting pricing notes.
19. Show contradiction task.
20. Explain that the agent does not blindly overwrite conflicting knowledge; it escalates for review.

---

## 18. Code Quality Rules

Codex should follow these rules:

### Backend

- Keep business logic out of views.
- Use service classes/functions inside `services/` folders.
- Validate LLM JSON outputs.
- Handle LLM failures gracefully.
- Log ingestion errors.
- Keep Celery tasks thin; delegate to services.
- Use database transactions where appropriate.
- Add type hints where practical.
- Add docstrings for complex services.

### Frontend

- Keep API calls in `src/api/`.
- Keep reusable components in `src/components/`.
- Keep pages thin.
- Add loading and error states.
- Avoid overengineering state management.
- Use readable component names.

### LLM Safety / Reliability

- Never treat LLM output as guaranteed valid JSON.
- Parse and validate.
- If extraction fails, create a low-quality/self-healing task rather than crashing.
- Retrieval answers must cite source chunks.
- If no evidence exists, answer with uncertainty.

---

## 19. README Requirements

The root README should include:

```md
# Knowledge Brain

## What it does
Knowledge Brain is an autonomous knowledge-engineering agent that ingests messy content, builds a structured knowledge base, answers questions with sources, visualises relationships, and self-heals over time.

## Why it is AI-native
It does not just retrieve chunks. It extracts entities, claims, and relationships, scores knowledge quality, detects duplicates and contradictions, and repairs weak knowledge areas.

## Tech stack
React, TypeScript, Vite, Django, DRF, PostgreSQL, pgvector, Redis, Celery, OpenAI/LLM API.

## Architecture
Ingest → Structure → Retrieve → Evaluate → Repair.

## Running locally
1. Copy `.env.example` to `.env`.
2. Add API keys.
3. Run `docker compose up --build`.
4. Open frontend at `http://localhost:5173`.

## Demo flow
Include the 10-step demo script.

## Key features
- Document ingestion
- Semantic retrieval
- Knowledge graph
- Source-grounded answers
- Self-healing task queue
- Duplicate entity repair
- Missing definition repair
- Contradiction detection
- Low-confidence answer repair
```

---

## 20. Minimum Viable Submission Checklist

The submission is acceptable when all of these work:

- [ ] Single repo runs with Docker Compose.
- [ ] Frontend has Dashboard, Ingest, Chat, Graph, and Self-Healing pages.
- [ ] User can paste text and ingest it.
- [ ] Backend creates chunks.
- [ ] Backend creates embeddings.
- [ ] User can ask a question.
- [ ] Answer includes sources.
- [ ] Entities are extracted.
- [ ] Relationships are extracted.
- [ ] Graph renders in frontend.
- [ ] Self-healing tasks are generated.
- [ ] Duplicate entity repair works.
- [ ] Missing definition repair works.
- [ ] Low-confidence answers create repair tasks.
- [ ] Contradictions are detected or at least surfaced as review tasks.
- [ ] README explains architecture and demo.

---

## 21. Stretch Goals

Only implement these after the MVP works:

1. URL crawler with source refresh.
2. Scheduled nightly self-healing.
3. Human approval workflow for all repairs.
4. Better graph clustering.
5. Reranking using LLM.
6. Multi-knowledge-base support.
7. Export knowledge graph as JSON.
8. Import Notion/Google Docs.
9. Authentication.
10. Deployment to a small VPS.

---

## 22. Final Product Positioning

Use this as the product pitch:

> Knowledge Brain is an autonomous knowledge-engineering agent. It ingests messy real-world information, converts it into a structured knowledge base, builds a graph of entities and relationships, answers questions with source-grounded retrieval, and continuously improves itself through self-healing routines such as duplicate merging, contradiction detection, low-confidence repair, and missing concept generation.

The strongest message:

> This is not just RAG. This is a self-maintaining knowledge system.

---

## 23. First Codex Prompt to Start the Project

Use this as the first prompt to Codex:

```txt
Create the initial monorepo for Knowledge Brain.

The app should have:
- backend/ Django project with Django REST Framework
- frontend/ React + TypeScript + Vite + Tailwind app
- Docker Compose with backend, frontend, PostgreSQL using pgvector, Redis, and Celery worker
- backend health endpoint at /api/health/
- frontend AppShell with sidebar navigation placeholders for Dashboard, Ingest, Chat, Knowledge Graph, Self-Healing, and Documents
- .env.example
- README with setup instructions

Keep the structure clean and production-minded. Do not implement AI features yet. Focus on a solid foundation that runs locally with docker compose up --build.
```

After that is complete, proceed phase by phase using the tasks in this document.
