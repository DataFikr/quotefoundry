#!/usr/bin/env python3
"""
parse_leads.py — normalize scraped metal-shop lead lists into one CSV for DB upload.

The sales team scrapes two formats:

  txt   Thomasnet "JSON-LD" — schema.org ItemList of LocalBusiness, one JSON
        document per LINE (NDJSON); also tolerates a single JSON array/object.
        Provides: name, city, state, website (+ street address). NO phone/email.

  json  Google Maps export — a JSON array of place objects (title, phone, city,
        emails[], website, socials). Provides: name, phone, city, email, website.
        NO state, NO street address.

Both are flattened to the unified lead schema the database expects:

    name, contact, phone, city, state, website   (+ source, source_file)

  * "contact" holds the primary EMAIL (what a cold-email campaign actually needs).
    Thomasnet rows have none, so it comes out blank there — see the completeness
    report the script prints, and the evaluation notes.

USAGE
    python parse_leads.py INPUT [INPUT ...] [-o leads.csv]
                          [--format {auto,json,txt}] [--no-dedupe]

    # one file, format inferred from the extension
    python parse_leads.py shopListHouston.json
    python parse_leads.py thomasnet_list_sheet_metal.txt -o dallas.csv

    # batch several dumps of both kinds into one DB-ready file
    python parse_leads.py *.json *.txt -o all_leads.csv

Offline, Python 3.8+, standard library only. Drop in more .json/.txt samples
from the sales team and re-run — no code changes needed.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

# Output columns (first six are the requested schema; the last two are
# provenance, which a lead database wants so a bad source can be traced/purged).
FIELDS = ["name", "contact", "phone", "city", "state", "website", "source", "source_file"]

# Company-name suffixes stripped only when building the dedupe key (never from
# the output name), so "Delta Steel" and "Delta Steel, Inc." collapse to one row.
_SUFFIXES = re.compile(
    r"[,\.]?\s*\b(inc|incorporated|llc|l\.l\.c|co|corp|corporation|ltd|company|mfg|manufacturing)\b\.?$",
    re.IGNORECASE,
)


def clean(value) -> str:
    """Trim, collapse internal whitespace, and coerce None/non-str to ''."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def norm_phone(value) -> str:
    """Light US normalization to '+1 (xxx) xxx-xxxx'; anything else passes through
    trimmed (never mangled — the DB can normalize further)."""
    raw = clean(value)
    if not raw:
        return ""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"+1 ({digits[0:3]}) {digits[3:6]}-{digits[6:]}"
    return raw


def first_str(value) -> str:
    """First non-empty string from a scalar or a list (e.g. emails[], sameAs[])."""
    if isinstance(value, list):
        for v in value:
            s = clean(v)
            if s:
                return s
        return ""
    return clean(value)


def dedupe_key(row: dict) -> tuple:
    name = _SUFFIXES.sub("", clean(row["name"]).lower()).strip()
    name = re.sub(r"[^a-z0-9 ]", "", name)
    return (name, clean(row["city"]).lower(), clean(row["state"]).lower())


# ---------------------------------------------------------------------------
# Format sniffing + JSON document iteration
# ---------------------------------------------------------------------------
def iter_json_docs(text: str):
    """Yield top-level JSON value(s). Whole-file JSON first; on failure, treat the
    text as NDJSON (one JSON document per non-blank line) — Thomasnet's shape."""
    text = text.strip()
    if not text:
        return
    try:
        yield json.loads(text)
        return
    except json.JSONDecodeError:
        pass
    for line in text.splitlines():
        line = line.strip().rstrip(",")  # tolerate trailing commas between lines
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError as e:
            print(f"  ! skipped an unparseable line: {e}", file=sys.stderr)


def looks_like_thomasnet(text: str) -> bool:
    head = text.lstrip()[:4000]
    return ("itemListElement" in head) or ("schema.org" in head and "LocalBusiness" in head)


def resolve_format(path: Path, forced: str, text: str) -> str:
    """auto = decide by content first, then extension. Content wins so a
    mislabeled file (e.g. Thomasnet data saved as .json) still parses right."""
    if forced != "auto":
        return forced
    if looks_like_thomasnet(text):
        return "txt"
    if path.suffix.lower() == ".txt":
        return "txt"
    return "json"


