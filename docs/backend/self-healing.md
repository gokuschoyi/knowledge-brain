# Self-Healing System

Self-healing is Knowledge Brain's mechanism for automatically improving its own knowledge base over time. Repair tasks are generated during ingestion and retrieval, then executed by a LangGraph agent that routes each task to the correct repair handler.

---

## How Tasks Are Created

Tasks are created in two places:

**During ingestion** (at finalization): duplicate entities, missing definitions, and contradictions are detected automatically and turned into pending tasks.

**During retrieval** (at chat time): if the answer confidence falls below threshold, a `low_confidence_answer` task is created capturing the weak question, its evidence, and the detected gaps.

---

## Task Types

| Type | Trigger | What it does |
|------|---------|-------------|
| `duplicate_entity` | Two or more entities with similar normalised names appear during ingestion | Merges entities and rewires all references |
| `missing_definition` | An entity is mentioned repeatedly but has a weak or empty description | Generates a grounded definition from evidence |
| `low_confidence_answer` | A chat answer confidence is below threshold | Retries retrieval, persists repair memory if meaningfully improved, otherwise stays unresolved |
| `contradiction` | Conflicting claims detected for the same subject | Surfaces a review payload — does not auto-resolve |
| `orphan_chunk` | Reserved task type | No automated repair runner yet |

---

## Task Lifecycle

```
PENDING → RUNNING → RESOLVED
                 ↘ UNRESOLVED
                 ↘ REVIEW_REQUIRED
                 ↘ FAILED
PENDING → IGNORED
```

- `payload` — the repair input (question, entity IDs, candidate IDs, etc.)
- `result` — the repair output (definition written, entities merged, improvement achieved, etc.)

---

## Repair Handlers

All handlers live in `backend/apps/agents/self_healing_agent.py` as a LangGraph `StateGraph`. The graph routes by `task_type` to the appropriate handler node.

---

### `duplicate_entity` — Merge Handler

**Input payload:**
```json
{
  "candidate_entity_ids": [12, 19, 34],
  "suggested_canonical_name": "Smart Tutor"
}
```

**What it does:**

1. Chooses the canonical entity (highest confidence or most mentions)
2. Rewires all `ChunkEntityMention` records to point to the canonical entity
3. Rewires all `Claim.subject_entity` references
4. Rewires all `Relationship.source_entity` / `Relationship.target_entity` references
5. Merges aliases from all duplicates into the canonical entity
6. Deletes the duplicate entity records
7. Re-enriches the canonical entity (updates `retrieval_text`, mention statistics)

This is the most structurally impactful repair — it changes the graph topology itself.

---

### `missing_definition` — Definition Handler

**Input payload:**
```json
{ "entity_id": 19 }
```

**What it does:**

1. Loads the entity and all chunks where it is mentioned
2. Sends the evidence to the LLM with a prompt: "Write a clear, grounded definition for this entity based only on the provided text"
3. Falls back to a deterministic evidence-derived description if no LLM is available
4. Writes the new description to `entity.description`
5. Raises entity confidence conservatively (not to maximum, to avoid false certainty)
6. Re-enriches the entity

---

### `low_confidence_answer` — Evidence Search Handler

**Input payload:**
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

**What it does:**

1. Generates alternative query variants of the original question
2. Runs expanded vector search and graph context expansion with the variants
3. Evaluates whether the new evidence would produce a stronger answer
4. If confidence improves or one or more gaps close: persists a `QueryRepairMemory` record pairing the question pattern with the better evidence context
5. Returns a resolved outcome only when the retry is materially better; otherwise returns `unresolved`

This handler does not directly rewrite the stored answer. Its value is that the persisted repair memory makes the **next** time the same question is asked faster and more confident. If the current brain still lacks evidence, the task stays unresolved and the recommended next step is to ingest clarifying text or a new source file.

---

### `contradiction` — Review Handler

**What it does:**

Returns a review payload containing the conflicting claims and their source evidence. It does **not** auto-resolve contradictions because resolving conflicting facts requires human judgement. Running the task moves it to `review_required`, not a repaired state.

The frontend `SelfHealingPage` displays the review result so a user can read the conflicting claims and decide which is authoritative.

---

## Auto-Repair Scheduling

Brains can opt into automatic periodic repair so that tasks do not need to be triggered manually.

**Configuration (on `Brain` model):**
- `auto_repair_enabled` — boolean
- `auto_repair_interval_hours` — how often to scan and run pending tasks
- `auto_repair_task_types` — which task types are eligible for automated repair

Celery Beat runs on the interval set by `AUTO_REPAIR_BEAT_INTERVAL_MINUTES`. On each tick it:

1. Scans all brains where `auto_repair_enabled = True`
2. Checks whether the elapsed time since the last auto-repair run exceeds `auto_repair_interval_hours`
3. For due brains: enqueues pending tasks matching the configured types

Safe auto-repair by default targets only lower-risk types (`missing_definition`). Higher-risk repairs (`duplicate_entity`, which changes graph structure) remain manual by default.

---

## Frontend Integration

The `SelfHealingPage` provides:
- A task list filtered by status and type
- A task detail panel showing `payload` (input) and `result` (output)
- Run, ignore, and delete controls per task
- Add-evidence controls for low-confidence and contradiction tasks that create normal ingestion jobs inside the active brain
- Auto-repair configuration panel per brain

---

## Related docs

- [backend/ingestion.md](ingestion.md) — how ingestion creates tasks
- [backend/retrieval.md](retrieval.md) — how low-confidence answers create tasks
- [backend/api.md](api.md) — self-healing REST endpoints
- [architecture/backend.md](../architecture/backend.md) — Celery Beat scheduling
