from __future__ import annotations

import re


def clean_text(text: str) -> str:
    compact = text.replace("\r\n", "\n").replace("\r", "\n")
    compact = re.sub(r"[ \t]+", " ", compact)
    compact = re.sub(r"\n{3,}", "\n\n", compact)
    return compact.strip()

