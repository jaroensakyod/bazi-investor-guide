"""Extract Bursa Malaysia equity listing dates from the exchange's official PDF.

The output is a compact, reproducible JSON snapshot. It keeps the exact Bursa
short name and ISIN so the TypeScript importer can promote dates only when the
catalog ticker has one unambiguous exact match.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber


DEFAULT_SOURCE_URL = (
    "https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/"
    "assets/6814a336e6414a4b168c007b/isinequity_as_of__30_Aor_2025.pdf"
)
DEFAULT_OUTPUT = Path("data/staging/bursa-listing-dates.json")
MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_yyyymmdd(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    if not re.fullmatch(r"\d{8}", text):
        raise ValueError(f"Unsupported Bursa date value: {text!r}")
    parsed = datetime.strptime(text, "%Y%m%d")
    return parsed.date().isoformat()


def parse_source_as_of(text: str) -> str:
    match = re.search(
        r"\bAs\s+of\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b",
        text,
        flags=re.IGNORECASE,
    )
    if not match:
        raise ValueError("Could not find the Bursa PDF 'As of' date")
    month = MONTHS.get(match.group(2).lower())
    if month is None:
        raise ValueError(f"Unsupported month in Bursa PDF: {match.group(2)!r}")
    return datetime(int(match.group(3)), month, int(match.group(1))).date().isoformat()


def extract_records(pdf_path: Path) -> tuple[int, str, list[dict[str, Any]]]:
    records: list[dict[str, Any]] = []
    first_page_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)
        if page_count == 0:
            raise ValueError("Bursa PDF has no pages")
        for page_index, page in enumerate(pdf.pages):
            if page_index == 0:
                first_page_text = page.extract_text() or ""
            for table in page.extract_tables() or []:
                for row in table or []:
                    if not row or len(row) < 7:
                        continue
                    number = clean_text(row[0])
                    if not re.fullmatch(r"\d+", number):
                        continue
                    stock_name_long = clean_text(row[1])
                    stock_name_short = clean_text(row[2]).upper()
                    isin = clean_text(row[3]).upper()
                    issue_description = clean_text(row[4])
                    if not stock_name_long or not stock_name_short or not issue_description:
                        raise ValueError(f"Incomplete Bursa row {number} on page {page_index + 1}")
                    if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}\d", isin):
                        raise ValueError(f"Invalid ISIN {isin!r} in Bursa row {number}")
                    listing_date = parse_yyyymmdd(row[5])
                    if listing_date is None:
                        raise ValueError(f"Missing Listing Date in Bursa row {number}")
                    records.append(
                        {
                            "number": int(number),
                            "stockNameLong": stock_name_long,
                            "stockNameShort": stock_name_short,
                            "isin": isin,
                            "issueDescription": issue_description,
                            "listingDate": listing_date,
                            "maturityDate": parse_yyyymmdd(row[6]),
                        }
                    )
        source_as_of = parse_source_as_of(first_page_text)
    return page_count, source_as_of, records


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--retrieved-at")
    args = parser.parse_args()

    pdf_path = args.pdf.resolve()
    output_path = args.output.resolve()
    pdf_bytes = pdf_path.read_bytes()
    if not pdf_bytes.startswith(b"%PDF-"):
        raise ValueError(f"Input is not a PDF: {pdf_path}")

    page_count, source_as_of, extracted = extract_records(pdf_path)
    unique: dict[tuple[int, str, str], dict[str, Any]] = {}
    for record in extracted:
        key = (record["number"], record["stockNameShort"], record["isin"])
        if key in unique and unique[key] != record:
            raise ValueError(f"Conflicting duplicate Bursa row: {key}")
        unique[key] = record
    records = sorted(unique.values(), key=lambda item: item["number"])
    if not records:
        raise ValueError("No Bursa listing-date rows were extracted")

    retrieved_at = args.retrieved_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if retrieved_at.endswith("Z"):
        datetime.fromisoformat(retrieved_at[:-1] + "+00:00")
    else:
        datetime.fromisoformat(retrieved_at)

    payload = {
        "schemaVersion": 1,
        "generatedAt": retrieved_at,
        "retrievedAt": retrieved_at,
        "sourceAsOf": source_as_of,
        "sourceName": "Bursa Malaysia ISIN Equity",
        "sourceUrl": args.source_url,
        "pdfSha256": hashlib.sha256(pdf_bytes).hexdigest(),
        "pageCount": page_count,
        "records": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_name(output_path.name + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(output_path)
    print(
        json.dumps(
            {
                "output": str(output_path),
                "sourceAsOf": source_as_of,
                "pageCount": page_count,
                "records": len(records),
                "pdfSha256": payload["pdfSha256"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
