"""crawler.py — fetch a small, fixed set of pages per company site.

httpx handles the vast majority of shop sites. For JavaScript-rendered pages
(thin HTML), an optional Playwright fallback renders the DOM. robots.txt is
honored, and requests to the same host are spaced by CRAWL_DELAY.
"""
from __future__ import annotations

import time
import logging
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

import config
from utils import registered_domain, root_url, same_host, retry

log = logging.getLogger("leadfinder")


class SiteCrawler:
    def __init__(self, *, use_playwright: bool = False):
        self.use_playwright = use_playwright
        self._client = httpx.Client(
            timeout=config.REQUEST_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": config.USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        )
        self._robots: dict[str, RobotFileParser | None] = {}
        self._last_hit: dict[str, float] = {}
        self._pw = None       # playwright context (lazy)
        self._browser = None

    # -- robots.txt ----------------------------------------------------------
    def _robots_for(self, url: str) -> RobotFileParser | None:
        host = registered_domain(url)
        if host in self._robots:
            return self._robots[host]
        rp = RobotFileParser()
        robots_url = urljoin(root_url(url) + "/", "robots.txt")
        try:
            resp = self._client.get(robots_url)
            if resp.status_code == 200:
                rp.parse(resp.text.splitlines())
            else:
                rp = None  # no robots → allow (parser default would disallow on error)
        except Exception:  # noqa: BLE001
            rp = None
        self._robots[host] = rp
        return rp

    def allowed(self, url: str) -> bool:
        rp = self._robots_for(url)
        if rp is None:
            return True
        try:
            return rp.can_fetch(config.USER_AGENT, url)
        except Exception:  # noqa: BLE001
            return True

    # -- polite pacing -------------------------------------------------------
    def _throttle(self, url: str) -> None:
        host = registered_domain(url)
        last = self._last_hit.get(host, 0.0)
        wait = config.CRAWL_DELAY - (time.time() - last)
        if wait > 0:
            time.sleep(wait)
        self._last_hit[host] = time.time()

    # -- fetching ------------------------------------------------------------
    def _get(self, url: str) -> str | None:
        self._throttle(url)
        resp = retry(lambda: self._client.get(url), tries=config.MAX_RETRIES,
                     backoff=config.RETRY_BACKOFF, what=f"GET {url}")
        if resp is None or resp.status_code >= 400:
            return None
        ctype = resp.headers.get("content-type", "")
        if "html" not in ctype and ctype:
            return None
        html = resp.text
        # thin/JS page → optional Playwright render
        if self.use_playwright and len(BeautifulSoup(html, "lxml").get_text(strip=True)) < 200:
            rendered = self._render(url)
            if rendered:
                html = rendered
        return html

    def _render(self, url: str) -> str | None:
        try:
            if self._browser is None:
                from playwright.sync_api import sync_playwright  # lazy import
                self._pw = sync_playwright().start()
                self._browser = self._pw.chromium.launch(headless=True)
            page = self._browser.new_page(user_agent=config.USER_AGENT)
            page.goto(url, wait_until="domcontentloaded", timeout=int(config.REQUEST_TIMEOUT * 1000))
            html = page.content()
            page.close()
            return html
        except Exception as e:  # noqa: BLE001
            log.warning("  Playwright render failed for %s: %s", url, e)
            return None

    # -- discovery + crawl ---------------------------------------------------
    def _discover_links(self, base_url: str, html: str) -> list[str]:
        """From the homepage, find contact / RFQ links on the same host."""
        found: list[str] = []
        soup = BeautifulSoup(html, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if href.startswith(("mailto:", "tel:", "#", "javascript:")):
                continue
            text = (a.get_text() or "").lower()
            full = urljoin(base_url, href)
            if not same_host(base_url, full):
                continue
            hay = f"{text} {href.lower()}"
            if any(h in hay for h in config.CONTACT_HINTS + config.RFQ_HINTS):
                found.append(full)
        return found

    def crawl_site(self, root: str) -> dict[str, str]:
        """Return {url: html} for the homepage + a few known/discovered pages."""
        root = root_url(root)
        pages: dict[str, str] = {}

        if not self.allowed(root + "/"):
            log.info("  robots.txt disallows %s — skipping", root)
            return pages

        home = self._get(root + "/")
        if home:
            pages[root + "/"] = home

        # candidate URLs: fixed paths + links discovered on the homepage
        candidates: list[str] = [urljoin(root + "/", p.lstrip("/")) for p in config.CRAWL_PATHS]
        if home:
            candidates += self._discover_links(root + "/", home)

        seen = {urlparse(u).path.rstrip("/") for u in pages}
        for url in candidates:
            path = urlparse(url).path.rstrip("/")
            if path in seen:
                continue
            seen.add(path)
            if not self.allowed(url):
                continue
            html = self._get(url)
            if html:
                pages[url] = html
            if len(pages) >= 6:  # cap pages per site
                break
        return pages

    def close(self) -> None:
        self._client.close()
        try:
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception:  # noqa: BLE001
            pass
