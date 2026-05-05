from __future__ import annotations

import re
from collections import defaultdict

from apps.documents.models import Document
from apps.knowledge.models import Claim
from apps.self_healing.models import SelfHealingTask


PRICE_PATTERN = re.compile(r"\$([0-9]+)")
GENERIC_PRICE_SUBJECTS = {"pro plan", "plan", "pricing", "price"}


def _claim_subject_key(claim: Claim) -> str:
    if claim.subject_entity_id and claim.subject_entity:
        return claim.subject_entity.name.strip().lower()
    lowered = claim.text.lower()
    if "pro plan" in lowered:
        return "pro plan"
    if "plan" in lowered and "cost" in lowered:
        return "pricing plan"
    return claim.text[:40].strip().lower()


def detect_contradictions_for_document(document: Document) -> list[SelfHealingTask]:
    tasks: list[SelfHealingTask] = []
    grouped: dict[str, list[Claim]] = defaultdict(list)
    current_doc_claims = list(
        Claim.objects.filter(source_chunk__document=document).select_related("subject_entity", "source_chunk")
    )
    relevant_keys = {_claim_subject_key(claim) for claim in current_doc_claims}
    for claim in Claim.objects.select_related("subject_entity", "source_chunk", "source_chunk__document"):
        key = _claim_subject_key(claim)
        if key in relevant_keys:
            grouped[key].append(claim)

    for key, claims in grouped.items():
        seen_prices = {}
        for claim in claims:
            match = PRICE_PATTERN.search(claim.text)
            if not match:
                continue
            seen_prices.setdefault(match.group(1), []).append(claim)
        if len(seen_prices) > 1:
            flat_claims = [claim for claim_list in seen_prices.values() for claim in claim_list]
            claim_ids = sorted(claim.id for claim in flat_claims)
            existing = SelfHealingTask.objects.filter(
                task_type=SelfHealingTask.TYPE_CONTRADICTION,
                payload__claim_ids=claim_ids,
            ).exists()
            if existing:
                continue
            task = SelfHealingTask.objects.create(
                task_type=SelfHealingTask.TYPE_CONTRADICTION,
                priority=3,
                title=f"Contradiction detected for {key}",
                description="Conflicting values were found across related claims and documents.",
                related_document=document,
                payload={
                    "claim_ids": claim_ids,
                    "claims": [
                        {
                            "id": claim.id,
                            "text": claim.text,
                            "chunk_id": claim.source_chunk_id,
                            "document_id": claim.source_chunk.document_id,
                            "document_title": claim.source_chunk.document.title,
                        }
                        for claim in flat_claims
                    ],
                },
            )
            tasks.append(task)
    return tasks
