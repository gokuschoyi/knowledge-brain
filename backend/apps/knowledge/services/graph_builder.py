from __future__ import annotations

from apps.documents.models import Document


def build_graph_for_document(document: Document) -> None:
    # Relationships and mentions are created during extraction. This function
    # exists as the orchestration seam for future graph enrichment.
    return None