# ---------------------------------------------------------------------------
# Per-format extractors → unified rows
# ---------------------------------------------------------------------------
def parse_thomasnet(text: str, source_file: str):
    """schema.org ItemList(s) of LocalBusiness → unified rows."""
    rows = []
    for doc in iter_json_docs(text):
        nodes = doc.get("@graph", [doc]) if isinstance(doc, dict) else (doc if isinstance(doc, list) else [])
        for node in nodes:
            if not isinstance(node, dict):
                continue
            elements = node.get("itemListElement")
            if not elements:  # some dumps put items at the top level
                elements = [node] if node.get("@type") in ("LocalBusiness", "Organization") else []
            for el in elements:
                item = el.get("item", el) if isinstance(el, dict) else {}
                if not isinstance(item, dict):
                    continue
                name = clean(item.get("name"))
                if not name:
                    continue
                addr = item.get("address", {}) or {}
                rows.append({
                    "name": name,
                    "contact": clean(item.get("email")),           # schema.org email if ever present
                    "phone": norm_phone(item.get("telephone")),    # schema.org telephone if ever present
                    "city": clean(addr.get("addressLocality")),
                    "state": clean(addr.get("addressRegion")),
                    "website": first_str(item.get("sameAs")),
                    "source": "thomasnet",
                    "source_file": source_file,
                })
    return rows


def parse_gmaps(text: str, source_file: str):
    """Google Maps export (array of place objects) → unified rows."""
    rows = []
    for doc in iter_json_docs(text):
        records = doc if isinstance(doc, list) else [doc]
        for d in records:
            if not isinstance(d, dict):
                continue
            name = clean(d.get("title") or d.get("name"))
            if not name:
                continue
            rows.append({
                "name": name,
                "contact": first_str(d.get("emails") or d.get("email")),
                "phone": norm_phone(d.get("phone") or d.get("phoneUnformatted")),
                "city": clean(d.get("city")),
                # 'state' isn't in this sample, but future Apify Google-Maps
                # exports often include it — read it when present, else blank.
                "state": clean(d.get("state")),
                "website": clean(d.get("website")),
                "source": "gmaps",
                "source_file": source_file,
            })
    return rows


PARSERS = {"txt": parse_thomasnet, "json": parse_gmaps}


# ---------------------------------------------------------------------------
# Dedupe (merge-fill) + report
# ---------------------------------------------------------------------------
def dedupe(rows: list, enabled: bool):
    if not enabled:
        return rows, 0
    merged = {}
    dupes = 0
    for row in rows:
        key = dedupe_key(row)
        if key in merged:
            dupes += 1
            existing = merged[key]
            for f in ("contact", "phone", "city", "state", "website"):
                if not existing[f] and row[f]:  # fill blanks only, never overwrite
                    existing[f] = row[f]
        else:
            merged[key] = dict(row)
    return list(merged.values()), dupes


def completeness(rows: list) -> str:
    n = len(rows) or 1
    def pct(f):
        c = sum(1 for r in rows if r[f])
        return f"{c:>4}/{len(rows)} ({c * 100 // n:>3}%)"
    return "\n".join(
        f"    {f:<8} {pct(f)}" for f in ("name", "contact", "phone", "city", "state", "website")
    )


SCRIPT_DIR = Path(__file__).parent


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Parse scraped metal-shop leads (txt/json) into one CSV.")
    ap.add_argument("inputs", nargs="*",
                    help="input file(s): Thomasnet .txt and/or Google-Maps .json "
                         "(default: all .json files in the script's directory)")
    ap.add_argument("-o", "--output", default=str(SCRIPT_DIR / "all_leads.csv"),
                    help="output CSV path (default: all_leads.csv next to this script)")
    ap.add_argument("--format", choices=["auto", "json", "txt"], default="auto",
                    help="force a parser; 'auto' (default) infers per file from content+extension")
    ap.add_argument("--no-dedupe", action="store_true", help="keep every row (skip merge-dedupe)")
    args = ap.parse_args(argv)

    # Default: all .json files in the script's directory, sorted for reproducibility.
    input_paths = args.inputs or sorted(str(p) for p in SCRIPT_DIR.glob("*.json"))
    if not input_paths:
        print("No input files found — pass file arguments or add .json files to the script directory.",
              file=sys.stderr)
        return 1

    all_rows = []
    per_source = {}
    for arg in input_paths:
        path = Path(arg)
        if not path.is_file():
            print(f"! not a file, skipping: {path}", file=sys.stderr)
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        fmt = resolve_format(path, args.format, text)
        rows = PARSERS[fmt](text, path.name)
        print(f"- {path.name}: parsed {len(rows)} record(s) as '{fmt}'")
        per_source[fmt] = per_source.get(fmt, 0) + len(rows)
        all_rows.extend(rows)

    if not all_rows:
        print("No records parsed — nothing written.", file=sys.stderr)
        return 1

    rows, dupes = dedupe(all_rows, enabled=not args.no_dedupe)

    out = Path(args.output)
    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print("-" * 60)
    print(f"parsed   : {len(all_rows)} record(s)  " + ", ".join(f"{k}={v}" for k, v in per_source.items()))
    if not args.no_dedupe:
        print(f"deduped  : merged {dupes} duplicate(s)")
    print(f"written  : {len(rows)} row(s) -> {out}")
    print("field completeness (non-empty):")
    print(completeness(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
