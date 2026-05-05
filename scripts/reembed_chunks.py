from __future__ import annotations

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from apps.documents.models import Chunk
from apps.retrieval.services.embedding import embed_text


def main() -> None:
    count = 0
    for chunk in Chunk.objects.select_related("document").all().iterator():
        embedding, embedding_metadata = embed_text(chunk.text, input_type="document")
        metadata = dict(chunk.metadata)
        metadata.update(embedding_metadata)
        chunk.embedding = embedding
        chunk.metadata = metadata
        chunk.save(update_fields=["embedding", "metadata"])
        count += 1
    print(f"Re-embedded {count} chunks.")


if __name__ == "__main__":
    main()

