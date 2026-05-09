# Ingestion Pipeline

This document covers how documents move from raw upload to structured, searchable knowledge. The active path is **V2**, controlled by the `EXTRACTION_VERSION` environment variable.

---

## V1 vs V2

| | V1 | V2 |
|--|----|----|
| Orchestration | LangGraph agent in `agents/ingestion_agent.py` | Direct service pipeline in `documents/services/parallel_ingestion_v2.py` |
| Extraction | Sequential, one stage at a time | Parallel: one Celery task per chunk |
| Intermediate storage | Direct DB writes per chunk | `ChunkExtractionArtifact` buffers each chunk's result |
| Persistence | Per-chunk, may produce duplicate entities | Consolidated once per document — no duplicates |
| Status | Legacy, still functional | Active, recommended |

V2 is faster (parallel LLM calls) and produces cleaner knowledge (document-scoped consolidation).

---

## V2 Pipeline — Step by Step

The pipeline is coordinated by `backend/apps/documents/services/parallel_ingestion_v2.py` and runs as a Celery task (`run_document_ingestion`).

```
Upload received
    │
    ▼
1. Text Extraction
    │   PyMuPDF (fast, structure-aware)
    │     → pypdf (fallback)
    │       → OCRmyPDF (fallback for scanned/image PDFs)
    │
    ▼
2. Text Cleaning
    │   Removes encoding artifacts, excessive whitespace, headers/footers
    │   Normalises whitespace and line breaks
    │
    ▼
3. Chunking
    │   Token-aware splitting (respects sentence boundaries)
    │   Each chunk: text + token count + sequential index
    │
    ▼
4. Persist Chunks
    │   Embed each chunk with Gemini `gemini-embedding-001`
    │   Generate per-chunk summary (LLM or fallback)
    │   Compute chunk quality score (length, density, structure signals)
    │   Store Chunk records in DB
    │
    ▼
5. Create Extraction Artifacts
    │   One ChunkExtractionArtifact per chunk (status: queued)
    │
    ▼
6. Fan Out Chunk Tasks (parallel)
    │   Each artifact → `run_chunk_bundled_extraction` on the ingestion Celery queue
    │   Configurable parallelism: INGESTION_V2_MAX_PARALLEL_CHUNK_TASKS
    │
    ▼
7. Wait for All Artifacts
    │   Pipeline polls until every artifact reaches completed or failed
    │
    ▼
8. Consolidate Successful Payloads
    │   Merge entity mentions across chunks by normalised name
    │   Combine aliases
    │   Keep strongest description per entity
    │   Resolve claims to a subject entity
    │   Resolve relationship endpoints against the consolidated entity map
    │   Deduplicate claims and relationships
    │
    ▼
9. Persist Knowledge Records
    │   Entities, Claims, Relationships, ChunkEntityMentions
    │
    ▼
10. Enrich
    │   Compute retrieval_text for each entity (description + aliases + claim summaries)
    │   Update mention statistics (mention_count, first_seen_chunk, last_seen_chunk)
    │
    ▼
11. Contradiction Detection
    │   Group claims by normalised subject
    │   Look for conflicting numeric values (price-like patterns)
    │   Flag claims and entities as contradictory
    │   Generate contradiction SelfHealingTasks
    │
    ▼
12. Document Quality Scoring
    │   Combines: entity count, claim count, avg chunk quality, extraction coverage
    │   Generates document summary (LLM or fallback)
    │
    ▼
13. Self-Healing Task Generation
        Duplicate entity detection → merge tasks
        Missing definition detection → definition tasks
        (contradiction tasks already created in step 11)
```

---

## Bundled Extraction (Step 6)

Each chunk task calls a single bundled LLM prompt that extracts entities, claims, and relationships in one shot.

The model is instructed to:
- Ground all extracted items in the chunk text — no hallucinated knowledge
- Keep entity names consistent within the response
- Return conservative confidence scores across the full `0.0–1.0` range
- Avoid returning `1.0` unless absolutely certain

**Structured output schema** (`agents/schemas.py`):

```python
class ExtractionPayload(BaseModel):
    entities: list[ExtractedEntity]
    claims: list[ExtractedClaim]
    relationships: list[ExtractedRelationship]

class ExtractedEntity(BaseModel):
    name: str
    description: str
    aliases: list[str]
    confidence: float  # raw LLM score

class ExtractedClaim(BaseModel):
    text: str
    subject: str | None
    confidence: float

class ExtractedRelationship(BaseModel):
    source: str
    target: str
    label: str
    confidence: float
```

If the model is unavailable or returns no valid structured output, the artifact falls back to an empty extraction result and is marked `failed` — the rest of the job continues with the remaining chunks.

---

## Confidence Calibration

Raw LLM confidence is stored in artifact metadata but is **not** used as the final product-facing score. A calibration layer in `documents/services/confidence_calibration.py` converts raw scores to calibrated values.

### Entities

| Signal | Effect |
|--------|--------|
| Multi-word stable name | Boost |
| Repeated mentions across chunks | Boost |
| Long, descriptive description | Boost |
| Generic or very short name (< 3 chars) | Penalty |
| Missing or weak description | Penalty |
| Fallback when no raw score | `0.72` |

### Claims

| Signal | Effect |
|--------|--------|
| Long, specific claim text | Boost |
| Subject entity resolves cleanly to a known entity | Boost |
| Short claim (< 20 chars) | Penalty |
| No resolved subject entity | Penalty |
| Fallback | `0.68` |

### Relationships

| Signal | Effect |
|--------|--------|
| Both endpoints resolve to known entities | Boost |
| Specific label (not `related_to`, `connected_to`) | Boost |
| Generic fallback label | Penalty |
| Fallback | `0.66` |

All calibrated scores are capped below `1.0` to prevent saturation flattening the confidence signal.

Raw confidence is preserved in `metadata.raw_confidence` and `metadata.confidence_source` for debugging.

---

## Self-Healing Tasks Generated at Ingestion End

### Duplicate Entity Detection

Entity names are normalised (lowercase, stripped). Entities sharing a normalised name within the same document are grouped. A `duplicate_entity` task is created with:
- `candidate_entity_ids`: list of entity IDs to merge
- `suggested_canonical_name`: the most common or longest name form

### Missing Definition Detection

An entity qualifies when:
- It appears in 2+ chunks (mention_count ≥ 2)
- AND its description is empty, shorter than 30 characters, or matches generic patterns

A `missing_definition` task is created pointing at the `entity_id`.

### Contradiction Detection

Claims are grouped by a normalised subject key. Within each group, the detector looks for numeric values attached to the same subject that differ significantly (especially price-like patterns: `$X`, `X USD`). When found:
- Conflicting claims are flagged `is_contradicted = True`
- Related entities are flagged `is_contradictory = True`
- A `contradiction` task is created with the conflicting claim payload

---

## Related docs

- [architecture/overview.md](../architecture/overview.md) — ingestion in system context
- [architecture/backend.md](../architecture/backend.md) — Celery task graph
- [backend/self-healing.md](self-healing.md) — what happens to the tasks generated here
