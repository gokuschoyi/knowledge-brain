from __future__ import annotations


def classify_query(question: str) -> str:
    lowered = question.lower()
    if "compare" in lowered:
        return "COMPARISON"
    if "relationship" in lowered or "relate" in lowered:
        return "RELATIONSHIP"
    if "summary" in lowered:
        return "SUMMARY"
    if "contradict" in lowered or "conflict" in lowered:
        return "CONTRADICTION_CHECK"
    if "timeline" in lowered or "when" in lowered:
        return "TIMELINE"
    return "FACTUAL"

