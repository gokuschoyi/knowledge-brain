from __future__ import annotations

import io
import shutil
import subprocess
import tempfile
from pathlib import Path

import pymupdf
import requests
from bs4 import BeautifulSoup
from pypdf import PdfReader

from apps.documents.models import Document


def _extract_pdf_text_with_pymupdf(document: Document) -> str:
    with document.raw_file.open("rb") as handle:
        pdf_bytes = handle.read()
    pdf = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    page_text: list[str] = []
    for page in pdf:
        extracted = page.get_text("text").strip()
        if extracted:
            page_text.append(extracted)
    pdf.close()
    return "\n\n".join(page_text).strip()


def _extract_pdf_text_with_pypdf(document: Document) -> str:
    with document.raw_file.open("rb") as handle:
        reader = PdfReader(handle)
        page_text: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text() or ""
            extracted = extracted.strip()
            if extracted:
                page_text.append(extracted)
        return "\n\n".join(page_text).strip()


def _run_ocrmypdf(document: Document) -> str:
    if shutil.which("ocrmypdf") is None:
        raise RuntimeError(
            "OCRmyPDF is not installed. Install 'ocrmypdf' and 'tesseract-ocr' to OCR scanned PDFs."
        )

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        input_path = temp_dir_path / "input.pdf"
        output_path = temp_dir_path / "output_ocr.pdf"

        with document.raw_file.open("rb") as source_handle:
            input_path.write_bytes(source_handle.read())

        command = [
            "ocrmypdf",
            "--force-ocr",
            str(input_path),
            str(output_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            stderr = result.stderr.strip() or result.stdout.strip() or "Unknown OCRmyPDF error"
            raise RuntimeError(f"OCRmyPDF failed: {stderr}")

        pdf = pymupdf.open(output_path)
        page_text: list[str] = []
        for page in pdf:
            extracted = page.get_text("text").strip()
            if extracted:
                page_text.append(extracted)
        pdf.close()
        return "\n\n".join(page_text).strip()


def _extract_pdf_text(document: Document) -> str:
    pymupdf_text = _extract_pdf_text_with_pymupdf(document)
    if len(pymupdf_text) >= 80:
        return pymupdf_text

    pypdf_text = _extract_pdf_text_with_pypdf(document)
    if len(pypdf_text) >= 80:
        return pypdf_text

    ocr_text = _run_ocrmypdf(document)
    return ocr_text


def extract_text(document: Document) -> str:
    if document.source_type == Document.SOURCE_TEXT:
        return document.raw_text
    if document.source_type == Document.SOURCE_URL and document.url:
        response = requests.get(document.url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        return soup.get_text("\n", strip=True)
    if document.source_type == Document.SOURCE_FILE and document.raw_file:
        suffix = Path(document.raw_file.name).suffix.lower()
        if suffix in {".txt", ".md"}:
            with document.raw_file.open("rb") as handle:
                with io.TextIOWrapper(handle, encoding="utf-8", errors="ignore") as text_handle:
                    return text_handle.read().strip()
        if suffix == ".pdf":
            return _extract_pdf_text(document)
    return ""
