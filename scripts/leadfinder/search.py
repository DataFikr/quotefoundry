"""search.py — discover candidate company websites via the Brave Search API."""
from __future__ import annotations

import logging
from typing import Iterable

import httpx

import config
from utils import registered_domain, root_url, retry

log = logging.getLogger("leadfinder")


class BraveSearch:
    def __init__(self, api_key: str, *, results_per_query: int = config.RESULTS_PER_QUERY):
        if not api_key:
            raise ValueError("BRAVE_API_KEY is required (put it in .env)")
        self.api_key = api_key
        self.results_per_query = min(results_per_query, 20)  # Brave caps at 20/page
        self._client = httpx.Client(
            timeout=config.REQUEST_TIMEOUT,
            headers={
                "Accept": "application/json",
                "X-Subscription-Token": api_key,
                "User-Agent": config.USER_AGENT,
            },
        )

    def _query(self, q: str) -> list[dict]:
        params = {"q": q, "count": self.results_per_query, "country": "us", "result_filter": "web"}
        resp = retry(
            lambda: self._client.get(config.BRAVE_ENDPOINT, params=params),
            tries=config.MAX_RETRIES, backoff=config.RETRY_BACKOFF, what=f"search '{q}'",
        )
        if resp is None:
            return []
        if resp.status_code != 200:
            log.error("  Brave API %s for '%s': %s", resp.status_code, q, resp.text[:200])
            return []
        return (resp.json().get("web") or {}).get("results", []) or []

    def discover_domains(self, queries: Iterable[str]) -> list[str]:
        """Run every query, collect result URLs, and return unique root URLs
        (one per registered domain), skipping blocklisted aggregators/socials."""
        seen: set[str] = set()
        roots: list[str] = []
        for q in queries:
            results = self._query(q)
            log.info("Query '%s' → %d results", q, len(results))
            for r in results:
                url = r.get("url")
                if not url:
                    continue
                dom = registered_domain(url)
                if not dom or dom in seen:
                    continue
                if any(dom == b or dom.endswith("." + b) for b in config.BLOCKLIST_DOMAINS):
                    continue
                seen.add(dom)
                roots.append(root_url(url))
        log.info("Discovered %d unique candidate domains", len(roots))
        return roots

    def close(self) -> None:
        self._client.close()
