from __future__ import annotations

import hashlib
import math
import re
from typing import Iterable


def normalise_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower()).strip()


def normalise_query_text(value: str) -> str:
    terms = re.findall(r"[a-z0-9]+", value.lower())
    return " ".join(term for term in terms if len(term) > 2).strip()


def query_terms(value: str) -> list[str]:
    normalized = normalise_query_text(value)
    if not normalized:
        return []
    seen: list[str] = []
    for term in normalized.split():
        if term not in seen:
            seen.append(term)
    return seen


def token_estimate(text: str) -> int:
    return max(1, math.ceil(len(text.split()) * 1.3))


def deterministic_embedding(text: str, dimensions: int = 1536) -> list[float]:
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    seed = list(digest) * ((dimensions // len(digest)) + 1)
    vector = [((seed[index] / 255.0) * 2) - 1 for index in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def cosine_similarity(left: Iterable[float], right: Iterable[float]) -> float:
    left_list = list(left)
    right_list = list(right)
    if not left_list or not right_list:
        return 0.0
    numerator = sum(a * b for a, b in zip(left_list, right_list))
    left_norm = math.sqrt(sum(a * a for a in left_list)) or 1.0
    right_norm = math.sqrt(sum(b * b for b in right_list)) or 1.0
    return numerator / (left_norm * right_norm)


def to_json_safe(value):
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): to_json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_json_safe(item) for item in value]

    item_method = getattr(value, "item", None)
    if callable(item_method):
        try:
            return to_json_safe(item_method())
        except Exception:
            pass

    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        try:
            return isoformat()
        except Exception:
            pass

    return str(value)
