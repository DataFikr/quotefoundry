"""Small shared helpers: URL/domain normalization and a retry wrapper."""
from __future__ import annotations

import time
import logging
from typing import Callable, TypeVar
from urllib.parse import urlparse, urlunparse

log = logging.getLogger("leadfinder")

T = TypeVar("T")


def registered_domain(url: str) -> str:
    """A dedupe key: host without a leading 'www.'. Good enough to collapse
    pages of the same company (not a full public-suffix parse)."""
    host = urlparse(url if "://" in url else f"http://{url}").netloc.lower()
    host = host.split(":")[0]
    return host[4:] if host.startswith("www.") else host


def root_url(url: str) -> str:
    """Scheme + host origin (drops path/query/fragment)."""
    p = urlparse(url if "://" in url else f"https://{url}")
    scheme = p.scheme or "https"
    return urlunparse((scheme, p.netloc, "", "", "", ""))


def same_host(a: str, b: str) -> bool:
    return registered_domain(a) == registered_domain(b)


def retry(fn: Callable[[], T], *, tries: int, backoff: float, what: str) -> T | None:
    """Call fn() with exponential backoff. Returns None if all attempts fail."""
    last: Exception | None = None
    for attempt in range(1, tries + 1):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — we log and retry any transient failure
            last = e
            wait = backoff ** attempt
            log.warning("  %s failed (attempt %d/%d): %s — retrying in %.1fs", what, attempt, tries, e, wait)
            time.sleep(wait)
    log.error("  %s gave up after %d attempts: %s", what, tries, last)
    return None
