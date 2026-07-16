#!/usr/bin/env python3
"""
send_outreach.py — the QuoteFoundry cold-outreach sender (doc 08).

Reads outreach_targets.csv (from score_leads.py) and a state file
outreach_log.csv, renders one of three plain-text, feedback-framed emails, and
sends them through the Resend REST API — Tier A first, 10 per run, with full
suppression and follow-up timing.

SAFETY: --dry-run is the DEFAULT. Nothing sends unless you pass --send. Dry-run
prints every fully rendered email so the founder can approve copy first.

Sending identity (decided 2026-07-15, see docs/consulting/11-email-dns-setup.md):
    From     : QuoteFoundry <outreach@send.quotefoundry.app>   (Resend-verified)
    Reply-To : contact@quotefoundry.app                        (Cloudflare -> Gmail)
Only send.quotefoundry.app is verified on the Resend free tier, so outreach sends
from that subdomain; replies route to contact@ via Cloudflare Email Routing.

Compliance (CAN-SPAM): truthful sender, working opt-out honored via suppression,
a physical mailing address in every footer. You MUST set a real address (env
OUTREACH_ADDRESS) before --send will run.

USAGE
    python send_outreach.py --step 1                       # dry-run, 10 rendered
    python send_outreach.py --step 1 --send                # actually send 10
    python send_outreach.py --step 2 --send --limit 10     # day-4 follow-ups
    python send_outreach.py --send --to-override you@x.com --limit 1 --step 1  # self-test
    python send_outreach.py --mark-replied shop@acme.com   # log a reply (suppress)
    python send_outreach.py --unsubscribe shop@acme.com    # opt-out (suppress)

Environment:
    RESEND_API_KEY     required for --send
    OUTREACH_ADDRESS   physical mailing address for the footer (required for --send)
    OUTREACH_FROM      override the From (default the address above)
    OUTREACH_REPLY_TO  override the Reply-To (default contact@quotefoundry.app)

Python 3.7+, standard library only. Reuses clean()/_SUFFIXES from parse_leads.py.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from parse_leads import clean, _SUFFIXES

SCRIPT_DIR = Path(__file__).parent
TARGETS = SCRIPT_DIR / "outreach_targets.csv"
LOG = SCRIPT_DIR / "outreach_log.csv"
LOG_FIELDS = ["timestamp", "email", "step", "message_id", "event"]

FROM = os.environ.get("OUTREACH_FROM", "QuoteFoundry <outreach@send.quotefoundry.app>")
REPLY_TO = os.environ.get("OUTREACH_REPLY_TO", "contact@quotefoundry.app")
PHYSICAL_ADDRESS = os.environ.get(
    "OUTREACH_ADDRESS", "«QuoteFoundry mailing address — set OUTREACH_ADDRESS before sending»"
)

RUN_CAP = 10                       # hard per-run send cap (doc 08)
SEND_GAP_SEC = 2                   # pause between live sends
TIER_RANK = {"A": 0, "B": 1, "C": 2}
# Follow-up timing: step 2 fires 4 days after step 1; step 3 fires 5 days after
# step 2 (day 9 overall). Keyed by the step being sent.
WAIT_DAYS = {2: 4, 3: 5}

# --- email copy (plain text; feedback-framed; NEVER "AI quotes") -------------
# Placeholders: {shop} (cleaned name), {city}, {hint} (trade first-line hint).
FOOTER = (
    "\n\n--\n"
    "QuoteFoundry · quotefoundry.app\n"
    f"{PHYSICAL_ADDRESS}\n"
    'Not interested? Just reply "no thanks" and you won\'t hear from me again.'
)

TEMPLATES = {
    1: {
        "subject": "quick question about quoting at {shop}",
        "body": (
            "Hi {shop} team,\n\n"
            "Quick question, not a pitch. Most fab shops take 5–6 days to turn a "
            "quote around, and the ones that answer in a day or two win a lot more "
            "of them (roughly 1 in 3, vs 1 in 7 for the slow responders).\n\n"
            "I built a small quoting tool for {hint} shops your size. It uses your "
            "own stored rates and the same rate-times-hours math you'd do by hand — "
            "just faster, and on a branded PDF. No “AI guessing your prices.”\n\n"
            "Would you take a two-minute look and tell me where it's wrong for a shop "
            "in {city}? Honest feedback is worth more to me than a sale, and founding "
            "shops that help get free access with their price locked in."
        ),
    },
    2: {
        "subject": "re: quoting at {shop}",
        "body": (
            "Hi {shop} team,\n\n"
            "Following up once. The other half of the quoting problem is margin: "
            "pricing custom jobs by feel tends to underbid them 8–15%, which quietly "
            "eats a real chunk of a year's profit.\n\n"
            "QuoteFoundry prices from your stored rates, so the number comes out "
            "consistent every time. Two-minute look, and tell me if it'd actually "
            "help a {hint} shop like yours?"
        ),
    },
    3: {
        "subject": "closing the feedback group",
        "body": (
            "Hi {shop} team,\n\n"
            "Last note from me — I'm closing the founding feedback group this week.\n\n"
            "If a faster, more consistent way to quote {hint} work sounds useful, "
            "just reply and I'll send a link. Flat per-shop pricing, no per-user "
            "fees, and founding shops keep that price for good.\n\n"
            "Either way, thanks for the time."
        ),
    },
}
SIGNOFF = "\n\n— the QuoteFoundry team\nquotefoundry.app"


def shop_display(name: str) -> str:
    """Clean shop name for the greeting: strip Inc/LLC/Company suffixes (repeatedly)."""
    n = clean(name)
    prev = None
    while prev != n:
        prev = n
        n = _SUFFIXES.sub("", n).strip().strip(",").strip()
    return n or clean(name)


def render(step: int, row: dict) -> tuple[str, str]:
    t = TEMPLATES[step]
    ctx = {
        "shop": shop_display(row["name"]),
        "city": clean(row.get("city")) or "your area",
        "hint": clean(row.get("first_line_hint")) or "custom fab",
    }
    subject = t["subject"].format(**ctx)
    body = t["body"].format(**ctx) + SIGNOFF + FOOTER
    return subject, body


# --- state (log) -------------------------------------------------------------
def load_log() -> list[dict]:
    if not LOG.is_file():
        return []
    with LOG.open(newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def append_log(email: str, step, message_id: str, event: str) -> None:
    new = not LOG.is_file()
    with LOG.open("a", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=LOG_FIELDS)
        if new:
            w.writeheader()
        w.writerow({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "email": email.lower(), "step": step,
            "message_id": message_id, "event": event,
        })


def build_state(log: list[dict]):
    """Return (suppressed:set, sent_steps:{email:{step:datetime}})."""
    suppressed: set[str] = set()
    sent: dict[str, dict[int, datetime]] = {}
    for r in log:
        email = clean(r.get("email")).lower()
        event = clean(r.get("event"))
        if event in ("replied", "unsubscribed", "bounced"):
            suppressed.add(email)
        elif event == "sent":
            try:
                ts = datetime.fromisoformat(r["timestamp"])
            except (ValueError, KeyError):
                continue
            try:
                step = int(r.get("step") or 0)
            except ValueError:
                continue
            sent.setdefault(email, {})[step] = ts
    return suppressed, sent


def eligible(row: dict, step: int, suppressed: set, sent: dict, now: datetime) -> bool:
    email = row["contact"].lower()
    if email in suppressed:
        return False
    steps = sent.get(email, {})
    if step in steps:
        return False                       # already sent this step
    if step == 1:
        return True
    prev = steps.get(step - 1)
    if not prev:
        return False                       # can't follow up on an unsent prior step
    return (now - prev) >= timedelta(days=WAIT_DAYS[step])


# --- Resend send -------------------------------------------------------------
def resend_send(to: str, subject: str, text: str, api_key: str) -> str:
    payload = json.dumps({
        "from": FROM, "to": [to], "reply_to": REPLY_TO,
        "subject": subject, "text": text,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails", data=payload, method="POST",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("id", "")


# --- management sub-commands -------------------------------------------------
def do_mark(email: str, event: str) -> int:
    append_log(email, "", "", event)
    print(f"logged {event}: {email.lower()}  (suppressed from future sends)")
    return 0


def main(argv=None) -> int:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")   # keep dashes/quotes readable on Windows
    ap = argparse.ArgumentParser(description="Send QuoteFoundry outreach (doc 08).")
    ap.add_argument("--step", type=int, choices=[1, 2, 3], help="which email to send")
    ap.add_argument("--send", action="store_true", help="actually send (default is dry-run)")
    ap.add_argument("--limit", type=int, default=RUN_CAP, help=f"max sends this run (default {RUN_CAP})")
    ap.add_argument("--to-override", metavar="EMAIL", help="send to this address instead (test; not logged)")
    ap.add_argument("--mark-replied", metavar="EMAIL", help="record a reply and suppress")
    ap.add_argument("--unsubscribe", metavar="EMAIL", help="record an opt-out and suppress")
    ap.add_argument("--mark-bounced", metavar="EMAIL", help="record a bounce and suppress")
    args = ap.parse_args(argv)

    if args.mark_replied:
        return do_mark(args.mark_replied, "replied")
    if args.unsubscribe:
        return do_mark(args.unsubscribe, "unsubscribed")
    if args.mark_bounced:
        return do_mark(args.mark_bounced, "bounced")
    if not args.step:
        ap.error("choose --step 1|2|3 (or a --mark-*/--unsubscribe management flag)")

    if not TARGETS.is_file():
        print(f"! {TARGETS.name} not found — run score_leads.py first.", file=sys.stderr)
        return 1
    with TARGETS.open(newline="", encoding="utf-8") as fh:
        targets = [r for r in csv.DictReader(fh) if clean(r.get("contact"))]

    suppressed, sent = build_state(load_log())
    now = datetime.now(timezone.utc)
    picks = [r for r in targets if eligible(r, args.step, suppressed, sent, now)]
    picks.sort(key=lambda x: (TIER_RANK.get(x.get("tier", "C"), 3), int(x.get("batch_order") or 0)))
    picks = picks[: max(0, args.limit)]

    mode = "SEND" if args.send else "DRY-RUN"
    print(f"[{mode}] step {args.step}: {len(picks)} recipient(s) selected "
          f"(suppressed={len(suppressed)}, cap={args.limit})")
    if not picks:
        print("  nothing eligible — done.")
        return 0

    # Pre-flight guards for live sending.
    api_key = os.environ.get("RESEND_API_KEY", "")
    if args.send:
        if not api_key:
            print("! RESEND_API_KEY not set — cannot --send.", file=sys.stderr)
            return 1
        if "«" in FOOTER:
            print("! Physical address placeholder still in the footer. Set "
                  "OUTREACH_ADDRESS to a real mailing address before --send (CAN-SPAM).",
                  file=sys.stderr)
            return 1
    if args.to_override:
        print(f"  NOTE: --to-override active -> all sends go to {args.to_override}, NOT logged.")

    sent_count = 0
    for i, row in enumerate(picks):
        subject, text = render(args.step, row)
        to = args.to_override or row["contact"]
        print("\n" + "=" * 64)
        print(f"To:       {to}   [{row.get('tier')}#{row.get('batch_order')} {row['name']}]")
        print(f"From:     {FROM}")
        print(f"Reply-To: {REPLY_TO}")
        print(f"Subject:  {subject}")
        print("-" * 64)
        print(text)
        if not args.send:
            continue
        try:
            mid = resend_send(to, subject, text, api_key)
        except Exception as e:  # noqa: BLE001 - surface and stop cleanly
            print(f"  ! send failed: {e}", file=sys.stderr)
            break
        if not args.to_override:
            append_log(row["contact"], args.step, mid, "sent")
        sent_count += 1
        print(f"  sent (id={mid})")
        if i < len(picks) - 1:
            time.sleep(SEND_GAP_SEC)

    print("\n" + "=" * 64)
    if args.send:
        print(f"done: {sent_count} sent" + ("  (test override — not logged)" if args.to_override else ""))
    else:
        print(f"dry-run: {len(picks)} rendered, 0 sent. Re-run with --send to send.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
