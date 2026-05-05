from __future__ import annotations

from apps.core.utils import token_estimate


def chunk_text(text: str, target_tokens: int = 900, overlap_tokens: int = 120) -> list[dict]:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    chunks: list[dict] = []
    current: list[str] = []
    current_tokens = 0

    for paragraph in paragraphs:
        paragraph_tokens = token_estimate(paragraph)
        if current and current_tokens + paragraph_tokens > target_tokens:
            chunk_text_value = "\n\n".join(current)
            chunks.append({"text": chunk_text_value, "token_count": token_estimate(chunk_text_value)})
            overlap_words = " ".join(chunk_text_value.split()[-overlap_tokens:])
            current = [overlap_words, paragraph] if overlap_words else [paragraph]
            current_tokens = token_estimate("\n\n".join(current))
        else:
            current.append(paragraph)
            current_tokens += paragraph_tokens

    if current:
        chunk_text_value = "\n\n".join(current)
        chunks.append({"text": chunk_text_value, "token_count": token_estimate(chunk_text_value)})

    if not chunks and text.strip():
        chunks.append({"text": text.strip(), "token_count": token_estimate(text.strip())})
    return chunks

