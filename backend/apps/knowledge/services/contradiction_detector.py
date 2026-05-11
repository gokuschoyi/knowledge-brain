from __future__ import annotations

import re
from collections import defaultdict

from apps.documents.models import Document
from apps.knowledge.models import Claim
from apps.knowledge.services.retrieval_enrichment import (
    build_claim_subject_key,
    mark_entities_with_contradictions,
)
from apps.self_healing.models import SelfHealingTask

PRICE_PATTERN = re.compile(r"\$([0-9]+(?:\.[0-9]{1,2})?)")
DATE_PATTERN = re.compile(
    r"\b((?:19|20)\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+(?:19|20)\d{2})\b",
    re.IGNORECASE,
)
VERSION_PATTERN = re.compile(r"\bv\d+(?:\.\d+){0,2}\b", re.IGNORECASE)
QUANTITY_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:users?|days?|weeks?|months?|years?|hours?|minutes?|gb|mb|tb|%|percent)\b", re.IGNORECASE
)
CATEGORY_PATTERN = re.compile(
    r"\b(enabled|disabled|active|inactive|public|private|available|unavailable|supported|unsupported)\b",
    re.IGNORECASE,
)


def _extract_fact_values(claim_text: str) -> list[tuple[str, str]]:
    extracted: list[tuple[str, str]] = []
    for match in PRICE_PATTERN.findall(claim_text):
        extracted.append(("price", match))
    for match in DATE_PATTERN.findall(claim_text):
        extracted.append(("date", match.lower()))
    for match in VERSION_PATTERN.findall(claim_text):
        extracted.append(("version", match.lower()))
    for match in QUANTITY_PATTERN.findall(claim_text):
        extracted.append(("quantity", match.lower()))
    for match in CATEGORY_PATTERN.findall(claim_text):
        extracted.append(("category", match.lower()))
    return extracted


def _related_document_for_claims(claims: list[Claim]) -> Document | None:
    latest_claim = max(
        claims,
        key=lambda claim: (
            claim.source_chunk.document.created_at,
            claim.source_chunk.document_id,
        ),
    )
    return latest_claim.source_chunk.document


def _create_contradiction_task(
    *,
    brain_id,
    key: str,
    fact_type: str,
    claims: list[Claim],
    related_document: Document | None,
) -> SelfHealingTask | None:
    claim_ids = sorted(claim.id for claim in claims)
    if SelfHealingTask.objects.filter(
        task_type=SelfHealingTask.TYPE_CONTRADICTION,
        brain_id=brain_id,
        payload__claim_ids=claim_ids,
    ).exists():
        return None
    return SelfHealingTask.objects.create(
        task_type=SelfHealingTask.TYPE_CONTRADICTION,
        priority=3,
        title=f"Contradiction detected for {key}",
        description=f"Conflicting {fact_type} values were found across related claims and documents.",
        brain_id=brain_id,
        related_document=related_document,
        status=SelfHealingTask.STATUS_PENDING,
        payload={
            "fact_type": fact_type,
            "claim_ids": claim_ids,
            "claims": [
                {
                    "id": claim.id,
                    "text": claim.text,
                    "chunk_id": claim.source_chunk_id,
                    "document_id": claim.source_chunk.document_id,
                    "document_title": claim.source_chunk.document.title,
                }
                for claim in claims
            ],
        },
    )


def _normalize_subject_keys(claims: list[Claim]) -> None:
    for claim in claims:
        subject_key = build_claim_subject_key(claim)
        if claim.subject_key != subject_key:
            claim.subject_key = subject_key
            claim.save(update_fields=["subject_key"])


def _scan_contradictions(
    *,
    brain_id,
    relevant_keys: set[str] | None = None,
) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    grouped: dict[str, list[Claim]] = defaultdict(list)
    claims = list(
        Claim.objects.filter(source_chunk__document__brain_id=brain_id).select_related(
            "subject_entity", "source_chunk__document"
        )
    )
    _normalize_subject_keys(claims)
    for claim in claims:
        key = claim.subject_key or build_claim_subject_key(claim)
        if relevant_keys is not None and key not in relevant_keys:
            continue
        if not key:
            continue
        claim.subject_key = key
        grouped[key].append(claim)

    for key, grouped_claims in grouped.items():
        fact_groups: dict[str, dict[str, list[Claim]]] = defaultdict(lambda: defaultdict(list))
        for claim in grouped_claims:
            for fact_type, normalized_value in _extract_fact_values(claim.text):
                fact_groups[fact_type][normalized_value].append(claim)
        for fact_type, fact_values in fact_groups.items():
            if len(fact_values) <= 1:
                continue
            flat_claims = [claim for claim_list in fact_values.values() for claim in claim_list]
            claim_ids = [claim.id for claim in flat_claims]
            Claim.objects.filter(id__in=claim_ids).update(
                contradiction_flag=True,
                contradiction_review_state=Claim.REVIEW_NEEDS_REVIEW,
            )
            mark_entities_with_contradictions(
                [claim.subject_entity_id for claim in flat_claims if claim.subject_entity_id]
            )
            task = _create_contradiction_task(
                brain_id=brain_id,
                key=key,
                fact_type=fact_type,
                claims=flat_claims,
                related_document=_related_document_for_claims(flat_claims),
            )
            if task is not None:
                tasks.append(task)
    return tasks


def detect_contradictions_for_document(document: Document) -> list[SelfHealingTask]:
    current_doc_claims = list(
        Claim.objects.filter(source_chunk__document=document).select_related("subject_entity", "source_chunk__document")
    )
    _normalize_subject_keys(current_doc_claims)
    relevant_keys = {claim.subject_key for claim in current_doc_claims if claim.subject_key}
    return _scan_contradictions(
        brain_id=document.brain_id,
        relevant_keys=relevant_keys,
    )


def detect_contradictions_for_brain(brain_id) -> list[SelfHealingTask]:
    return _scan_contradictions(brain_id=brain_id)
