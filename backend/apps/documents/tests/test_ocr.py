from __future__ import annotations

import os
from django.test import TestCase
from apps.core.models import Brain
import shutil
import subprocess
import tempfile
import json
from pathlib import Path
import pymupdf


def _extract_bboxes_with_pymupdf(pdf_path: str | Path) -> list[dict]:
    """
    Extracts word-level bounding boxes using PyMuPDF.
    Returns a list of dicts: {"text": str, "bbox": tuple, "page": int}
    """
    doc = pymupdf.open(pdf_path)
    all_words = []
    for page_index, page in enumerate(doc, 1):
        # get_text("words") returns: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
        words = page.get_text("words")
        for w in words:
            all_words.append({"text": w[4], "bbox": (w[0], w[1], w[2], w[3]), "page": page_index})
    doc.close()
    return all_words


class OCRmyPDFIntegrationTest(TestCase):
    def setUp(self):
        self.brain = Brain.objects.create(name="OCR Test Brain")

    def test_ocrmypdf_executable_exists(self):
        """Check if ocrmypdf is actually available in the environment."""
        self.assertIsNotNone(shutil.which("ocrmypdf"), "ocrmypdf executable not found in PATH")

    def test_pdf_bbox_extraction(self):
        """Test extraction of bounding boxes from a PDF."""
        sample_pdf = "media/documents/New_Passport.pdf"
        if not os.path.exists(sample_pdf):
            # Fallback to absolute path search if relative fails
            sample_pdf = "/home/goku/Desktop/knowledge-brain/backend/media/documents/New_Passport.pdf"
            if not os.path.exists(sample_pdf):
                self.skipTest(f"Sample file {sample_pdf} not found.")

        # 1. Test standard extraction
        bboxes = _extract_bboxes_with_pymupdf(sample_pdf)
        print(f"\nExtracted {len(bboxes)} word bounding boxes from standard PDF.")
        if bboxes:
            print(f"Sample bbox: {bboxes[0]}")

        self.assertGreater(len(bboxes), 0)
        for item in bboxes:
            self.assertIn("text", item)
            self.assertIn("bbox", item)
            self.assertEqual(len(item["bbox"]), 4)

        # Output the contents to a JSON file
        output_file = Path("test_bboxes_output.json")
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(bboxes, f, indent=2)
        print(f"\nSaved standard extraction bboxes to {output_file.absolute()}")

    def test_ocrmypdf_with_bboxes(self):
        """Test OCRmyPDF and then extract bounding boxes from the searchable result."""
        sample_pdf = "media/documents/New_Passport.pdf"
        if not os.path.exists(sample_pdf):
            sample_pdf = "/home/goku/Desktop/knowledge-brain/backend/media/documents/New_Passport.pdf"
            if not os.path.exists(sample_pdf):
                self.skipTest("Sample file not found.")

        with tempfile.TemporaryDirectory() as temp_dir:
            output_pdf = Path(temp_dir) / "ocr_output.pdf"

            # Run OCRmyPDF
            command = [
                "ocrmypdf",
                "--force-ocr",  # Force OCR to ensure we generate the text layer
                "--pages",
                "1",  # Just do page 1 for speed
                str(sample_pdf),
                str(output_pdf),
            ]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, f"OCRmyPDF failed: {result.stderr}")

            # Extract bounding boxes from the OCR'd PDF
            bboxes = _extract_bboxes_with_pymupdf(output_pdf)
            print(f"\nExtracted {len(bboxes)} word bounding boxes from OCR'd PDF.")
            if bboxes:
                print(f"Sample OCR bbox: {bboxes[0]}")

            self.assertGreater(len(bboxes), 0)

            # Output the OCR results to a JSON file
            ocr_output_file = Path("test_ocr_bboxes_output.json")
            with open(ocr_output_file, "w", encoding="utf-8") as f:
                json.dump(bboxes, f, indent=2)
            print(f"\nSaved OCR extraction bboxes to {ocr_output_file.absolute()}")
