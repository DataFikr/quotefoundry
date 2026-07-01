# LeadFinder

Discovers North American sheet-metal / custom fabrication companies (prospects
for QuoteForge) via the **Brave Search API**, crawls a few pages per site,
extracts contact details, dedupes by domain, and exports `companies.csv`.

## Install

```bash
cd scripts/leadfinder
python -m venv .venv && . .venv/Scripts/activate      # Windows
# python -m venv .venv && source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
playwright install chromium          # only needed if you use --playwright
cp .env.example .env                 # then add your BRAVE_API_KEY
```

Get a Brave Search API key at https://brave.com/search/api/ (free tier available).

## Run

```bash
python main.py                       # default queries → companies.csv
python main.py --max 40              # cap number of companies
python main.py --queries "sheet metal fabrication texas" "weld shop ohio"
python main.py --playwright          # render JS-heavy sites (slower)
python main.py --out leads.csv -v    # custom output + debug logging
```

## Output — `companies.csv`

| Company Name | Website | Contact Email | Phone Number | Contact Page URL | RFQ Page URL |
|---|---|---|---|---|---|

## How it works (modular)

- `search.py` — Brave API queries → unique candidate domains (skips
  aggregators/directories/socials via `config.BLOCKLIST_DOMAINS`).
- `crawler.py` — fetches `/`, `/contact`, `/about`, `/request-quote` (+ contact/RFQ
  links found on the homepage). Honors `robots.txt`, spaces requests per host,
  and optionally renders JS pages with Playwright.
- `extractor.py` — company name (og:site_name / title / domain), emails
  (mailto + text, own-domain preferred), NA phone numbers, and the contact/RFQ
  page URLs.
- `export.py` — dedupe by registered domain, write the CSV.
- `config.py` — queries, crawl paths, politeness knobs, blocklists.

## Being a good citizen

Retries with backoff, respects `robots.txt`, throttles per host (`CRAWL_DELAY`),
sends an identifying `User-Agent`, and only reads publicly published contact
info. Tune `CRAWL_DELAY`, `MAX_COMPANIES`, and `RESULTS_PER_QUERY` in `config.py`.
Use responsibly and in line with the Brave API terms and applicable law.
