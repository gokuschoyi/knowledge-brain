from __future__ import annotations

from apps.core.utils import token_estimate


def chunk_text(text: str, target_tokens: int = 400, overlap_tokens: int = 50) -> list[dict]:
    # Recursive character splitting logic
    separators = ["\n\n", "\n", ". ", " ", ""]
    
    def split_text(text: str, current_separators: list[str]) -> list[str]:
        if token_estimate(text) <= target_tokens or not current_separators:
            return [text]
        
        separator = current_separators[0]
        parts = text.split(separator)
        final_parts = []
        
        for part in parts:
            if token_estimate(part) > target_tokens:
                final_parts.extend(split_text(part, current_separators[1:]))
            else:
                final_parts.append(part)
        return final_parts

    raw_chunks = split_text(text, separators)
    chunks: list[dict] = []
    current_chunk = ""
    
    for part in raw_chunks:
        if current_chunk and token_estimate(current_chunk + part) > target_tokens:
            chunks.append({"text": current_chunk.strip(), "token_count": token_estimate(current_chunk)})
            # Basic overlap: take the last 15% of the text
            current_chunk = current_chunk[int(len(current_chunk) * 0.85):] + part
        else:
            current_chunk += part + " "

    if current_chunk:
        chunks.append({"text": current_chunk.strip(), "token_count": token_estimate(current_chunk)})

    return chunks


