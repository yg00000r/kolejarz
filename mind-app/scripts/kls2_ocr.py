#!/usr/bin/env python3
"""OCR for scanned book PDFs: landscape A4 with two book pages side by side."""

from __future__ import annotations

import argparse
import io
import shutil
import sys
import tempfile
from pathlib import Path

import fitz
from PIL import Image


def render_page(page: fitz.Page, dpi: int) -> Image.Image:
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    return Image.open(io.BytesIO(pix.tobytes("png")))


def split_spreads(image: Image.Image) -> tuple[Image.Image, Image.Image]:
    width, height = image.size
    mid = width // 2
    left = image.crop((0, 0, mid, height))
    right = image.crop((mid, 0, width, height))
    return left, right


def is_mostly_blank(image: Image.Image, threshold: float = 0.92) -> bool:
    gray = image.convert("L")
    pixels = list(gray.getdata())
    dark = sum(1 for p in pixels if p < 40)
    light = sum(1 for p in pixels if p > 215)
    return (dark + light) / len(pixels) >= threshold


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    gray = image.convert("L")
    # Boost contrast for aged scans / serif text.
    return gray.point(lambda p: 0 if p < 128 else 255)


def ocr_image(image: Image.Image, lang: str) -> str:
    try:
        import pytesseract
    except ImportError as exc:
        raise SystemExit("Install pytesseract: pip install pytesseract") from exc

    if shutil.which("tesseract") is None:
        raise SystemExit("Tesseract not found. Install: brew install tesseract tesseract-lang")

    processed = preprocess_for_ocr(image)
    config = "--psm 3 -c preserve_interword_spaces=1"
    return pytesseract.image_to_string(processed, lang=lang, config=config).strip()


def ocr_pdf(
    pdf_path: Path,
    output_path: Path,
    *,
    dpi: int = 300,
    lang: str = "pol",
    start_page: int = 0,
    end_page: int | None = None,
    skip_blank: bool = True,
) -> None:
    doc = fitz.open(pdf_path)
    total = doc.page_count
    end = total if end_page is None else min(end_page, total)

    book_page = 0
    lines: list[str] = []

    for pdf_idx in range(start_page, end):
        page = doc[pdf_idx]
        image = render_page(page, dpi)
        left, right = split_spreads(image)

        for side_name, side_image in (("left", left), ("right", right)):
            if skip_blank and is_mostly_blank(side_image):
                continue

            book_page += 1
            print(f"OCR pdf page {pdf_idx + 1}/{total}, book page {book_page} ({side_name})...", flush=True)
            text = ocr_image(side_image, lang)

            lines.append(f"\n{'=' * 72}")
            lines.append(f"PDF strona {pdf_idx + 1} | strona ksiazki ~{book_page} ({side_name})")
            lines.append(f"{'=' * 72}\n")
            lines.append(text)
            lines.append("")

    doc.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nSaved {book_page} book pages to {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "pdf",
        nargs="?",
        default="/Users/ygor/Downloads/kls2_1.pdf",
        type=Path,
        help="Input PDF path",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("/Users/ygor/Downloads/kls2_1.txt"),
        help="Output text file",
    )
    parser.add_argument("--dpi", type=int, default=300, help="Render DPI for OCR")
    parser.add_argument("--lang", default="pol", help="Tesseract language code")
    parser.add_argument("--start", type=int, default=0, help="First PDF page index (0-based)")
    parser.add_argument("--end", type=int, default=None, help="Last PDF page index (exclusive)")
    parser.add_argument(
        "--no-skip-blank",
        action="store_true",
        help="OCR blank/black halves too",
    )
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    ocr_pdf(
        args.pdf,
        args.output,
        dpi=args.dpi,
        lang=args.lang,
        start_page=args.start,
        end_page=args.end,
        skip_blank=not args.no_skip_blank,
    )


if __name__ == "__main__":
    main()
