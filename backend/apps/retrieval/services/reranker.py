from __future__ import annotations


def rerank_results(results: list[dict]) -> list[dict]:
    return sorted(results, key=lambda item: (item["score"], item["chunk"].quality_score), reverse=True)

