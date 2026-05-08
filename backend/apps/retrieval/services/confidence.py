from __future__ import annotations


def calculate_confidence(results: list[dict], gaps: list[str]) -> float:
    if not results:
        return 0.15
    average_score = sum(
        float(result.get("reranked_score", result.get("score", 0.0)))
        for result in results[:3]
    ) / min(3, len(results))
    penalty = min(0.3, len(gaps) * 0.12)
    return round(max(0.05, min(1.0, average_score - penalty)), 2)
