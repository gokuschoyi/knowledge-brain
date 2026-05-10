from __future__ import annotations

from apps.core.utils import normalise_query_text, query_terms
from apps.knowledge.models import Claim, Entity, Relationship


def _term_overlap_score(terms: list[str], text: str) -> float:
    if not terms or not text:
        return 0.0
    lowered = text.lower()
    matches = sum(1 for term in terms if term in lowered)
    return matches / max(1, len(terms))


def _entity_score(entity: Entity, normalized_question: str, terms: list[str]) -> float:
    score = 0.0
    alias_text = " ".join(entity.aliases)

    if normalized_question:
        if normalized_question in entity.name.lower():
            score += 0.95
        if entity.canonical_name and normalized_question in entity.canonical_name.lower():
            score += 0.85
        if alias_text and normalized_question in alias_text.lower():
            score += 0.8
        if entity.retrieval_text and normalized_question in entity.retrieval_text.lower():
            score += 0.55
        if entity.description and normalized_question in entity.description.lower():
            score += 0.45

    score += _term_overlap_score(terms, entity.name) * 0.8
    score += _term_overlap_score(terms, entity.canonical_name) * 0.55
    score += _term_overlap_score(terms, alias_text) * 0.5
    score += _term_overlap_score(terms, entity.description) * 0.45
    score += _term_overlap_score(terms, entity.retrieval_text) * 0.35
    score += min(0.2, entity.mention_count * 0.02)
    score += min(0.12, entity.source_document_count * 0.03)
    score += min(0.2, entity.confidence * 0.2)

    if entity.metadata.get("has_generic_definition"):
        score -= 0.08
    if entity.metadata.get("has_contradictions"):
        score -= 0.03

    return round(score, 4)


def expand_graph(question: str, brain_id: str | None = None) -> dict:
    normalized_question = normalise_query_text(question)
    terms = query_terms(question)
    entity_qs = Entity.objects.all()
    if brain_id:
        entity_qs = entity_qs.filter(brain_id=brain_id)

    scored_entities = []
    for entity in entity_qs:
        score = _entity_score(entity, normalized_question, terms)
        if score <= 0.12:
            continue
        scored_entities.append((score, entity))
    scored_entities.sort(key=lambda item: item[0], reverse=True)
    entities = [entity for _, entity in scored_entities[:8]]

    relationships: list[Relationship] = []
    claims: list[Claim] = []
    contradiction_warnings: list[str] = []

    if entities:
        entity_ids = {entity.id for entity in entities}
        relationship_candidates = list(
            Relationship.objects.filter(source_entity_id__in=entity_ids).select_related(
                "source_entity", "target_entity"
            )
        ) + list(
            Relationship.objects.filter(target_entity_id__in=entity_ids).select_related(
                "source_entity", "target_entity"
            )
        )
        relationship_candidates = list(
            {relationship.id: relationship for relationship in relationship_candidates}.values()
        )
        relationship_candidates.sort(
            key=lambda relationship: (
                int(relationship.source_entity_id in entity_ids) + int(relationship.target_entity_id in entity_ids),
                relationship.confidence,
            ),
            reverse=True,
        )
        relationships = relationship_candidates[:16]

        claim_candidates = list(
            Claim.objects.filter(subject_entity_id__in=entity_ids).select_related(
                "source_chunk", "subject_entity", "source_chunk__document"
            )
        )
        contradiction_question = any(
            marker in normalized_question
            for marker in ("contradiction", "conflict", "disagree", "difference", "compare")
        )
        claim_candidates.sort(
            key=lambda claim: (
                0 if contradiction_question else int(not claim.contradiction_flag),
                int(claim.contradiction_review_state == Claim.REVIEW_AUTHORITATIVE),
                int(claim.contradiction_review_state == Claim.REVIEW_ACTIVE),
                claim.confidence,
                claim.created_at,
            ),
            reverse=True,
        )
        claims = claim_candidates[:16]
        contradiction_warnings = [
            f"Conflicting claims exist for {claim.subject_entity.name if claim.subject_entity else claim.subject_key}."
            for claim in claims
            if claim.contradiction_flag
        ]

    return {
        "entities": entities,
        "entity_scores": {entity.id: score for score, entity in scored_entities[:8]},
        "relationships": relationships,
        "claims": claims,
        "contradiction_warnings": list(dict.fromkeys(contradiction_warnings)),
    }
