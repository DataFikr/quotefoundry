"""export.py — dedupe leads by domain and write companies.csv."""
from __future__ import annotations

import logging

import pandas as pd

import config
from utils import registered_domain

log = logging.getLogger("leadfinder")

COLUMNS = [
    "Company Name", "Website", "Contact Email",
    "Phone Number", "Contact Page URL", "RFQ Page URL",
]


def export_leads(rows: list[dict], path: str = config.OUTPUT_CSV) -> pd.DataFrame:
    """rows are asdict(Lead) dicts. Dedupe by registered domain, write CSV."""
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["company_name", "website", "contact_email",
                                   "phone_number", "contact_page_url", "rfq_page_url"])

    if not df.empty:
        df["_domain"] = df["website"].map(registered_domain)
        df = df.drop_duplicates(subset="_domain", keep="first").drop(columns="_domain")

    df = df.rename(columns={
        "company_name": "Company Name",
        "website": "Website",
        "contact_email": "Contact Email",
        "phone_number": "Phone Number",
        "contact_page_url": "Contact Page URL",
        "rfq_page_url": "RFQ Page URL",
    })[COLUMNS]

    df.to_csv(path, index=False)
    log.info("Wrote %d companies → %s", len(df), path)
    return df
