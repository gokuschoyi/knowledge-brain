from __future__ import annotations

from typing import Iterable


MAX_CALIBRATED_CONFIDENCE = 0.95
DEFAULT_ENTITY_CONFIDENCE = 0.72
DEFAULT_CLAIM_CONFIDENCE = 0.68
DEFAULT_RELATIONSHIP_CONFIDENCE = 0.66

GENERIC_ENTITY_NAMES = {
    "api",
    "app",
    "application",
    "company",
    "concept",
    "feature",
    "framework",
    "module",
    "page",
    "plan",
    "platform",
    "pricing",
    "product",
    "project",
    "service",
    "system",
    "tool",
    "workflow",
}


def clamp_confidence(value: float, maximum: float = MAX_CALIBRATED_CONFIDENCE) -> float:
    return round(max(0.0, min(maximum, value)), 2)


def normalize_raw_confidence(raw_value: object, fallback: float) -> float:
    if isinstance(raw_value, bool):
        return fallback
    if isinstance(raw_value, (float, int)):
        return clamp_confidence(float(raw_value), maximum=1.0)
    if isinstance(raw_value, str):
        try:
            return clamp_confidence(float(raw_value), maximum=1.0)
        except ValueError:
            return fallback
    return fallback


def calibrate_entity_confidence(
    *,
    raw_confidence: float,
    name: str,
    description: str,
    mention_count: int = 1,
) -> tuple[float, list[str]]:
    score = raw_confidence
    notes: list[str] = []
    cleaned_name = name.strip()
    lowered_name = cleaned_name.lower()
    description = description.strip()

    if len(cleaned_name.split()) > 1:
        score += 0.03
        notes.append("multi_word_name")
    if len(cleaned_name) < 4 or lowered_name in GENERIC_ENTITY_NAMES:
        score -= 0.08
        notes.append("generic_or_short_name")
    if description:
        if len(description) >= 50:
            score += 0.03
            notes.append("grounded_description")
        else:
            score -= 0.02
            notes.append("thin_description")
    else:
        score -= 0.06
        notes.append("missing_description")

    if mention_count > 1:
        score += min(0.06, 0.02 * (mention_count - 1))
        notes.append("repeated_mentions")

    if raw_confidence >= 0.99:
        notes.append("raw_saturated")

    return clamp_confidence(score), notes


def aggregate_entity_confidence(calibrated_confidences: Iterable[float], mention_count: int) -> float:
    confidences = list(calibrated_confidences)
    if not confidences:
        return 0.0
    score = max(confidences)
    if mention_count > 1:
        score += min(0.04, 0.015 * (mention_count - 1))
    return clamp_confidence(score)


def derive_mention_confidence(entity_confidence: float) -> float:
    return clamp_confidence(max(0.05, entity_confidence - 0.03))


def calibrate_claim_confidence(
    *,
    raw_confidence: float,
    text: str,
    has_subject_entity: bool,
) -> tuple[float, list[str]]:
    score = raw_confidence
    notes: list[str] = []
    length = len(text.strip())

    if length >= 80:
        score += 0.03
        notes.append("detailed_claim")
    elif length < 35:
        score -= 0.08
        notes.append("short_claim")

    if has_subject_entity:
        score += 0.03
        notes.append("resolved_subject")
    else:
        score -= 0.06
        notes.append("unresolved_subject")

    if raw_confidence >= 0.99:
        notes.append("raw_saturated")

    return clamp_confidence(score), notes


def calibrate_relationship_confidence(
    *,
    raw_confidence: float,
    relationship_type: str,
    normalized_type: str,
    source_resolved: bool,
    target_resolved: bool,
) -> tuple[float, list[str]]:
    score = raw_confidence
    notes: list[str] = []

    if source_resolved and target_resolved:
        score += 0.03
        notes.append("resolved_endpoints")
    else:
        score -= 0.08
        notes.append("weak_endpoints")

    cleaned_type = relationship_type.strip().lower()
    if normalized_type == "related_to" or cleaned_type == "related_to":
        score -= 0.06
        notes.append("fallback_relationship_type")
    elif cleaned_type and "_" in cleaned_type or " " not in cleaned_type:
        score += 0.02
        notes.append("specific_relationship_type")

    if raw_confidence >= 0.99:
        notes.append("raw_saturated")

    return clamp_confidence(score), notes


def inspect_payload_confidence_patterns(payload: dict) -> list[str]:
    confidences: list[float] = []
    for key in ("entities", "claims", "relationships"):
        items = payload.get(key, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            if "confidence" in item:
                confidences.append(normalize_raw_confidence(item.get("confidence"), 0.0))

    if len(confidences) < 2:
        return []

    warnings: list[str] = []
    if all(confidence >= 0.99 for confidence in confidences):
        warnings.append("all_confidences_saturated")
    elif sum(1 for confidence in confidences if confidence >= 0.99) / len(confidences) >= 0.8:
        warnings.append("most_confidences_saturated")

    if len({round(confidence, 4) for confidence in confidences}) == 1:
        warnings.append("uniform_confidences")

    return warnings
