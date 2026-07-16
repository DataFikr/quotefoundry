# LeadFinder

Discovers North American sheet-metal / custom fabrication companies (prospects
for QuoteFoundry) via the **Brave Search API**, crawls a few pages per site,
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

---

# Lead-list parser — `parse_leads.py`

A separate, **offline, stdlib-only** utility (no install, no API key) that
normalizes the two lead-list formats the sales team scrapes into **one CSV** for
database upload. Drop in more `.json`/`.txt` samples and re-run — no code changes.

## The two source formats

| | `.txt` — Thomasnet | `.json` — Google Maps export |
|---|---|---|
| Shape | schema.org JSON-LD `ItemList` of `LocalBusiness`, one JSON doc per line (NDJSON) | JSON array of place objects |
| Provides | name, city, **state**, website (+ street address) | name, **phone**, **email**, city, website, socials |
| Missing | **phone, email** (not contactable) | **state**, street address |

Both are flattened to the unified schema the database expects:

```
name, contact, phone, city, state, website   (+ source, source_file)
```

`contact` holds the primary **email** (what a cold-email campaign needs); it is
blank for Thomasnet rows. `source`/`source_file` are provenance columns so a bad
source can be traced or purged in the DB.

## Run

```bash
cd scripts/leadfinder

# auto-mode: processes ALL .json files in this directory → all_leads.csv
python parse_leads.py

# one file — format inferred from the extension (and content)
python parse_leads.py shopListHouston.json                    # -> all_leads.csv
python parse_leads.py thomasnet_list_sheet_metal.txt -o dallas.csv

# explicit batch — mix formats, custom output
python parse_leads.py *.json *.txt -o combined.csv

# force a parser (content auto-detect is the default)
python parse_leads.py mislabeled.dat --format txt

# keep every row (skip the merge-dedupe)
python parse_leads.py shopListHouston.json --no-dedupe
```

- **`--format auto`** (default) decides per file by **content first** (so a
  Thomasnet dump saved as `.json` still parses correctly), then by extension.
- **Dedupe is on by default**: merge-fill keyed on `name+city+state` — fills blank
  fields from a duplicate, never overwrites. Collapsed the 4 cross-region
  Thomasnet duplicates in the sample. Use `--no-dedupe` to keep all rows.
- Phones are normalized to `+1 (xxx) xxx-xxxx`; anything non-US passes through untouched.
- Every run prints a **field-completeness report** (below) — use it to judge a
  fresh scrape before loading it.

## Analysis of the two sample lists

Field completeness from the two attached samples
(`thomasnet_list_sheet_metal.txt`, `shopListHouston.json`):

| field | Thomasnet `.txt` (n=84) | Google Maps `.json` (n=50) |
|---|---|---|
| name | 100% | 100% |
| **contact (email)** | **0%** | **50%** |
| **phone** | **0%** | **98%** |
| city | 100% | 96% |
| **state** | **100%** | **0%** |
| website | 72% | 74% |

**Takeaways for cold outreach**

1. **For cold *email*, Google Maps is the only usable source** — it is the sole
   format that carries email at all, and only ~50% of rows have one. Thomasnet
   yields **zero** emails and **zero** phones: it's a firmographic list
   (name/city/state/website), not a contactable one.
2. **Thomasnet's geo filter leaks.** A "Northern Texas" search returned Palo Alto
   CA, Berkeley IL, Anaheim CA, etc. The `state` column (100% on Thomasnet) is the
   fix — filter `WHERE state = 'TX'` before loading a territory.
3. **Google Maps has no state** (all rows here are implied Houston) and its
   "website" is sometimes just a Facebook page — lower value for domain-based
   email enrichment.
4. **Neither format has a contact *person*** — `contact` is an email at best.

**Recommendation:** ingest **both, merged** (the script unions them) — Thomasnet
for coverage + state + clean company domains, Google Maps for phone + the emails
it has. But set expectations: combined email coverage is ~18% (50% on the Google
Maps rows), so cold-email-alone reaches at most half the list. Either enrich the
missing emails from each shop's website domain, or route the no-email rows to
**phone** (98% on Google Maps) as a parallel channel.

## Output columns

