"""Configuration + defaults for LeadFinder.

Tunable knobs live here so the modules stay logic-only. Values can be overridden
from the CLI (see main.py) or environment (.env).
"""
from __future__ import annotations

# Identify ourselves honestly to sites we crawl.
USER_AGENT = "LeadFinderBot/1.0 (+https://quoteforge.app; B2B research)"

# Brave Web Search API endpoint.
BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"

# Default search queries — North American sheet-metal / custom fabrication shops.
# Kept broad but on-target; edit freely or pass --queries on the CLI.
DEFAULT_QUERIES = [
    "sheet metal fabrication company",
    "custom sheet metal fabrication shop",
    "precision sheet metal manufacturer USA",
    "metal fabrication shop request a quote",
    "custom metal fabrication contract manufacturer",
    "sheet metal fabricator Canada",
    "structural steel fabrication shop",
    "laser cutting and metal fabrication services",
]

# Only these paths are crawled per site (plus any contact/RFQ links discovered
# on the homepage). Keep the footprint tiny and predictable.
CRAWL_PATHS = ["/", "/contact", "/contact-us", "/about", "/about-us", "/request-quote", "/quote", "/rfq"]

# Link text / href hints used to classify discovered links.
CONTACT_HINTS = ["contact", "reach us", "get in touch"]
RFQ_HINTS = ["request a quote", "request quote", "rfq", "get a quote", "quote request", "request-a-quote"]

# Politeness / robustness.
REQUEST_TIMEOUT = 20.0        # seconds per HTTP request
MAX_RETRIES = 3               # per request
RETRY_BACKOFF = 1.5           # seconds, exponential base
CRAWL_DELAY = 1.0             # seconds between requests to the same host
RESULTS_PER_QUERY = 20        # Brave results to pull per query (max 20/page)
MAX_COMPANIES = 100           # cap the run (dedup'd domains)

# Domains that are never leads (aggregators, directories, socials, marketplaces).
BLOCKLIST_DOMAINS = {
    "wikipedia.org", "linkedin.com", "facebook.com", "instagram.com", "twitter.com",
    "x.com", "youtube.com", "yelp.com", "indeed.com", "glassdoor.com", "bbb.org",
    "thomasnet.com", "mfg.com", "yellowpages.com", "manta.com", "crunchbase.com",
    "amazon.com", "ebay.com", "alibaba.com", "made-in-china.com", "reddit.com",
    "maps.google.com", "google.com", "bing.com", "pinterest.com", "tiktok.com",
}

OUTPUT_CSV = "companies.csv"

# Emails matching these are dropped (image/asset false positives, no-reply noise).
EMAIL_BLOCKLIST_SUBSTRINGS = ["example.com", "sentry.io", "wixpress.com", ".png", ".jpg", ".gif", ".webp"]
