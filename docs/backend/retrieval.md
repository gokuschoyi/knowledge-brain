# Retrieval Pipeline

This document explains how Knowledge Brain answers questions. Retrieval is orchestrated by a LangGraph `StateGraph` in `backend/apps/agents/retrieval_agent.py`. The two public entrypoints are `answer_question()` (blocking) and `stream_question_answer()` (SSE-compatible generator).

---

## The 6-Step Retrieval Flow

```
Question arrives
      │
      ▼
Step 1 ── Classify question
      │
      ▼
Step 2 ── Load repair memory
      │
      ▼
Step 3 ── Expand graph context
      │
      ▼
Step 4 ── Retrieve and rerank chunks
      │
      ▼
Step 5 ── Assess gaps + calculate confidence
      │
      ▼
Step 6 ── Generate answer
      │
      ▼
Persist chat message + optionally create SelfHealingTask
```

---

## Step 1 — Question Classification

The question is classified into a type (e.g. factual, comparative, definitional) to guide how graph context is expanded and how the answer is framed. This step is lightweight and uses a small prompt or keyword heuristics when no LLM is configured.

---

## Step 2 — Load Repair Memory

Before hitting the vector index, the pipeline builds bounded session context from recent chat turns. Recent questions, recent answers, referenced entities, and unresolved gaps are folded into a lightweight session summary so follow-up questions can inherit topic context without replaying the full transcript.

The pipeline then checks for stored repair memory from prior low-confidence answers. Repair memory records pair a query pattern with improved source chunks and entity hints. If a matching record exists, its context is injected to improve retrieval without re-running the full repair.

This closes the feedback loop: past repairs make future similar questions cheaper and more accurate.

---

## Step 3 — Graph Context Expansion

The pipeline queries the knowledge graph to pull context beyond what vector search alone would surface.

**What gets pulled:**

| Record | Condition |
|--------|-----------|
| Entity definitions | Entities whose `retrieval_text` matches the question |
| Linked claims | Claims attached to those entities |
| Relationships | Edges between matched entities |
| Contradiction warnings | If any matched entity or claim is flagged `is_contradictory` |

Graph expansion finds named concepts the question references even when no chunk directly contains the phrasing of the question. This is the key difference from plain RAG.

---

## Step 4 — Retrieve and Rerank Chunks

**Vector search:** The question is embedded using `gemini-embedding-001` and compared to all `Chunk.embedding` vectors in the brain using pgvector cosine similarity. The top-K chunks are returned.

**Reranking:** The initial retrieval order is adjusted using multiple signals:

| Signal | Weight | Notes |
|--------|--------|-------|
| Vector similarity score | Primary | Raw cosine similarity from pgvector |
| Chunk quality score | Modifier | Higher-quality chunks rank up |
| Document quality score | Modifier | Chunks from better documents rank up |
| Source authority | Modifier | Primary and secondary sources rank above unknown material |
| Source freshness | Modifier | More recent published sources get a small boost |
| Graph/entity hints | Modifier | Chunks mentioning matched entities rank up |

The reranking step produces a final ordered list of chunks that combines semantic relevance with structural quality.

---

## Step 5 — Gap Assessment and Confidence Scoring

**Gap detection** (`retrieval/services/confidence.py`): The retrieval agent looks for signs that the available evidence does not fully answer the question:

- Too few chunks retrieved above the similarity threshold
- No strong entity match in graph context for a clearly named concept
- Retrieved chunks that discuss a related topic but miss the specific requested fact
- Source material that explicitly signals missing information

Each detected gap reduces the final confidence score and is recorded in the `knowledge_gaps` list returned to the frontend.

**Answer confidence** is computed from:
- The top reranked retrieval scores (higher scores → higher base confidence)
- A gap penalty proportional to the number and severity of gaps

The final `confidence_score` is a `float` in `[0.0, 1.0]`. If it falls below the configured threshold, a `low_confidence_answer` self-healing task is created.

---

## Step 6 — Answer Generation

The LLM receives a structured context package:
- Top reranked chunks (full text)
- Entity definitions for matched entities
- Relevant claims
- Relationship edges
- Any contradiction warnings

The model is instructed to:
- Ground the answer in the provided evidence
- Cite source chunks
- Acknowledge gaps honestly rather than hallucinating
- Keep the answer concise

If no LLM is configured, a deterministic fallback concatenates the top chunk texts as the answer.

---

## Streaming Mode

`stream_question_answer()` yields events as the pipeline progresses:

```
{"type": "status", "message": "retrieval_started"}
{"type": "chunk", "content": "…"}          ← streaming answer tokens
{"type": "sources", "sources": […]}
{"type": "confidence", "score": 0.82}
{"type": "gaps", "gaps": ["…"]}
{"type": "done"}
```

The frontend `ChatWindow` component consumes this stream via `EventSource` and progressively renders the answer as tokens arrive.

---

## Chat Session State

Each query is optionally associated with a `ChatSession`. Sessions store the full message history, and the retrieval pipeline now derives bounded session context from recent turns so follow-up questions can resolve references like “what about pricing?” against the current topic.

`ChatMessage` records store:
- `role`: `"user"` or `"assistant"`
- `content`: the message text
- `sources`: array of source chunk references
- `confidence`: the answer confidence score
- `knowledge_gaps`: array of detected gap descriptions

---

## Low-Confidence Answer Tasks

When `confidence_score` is below threshold, the pipeline creates a `low_confidence_answer` `SelfHealingTask` with:

```json
{
  "question": "What is the pricing for Pro plan?",
  "answer": "No specific pricing found …",
  "confidence": 0.31,
  "source_chunk_ids": [101, 102],
  "related_entity_ids": [12],
  "knowledge_gaps": ["Pricing details not found in knowledge base"]
}
```

The self-healing runner can then search for alternative evidence and persist improved repair memory so the same question performs better next time. If the current brain still lacks evidence, the task remains unresolved and should be addressed by ingesting new supporting material.

---

## Related docs

- [backend/self-healing.md](self-healing.md) — what happens to low-confidence tasks
- [architecture/overview.md](../architecture/overview.md) — retrieval in system context
- [backend/api.md](api.md) — chat endpoints
