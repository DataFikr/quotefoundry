#!/usr/bin/env python3
"""
score_leads.py — tier the parsed lead list for the outreach campaign (doc 08).

Reads all_leads.csv (produced by parse_leads.py) and writes outreach_targets.csv:
the same columns plus `tier`, `first_line_hint`, and `batch_order`. Prints a
tier/town summary so the founder can eyeball Tier A before any send.

Who we want (the MVP's best evaluators): 5–50-person US job shops quoting custom
metal-fab / sheet-metal / weld / machining work by hand. Scoring encodes that:

  DROP    no email; placeholder/junk email; out-of-ICP trades (awning, roofing,
          fence, supply houses, distributors, mobile welding).
  TIER A  business-domain email that matches the website domain AND an ICP trade
          keyword in the name — the most established, most verifiable, most
          likely to feel the quoting pain. Email these first.
  TIER B  freemail (gmail/yahoo/…) that at least has a website, OR a business
          email that doesn't clear the Tier-A bar.
  TIER C  freemail with no website — the smallest shops (the Excel/paper 54%);
          still ICP, but lower deliverability confidence.

Offline, Python 3.8+, standard library only. Reuses clean()/_SUFFIXES from
parse_leads.py so name handling stays identical across the pipeline.

USAGE
    python score_leads.py                       # all_leads.csv -> outreach_targets.csv
    python score_leads.py -i leads.csv -o t.csv
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

from parse_leads import clean  # identical whitespace/None handling as the parser

SCRIPT_DIR = Path(__file__).parent

# Input columns from parse_leads.py; we append the three scoring columns.
BASE_FIELDS = ["name", "contact", "phone", "city", "state", "website", "source", "source_file"]
OUT_FIELDS = BASE_FIELDS + ["tier", "first_line_hint", "batch_order"]

# Personal / ISP mailboxes — a shop using one is smaller and less verifiable than
# one on its own domain (not disqualifying, just a lower tier).
FREEMAIL = {
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
    "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
    "mac.com", "comcast.net", "sbcglobal.net", "att.net", "verizon.net",
    "bellsouth.net", "cox.net", "charter.net", "earthlink.net", "protonmail.com",
    "proton.me", "gmx.com", "mail.com",
}

# Obvious scraper placeholders / non-addresses to drop outright.
PLACEHOLDER_DOMAINS = {
    "website.com", "example.com", "example.org", "domain.com", "email.com",
    "yourcompany.com", "company.com", "yourdomain.com", "sentry.io",
}
IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", re.IGNORECASE)

# Trades that are NOT our ICP — drop these even if they carry an email.
OUT_OF_ICP = ["awning", "canvas", "roofing", "fence", "mobile welding",
              "supply", "distribut"]

# ICP trade keywords (Tier-A gate). Ordered most→least specific; the first hit
# also becomes the personalization hint for the email's first line.
ICP_HINTS = [
    ("sheet metal", "sheet metal"),
    ("laser", "laser cutting"),
    ("waterjet", "waterjet cutting"),
    ("plasma", "plasma cutting"),
    ("stamping", "metal stamping"),
    ("weld", "welding"),
    ("machin", "machining"),           # machine / machining / machinist
    ("fabricat", "fabrication"),
    ("precision", "precision machining"),
    ("metal works", "metal fab"),
    ("metalworks", "metal fab"),
    ("steel", "steel fab"),
    ("iron works", "ironwork"),
    ("ironworks", "ironwork"),
    ("metal", "metal fab"),
]
DEFAULT_HINT = "custom fab"           # passed drops but has no trade word in name

TIER_RANK = {"A": 0, "B": 1, "C": 2}


def email_domain(email: str) -> str:
    return email.split("@", 1)[1].lower() if "@" in email else ""


def registered_domain(host: str) -> str:
    """Naive registered domain: strip scheme/path/www, keep the last two labels.
    Fine for the .com/.net/.us addresses in this US list (no .co.uk handling)."""
    host = clean(host).lower()
    host = re.sub(r"^https?://", "", host)
    host = host.split("/", 1)[0].split("?", 1)[0]
    host = host.split("@")[-1]                 # in case an email slips in
    if host.startswith("www."):
        host = host[4:]
    labels = [x for x in host.split(".") if x]
    return ".".join(labels[-2:]) if len(labels) >= 2 else host


def drop_reason(name_l: str, email: str, website: str) -> str | None:
    """Return a drop reason, or None if the lead is a keeper."""
    if not email:
        return "no_email"
    if not EMAIL_RE.match(email) or email.lower().endswith(IMAGE_EXTS):
        return "junk_email"
    dom = email_domain(email)
    if dom in PLACEHOLDER_DOMAINS or email.lower() == "email@website.com":
        return "placeholder_email"
    for kw in OUT_OF_ICP:
        if kw in name_l:
            return f"out_of_icp:{kw}"
    return None


def find_hint(name_l: str) -> tuple[bool, str]:
    """(is_icp, first_line_hint) from the shop name."""
    for kw, hint in ICP_HINTS:
        if kw in name_l:
            return True, hint
    return False, DEFAULT_HINT


def tier_of(email: str, website: str, is_icp: bool) -> str:
    dom = email_domain(email)
    freemail = dom in FREEMAIL
    has_site = bool(clean(website))
    if freemail:
        return "B" if has_site else "C"
    # business-domain email
    matches_site = has_site and registered_domain(website) == dom
    return "A" if (matches_site and is_icp) else "B"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Tier parsed leads for outreach (doc 08).")
    ap.add_argument("-i", "--input", default=str(SCRIPT_DIR / "all_leads.csv"),
                    help="input CSV from parse_leads.py (default: all_leads.csv)")
    ap.add_argument("-o", "--output", default=str(SCRIPT_DIR / "outreach_targets.csv"),
                    help="output CSV (default: outreach_targets.csv)")
    args = ap.parse_args(argv)

    inp = Path(args.input)
    if not inp.is_file():
        print(f"! input not found: {inp}\n  run parse_leads.py first.", file=sys.stderr)
        return 1

    with inp.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))

    kept: list[dict] = []
    drops: dict[str, int] = {}
    for r in rows:
        name_l = clean(r.get("name")).lower()
        email = clean(r.get("contact")).lower()
        website = clean(r.get("website"))
        reason = drop_reason(name_l, email, website)
        if reason:
            key = reason.split(":", 1)[0]        # group out_of_icp:* together
            drops[key] = drops.get(key, 0) + 1
            continue
        is_icp, hint = find_hint(name_l)
        row = {k: clean(r.get(k)) for k in BASE_FIELDS}
        row["contact"] = email                   # normalized lowercase email
        row["tier"] = tier_of(email, website, is_icp)
        row["first_line_hint"] = hint
        kept.append(row)

    # Send order: Tier A first, then by town (groups a town in a batch), then name.
    kept.sort(key=lambda x: (TIER_RANK[x["tier"]], x["city"].lower(), x["name"].lower()))
    for i, row in enumerate(kept, start=1):
        row["batch_order"] = i

    out = Path(args.output)
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(kept)

    _report(len(rows), drops, kept, out)
    return 0


def _report(total: int, drops: dict, kept: list, out: Path) -> None:
    tier_counts = {t: sum(1 for r in kept if r["tier"] == t) for t in ("A", "B", "C")}
    print("-" * 60)
    print(f"read     : {total} lead(s) from all_leads.csv")
    dropped = sum(drops.values())
    print(f"dropped  : {dropped}  " + ", ".join(f"{k}={v}" for k, v in sorted(drops.items())))
    print(f"targets  : {len(kept)} -> {out}")
    print(f"tiers    : A={tier_counts['A']}  B={tier_counts['B']}  C={tier_counts['C']}")
    print("\ntier x town (top towns by target count):")
    towns: dict[str, dict] = {}
    for r in kept:
        town = r["city"] or "(unknown)"
        d = towns.setdefault(town, {"A": 0, "B": 0, "C": 0})
        d[r["tier"]] += 1
    ranked = sorted(towns.items(), key=lambda kv: -sum(kv[1].values()))
    print(f"    {'town':<22} {'A':>3} {'B':>3} {'C':>3} {'tot':>4}")
    for town, d in ranked[:12]:
        tot = d["A"] + d["B"] + d["C"]
        print(f"    {town[:22]:<22} {d['A']:>3} {d['B']:>3} {d['C']:>3} {tot:>4}")
    print("\nNext: eyeball Tier A rows, then dry-run send_outreach.py --step 1.")


if __name__ == "__main__":
    raise SystemExit(main())
