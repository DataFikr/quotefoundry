"""main.py — LeadFinder CLI.

    python main.py                      # default queries → companies.csv
    python main.py --max 40             # cap number of companies
    python main.py --queries "sheet metal fabrication texas" "weld shop ohio"
    python main.py --playwright         # enable JS rendering fallback
    python main.py --out leads.csv

Discovers North American sheet-metal fabrication companies via the Brave Search
API, crawls a handful of pages per site, extracts contact details, dedupes by
domain, and exports a CSV.
"""
from __future__ import annotations

import os
import sys
import argparse
import logging

from dotenv import load_dotenv

import config
from search import BraveSearch
from crawler import SiteCrawler
from extractor import extract, lead_to_row
from export import export_leads
from utils import registered_domain


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="leadfinder", description="Find sheet-metal fabrication leads.")
    p.add_argument("--queries", nargs="+", default=None, help="Override the default search queries.")
    p.add_argument("--max", type=int, default=config.MAX_COMPANIES, help="Max companies to collect.")
    p.add_argument("--per-query", type=int, default=config.RESULTS_PER_QUERY, help="Brave results per query (<=20).")
    p.add_argument("--playwright", action="store_true", help="Render JS-heavy pages with Playwright.")
    p.add_argument("--out", default=config.OUTPUT_CSV, help="Output CSV path.")
    p.add_argument("-v", "--verbose", action="store_true", help="Debug logging.")
    return p.parse_args(argv)


def run(args: argparse.Namespace) -> int:
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(message)s",
    )
    log = logging.getLogger("leadfinder")

    load_dotenv()
    api_key = os.getenv("BRAVE_API_KEY", "")
    if not api_key:
        log.error("BRAVE_API_KEY not set. Copy .env.example to .env and add your key.")
        return 2

    queries = args.queries or config.DEFAULT_QUERIES

    search = BraveSearch(api_key, results_per_query=args.per_query)
    crawler = SiteCrawler(use_playwright=args.playwright)
    rows: list[dict] = []
    seen_domains: set[str] = set()

    try:
        domains = search.discover_domains(queries)
        for root in domains:
            if len(rows) >= args.max:
                break
            dom = registered_domain(root)
            if dom in seen_domains:
                continue
            seen_domains.add(dom)

            log.info("Crawling %s", root)
            pages = crawler.crawl_site(root)
            lead = extract(root, pages)
            if lead is None:
                log.info("  no contact info found — skipped")
                continue
            log.info("  ✓ %s <%s> %s", lead.company_name, lead.contact_email or "—", lead.phone_number or "")
            rows.append(lead_to_row(lead))
    finally:
        search.close()
        crawler.close()

    df = export_leads(rows, args.out)
    log.info("Done. %d leads in %s", len(df), args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(run(parse_args(sys.argv[1:])))
