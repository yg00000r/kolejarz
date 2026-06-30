#!/usr/bin/env python3
"""Split a scanned book PDF into NotebookLM-friendly chunks."""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz


def split_pdf(pdf_path: Path, output_dir: Path, pages_per_chunk: int) -> list[Path]:
    doc = fitz.open(pdf_path)
    total = doc.page_count
    output_dir.mkdir(parents=True, exist_ok=True)

    stem = pdf_path.stem
    created: list[Path] = []

    for start in range(0, total, pages_per_chunk):
        end = min(start + pages_per_chunk, total)
        chunk_idx = start // pages_per_chunk + 1
        out_path = output_dir / f"{stem}_part{chunk_idx:02d}_p{start + 1}-{end}.pdf"

        chunk = fitz.open()
        chunk.insert_pdf(doc, from_page=start, to_page=end - 1)
        chunk.save(out_path, garbage=4, deflate=True)
        chunk.close()

        created.append(out_path)
        print(f"  {out_path.name}  ({end - start} stron PDF, ~{(end - start) * 2} stron ksiazki)")

    doc.close()
    return created


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "pdf",
        nargs="?",
        type=Path,
        default=Path("/Users/ygor/Downloads/kls2_1.pdf"),
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=Path("/Users/ygor/Downloads/kls2_1_notebooklm"),
    )
    parser.add_argument(
        "--pages",
        type=int,
        default=50,
        help="PDF pages per chunk (default 50, ~100 book pages)",
    )
    args = parser.parse_args()

    if not args.pdf.exists():
        raise SystemExit(f"Brak pliku: {args.pdf}")

    print(f"Dziele {args.pdf.name} ({args.pages} stron PDF na plik)...")
    files = split_pdf(args.pdf, args.output_dir, args.pages)
    print(f"\nGotowe: {len(files)} plikow w {args.output_dir}")
    print("Wgraj je do NotebookLM jako osobne zrodla (PDF). OCR zrobi Google.")


if __name__ == "__main__":
    main()