| name | contact | phone | city | state | website | source | source_file |
|---|---|---|---|---|---|---|---|
| company name | primary email (blank for Thomasnet) | `+1 (xxx) xxx-xxxx` | city | 2-letter state (blank for Google Maps) | company URL | `thomasnet` \| `gmaps` | originating filename |

---

# Email DNS verifier — `verify_email_dns.py`

**Offline, stdlib-only** (no install, no API key). Checks that QuoteFoundry's
email DNS is correctly configured for sending (Resend) and receiving (Cloudflare
Email Routing) before the outreach campaign. Resolves records over
DNS-over-HTTPS, so it needs no `dig`/`nslookup`.

```bash
cd scripts/leadfinder
python verify_email_dns.py
```

It verifies the `send.` subdomain MX/SPF/DKIM (Resend), the root DMARC record,
and the Cloudflare Email-Routing MX/SPF for `contact@quotefoundry.app`, then
prints `READY` (exit 0) or `NOT READY` (exit 1) with each missing record named.
Run it after adding records, and re-run until green — DNS propagation takes
minutes to a few hours.

Full setup steps (which records to add where): **[docs/consulting/11-email-dns-setup.md](../../docs/consulting/11-email-dns-setup.md)**.

---

# Outreach campaign — `score_leads.py` + `send_outreach.py`

The cold-outreach pipeline for doc 08. Both are **offline, stdlib-only** and
reuse `clean()`/`_SUFFIXES` from `parse_leads.py`. The flow:

```
all_leads.csv ──score_leads──▶ outreach_targets.csv ──send_outreach──▶ Resend
   (parse_leads)                (+ tier, hint, order)   (+ outreach_log.csv state)
```

## 1. Score & tier — `score_leads.py`

```bash
python score_leads.py            # all_leads.csv -> outreach_targets.csv
```

Drops non-ICP rows (no email, placeholder/junk email, out-of-ICP trades) and
tiers the rest for send priority:

- **Tier A** — business-domain email matching the website domain **and** an ICP
  trade keyword in the name (fabricat / sheet metal / weld / laser / machin /
  metal works / precision). Most established; email first.
- **Tier B** — freemail with a website, or a business email that doesn't clear A.
- **Tier C** — freemail with no website (smallest shops).

Adds `tier`, `first_line_hint` (trade word for the email's first line), and
`batch_order` (global send order, Tier A first). Prints a tier × town report —
**eyeball Tier A and skim Tier B before sending** (the drop list is deliberately
conservative, so a stray non-fab shop can land in B).

## 2. Send — `send_outreach.py`

**`--dry-run` is the default — nothing sends without `--send`.**

```bash
python send_outreach.py --step 1                      # render 10 (dry-run)
python send_outreach.py --step 1 --send               # send 10 (Tier A first)
python send_outreach.py --step 2 --send               # day-4 follow-ups
python send_outreach.py --step 1 --send --to-override you@x.com --limit 1   # self-test
python send_outreach.py --mark-replied shop@acme.com  # log reply -> suppress
python send_outreach.py --unsubscribe  shop@acme.com  # opt-out  -> suppress
```

- **Three feedback-framed plain-text emails** (`--step 1|2|3` = day 0 / 4 / 9).
  Follow-ups only fire once the prior step is old enough and skip anyone who
  replied / unsubscribed / bounced. Copy follows the CLAUDE.md positioning lock
  ("quote faster… stop losing margin", never "AI quotes").
- **10 per run** (`--limit` to lower), Tier A first, ~2s between live sends.
- **State** lives in `outreach_log.csv` (send timestamps + suppression). Both
  CSVs are git-ignored (`*.csv`) — they hold lead PII.

**Before `--send` you must set** (guards refuse to send otherwise):

| Env var | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend auth |
| `OUTREACH_ADDRESS` | physical mailing address for the CAN-SPAM footer |
| `OUTREACH_FROM` *(optional)* | default `QuoteFoundry <outreach@send.quotefoundry.app>` |
| `OUTREACH_REPLY_TO` *(optional)* | default `contact@quotefoundry.app` |

Sender rationale (free-tier, one verified domain) is in
[docs/consulting/11-email-dns-setup.md](../../docs/consulting/11-email-dns-setup.md).
Recommended first live action: a `--to-override` self-test to your own inbox to
confirm From, Reply-To, and reply-forwarding before emailing any real lead.
