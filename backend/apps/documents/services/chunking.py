from __future__ import annotations

from apps.core.utils import token_estimate


def chunk_text(text: str, target_tokens: int = 400, overlap_tokens: int = 50) -> list[dict]:
    separators = ["\n\n", "\n", ". ", " ", ""]

    def split_with_positions(text: str, start_offset: int, current_separators: list[str]) -> list[tuple[str, int]]:
        if token_estimate(text) <= target_tokens or not current_separators:
            return [(text, start_offset)]

        separator = current_separators[0]
        result = []
        cursor = 0
        for part in text.split(separator):
            if token_estimate(part) > target_tokens:
                result.extend(split_with_positions(part, start_offset + cursor, current_separators[1:]))
            else:
                result.append((part, start_offset + cursor))
            cursor += len(part) + len(separator)
        return result

    raw_parts = split_with_positions(text, 0, separators)
    chunks: list[dict] = []
    current_text = ""
    current_start = 0
    last_end = 0

    for part_text, part_start in raw_parts:
        last_end = part_start + len(part_text)
        if current_text and token_estimate(current_text + part_text) > target_tokens:
            stripped = current_text.strip()
            chunk_end = part_start
            chunks.append({
                "text": stripped,
                "token_count": token_estimate(current_text),
                "start_char": current_start,
                "end_char": chunk_end,
            })
            # Overlap: 15% of assembled text, approximate position in original
            overlap_len_chars = int((chunk_end - current_start) * 0.15)
            current_start = max(current_start, chunk_end - overlap_len_chars)
            overlap_text = current_text[int(len(current_text) * 0.85):]
            current_text = overlap_text + part_text + " "
        else:
            if not current_text:
                current_start = part_start
            current_text += part_text + " "

    if current_text:
        chunks.append({
            "text": current_text.strip(),
            "token_count": token_estimate(current_text),
            "start_char": current_start,
            "end_char": last_end,
        })

    return chunks
