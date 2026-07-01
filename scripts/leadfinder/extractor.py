"""extractor.py — turn a company's crawled pages into a single lead record."""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from urllib.parse import urlparse

from bs4 import BeautifulSoup

import config
from utils import registered_domain

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
# North-American phone numbers, tolerant of separators and an optional +1.
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}")


@dataclass
class Lead:
    company_name: str
    website: str
    contact_email: str
    phone_number: str
    contact_page_url: str
    rfq_page_url: str


def _clean_title(title: str) -> str:
    # "Acme Sheet Metal | Custom Fabrication" → "Acme Sheet Metal"
    for sep in ("|", "–", "-", "—", "::", "»"):
        if sep in title:
            title = title.split(sep)[0]
    return title.strip()


def _company_name(home_html: str, domain: str) -> str:
    soup = BeautifulSoup(home_html, "lxml")
    og = soup.find("meta", attrs={"property": "og:site_name"})
    if og and og.get("content"):
        return og["content"].strip()
    if soup.title and soup.title.string:
        name = _clean_title(soup.title.string)
        if name:
            return name
    return domain.split(".")[0].replace("-", " ").title()


def _emails(html: str, domain: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    found: list[str] = []
    for a in soup.select('a[href^="mailto:"]'):
        addr = a["href"][len("mailto:"):].split("?")[0].strip()
        if addr:
            found.append(addr)
    found += EMAIL_RE.findall(soup.get_text(" "))
    out: list[str] = []
    for e in found:
        el = e.lower().strip(".,;:")
        if any(b in el for b in config.EMAIL_BLOCKLIST_SUBSTRINGS):
            continue
        if el not in out:
            out.append(el)
    # prefer an address on the company's own domain
    out.sort(key=lambda e: (domain not in e, "info@" not in e and "sales@" not in e))
    return out


def _phones(html: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ")
    out: list[str] = []
    for m in PHONE_RE.findall(text):
        digits = re.sub(r"\D", "", m)
        if len(digits) in (10, 11):
            if m.strip() not in out:
                out.append(m.strip())
    return out


def _classify(url: str) -> str | None:
    hay = url.lower()
    if any(h.replace(" ", "-") in hay or h.replace(" ", "") in hay for h in config.RFQ_HINTS):
        return "rfq"
    if any(h in hay for h in config.CONTACT_HINTS):
        return "contact"
    return None


def extract(root: str, pages: dict[str, str]) -> Lead | None:
    """Build a Lead from the crawled {url: html}. Returns None if nothing useful."""
    if not pages:
        return None
    domain = registered_domain(root)
    home_url = next((u for u in pages if urlparse(u).path in ("", "/")), next(iter(pages)))
    home_html = pages[home_url]

    emails: list[str] = []
    phones: list[str] = []
    contact_url = ""
    rfq_url = ""
    for url, html in pages.items():
        emails += [e for e in _emails(html, domain) if e not in emails]
        phones += [p for p in _phones(html) if p not in phones]
        kind = _classify(url)
        if kind == "rfq" and not rfq_url:
            rfq_url = url
        elif kind == "contact" and not contact_url:
            contact_url = url

    if not (emails or phones):
        return None  # no contact info → not a usable lead

    return Lead(
        company_name=_company_name(home_html, domain),
        website=root,
        contact_email=emails[0] if emails else "",
        phone_number=phones[0] if phones else "",
        contact_page_url=contact_url,
        rfq_page_url=rfq_url,
    )


def lead_to_row(lead: Lead) -> dict:
    return asdict(lead)
