from __future__ import annotations


def review_contradiction(payload: dict) -> dict:
    return {
        "status": "review_required",
        "task_status": "review_required",
        "message": "Contradictions are surfaced for human review and are not auto-resolved.",
        "claims": payload.get("claims", []),
    }
