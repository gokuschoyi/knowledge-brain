from __future__ import annotations

import os
import sys
from pathlib import Path
import django

BASE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


django.setup()
from apps.documents.models import Document, IngestionJob
from apps.documents.services.ingestion_pipeline import run_ingestion_pipeline

DEMO_DOCUMENTS = [
    (
        "Product Overview",
        """Smart Tutor helps students understand lessons and generate lesson plans.

It supports curriculum alignment and tracks Student Progress across classes.

Smart Tutor uses lesson plans to personalise student support.""",
    ),
    (
        "Product Roadmap",
        """AI Tutor, also described internally as SmartTutor, expands the learning plan generator.

The roadmap says SmartTutor supports curriculum workflows and uses student progress data.""",
    ),
    (
        "Pricing Notes",
        """The Pro Plan costs $20/month.

Smart Tutor is included in the Pro Plan.""",
    ),
    (
        "Updated Pricing Notes",
        """The Pro Plan costs $30/month after the latest update.

AI Tutor remains part of the Pro Plan.""",
    ),
    (
        "Incomplete Training Notes",
        """The training plan requires sponsor approval and practical support.

The duration of the training plan is not clearly defined in these notes.""",
    ),
]


def main() -> None:
    for title, raw_text in DEMO_DOCUMENTS:
        document = Document.objects.create(
            title=title, source_type=Document.SOURCE_TEXT, raw_text=raw_text, tags=["demo"]
        )
        job = IngestionJob.objects.create(document=document)
        run_ingestion_pipeline(document.id, job.id)
        print(f"Ingested {title}")


if __name__ == "__main__":
    main()
