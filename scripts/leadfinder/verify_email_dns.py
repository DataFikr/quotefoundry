#!/usr/bin/env python3
"""verify_email_dns.py — check QuoteFoundry's email DNS is correctly configured.

Run this AFTER adding records in Cloudflare + Resend (see
docs/consulting/11-email-dns-setup.md). Re-run until everything is green;
DNS propagation can take minutes to a few hours.

It resolves records over DNS-over-HTTPS (Google, Cloudflare fallback) so it
needs no `dig`/`nslookup` and no third-party packages — stdlib only, matching
the other leadfinder scripts.

What it verifies:
  SENDING (Resend, transactional quote email from quotes@send.quotefoundry.app)
    - send.quotefoundry.app  MX   -> Amazon SES feedback-smtp (Resend's backend)
    - send.quotefoundry.app  TXT  -> SPF including amazonses.com
    - resend._domainkey.*    TXT  -> DKIM public key (p=...)
  SENDING (Resend, outreach from contact@quotefoundry.app — doc 08)
    - root domain verified: covered by the DKIM/SPF checks above
  AUTH POLICY
    - _dmarc.quotefoundry.app TXT -> v=DMARC1 (p=none to start)
  RECEIVING (Cloudflare Email Routing, contact@ -> datafikr@gmail.com)
    - quotefoundry.app  MX  -> route{1,2,3}.mx.cloudflare.net
    - quotefoundry.app  TXT -> SPF including _spf.mx.cloudflare.net
  HYGIENE
    - at most ONE v=spf1 record per name (two = silently broken SPF)

Exit code 0 only when every REQUIRED check passes, so it doubles as a gate.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request

ROOT = "quotefoundry.app"
SEND = "send.quotefoundry.app"
# Resend's return-path / bounce subdomain for the SEND domain. SPF is validated
# against the envelope MAIL FROM (the return-path), so Resend nests MX+SPF one
# level deeper: send.send.quotefoundry.app. DKIM stays at resend._domainkey.SEND.
SEND_RETURN_PATH = f"send.{SEND}"

DOH_ENDPOINTS = [
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
]

# ANSI colours (skipped if not a TTY)
_TTY = sys.stdout.isatty()
def _c(code: str, s: str) -> str:
    return f"\033[{code}m{s}\033[0m" if _TTY else s
GREEN = lambda s: _c("32", s)
RED = lambda s: _c("31", s)
YEL = lambda s: _c("33", s)
DIM = lambda s: _c("2", s)


def resolve(name: str, rtype: str) -> list[str]:
    """Return the record data strings for name/type via DoH. [] on none/error.

    Tries each resolver in turn and returns the FIRST NON-EMPTY answer. During
    propagation a record can be live on the zone's own resolver (Cloudflare)
    minutes before a public cache (Google) reflects it, so an empty result from
    one resolver must fall through to the next rather than be trusted as 'none'.
    """
    last_err = None
    for base in DOH_ENDPOINTS:
        q = urllib.parse.urlencode({"name": name, "type": rtype})
        req = urllib.request.Request(
            f"{base}?{q}", headers={"accept": "application/dns-json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.load(r)
        except Exception as e:  # noqa: BLE001 - try next endpoint
            last_err = e
            continue
        out = []
        for ans in data.get("Answer", []):
            val = ans.get("data", "")
            # TXT values arrive wrapped in quotes, possibly chunked: "a" "b"
            if rtype == "TXT":
                val = "".join(
                    part[1:-1] if part.startswith('"') and part.endswith('"') else part
                    for part in val.split(" ")
                ) if '"' in val else val.strip('"')
            out.append(val.strip())
        if out:
            return out  # got records from this resolver; done
        # empty answer -> maybe not propagated here yet; try the next resolver
    if last_err is not None:
        print(RED(f"  ! DNS query failed for {name} {rtype}: {last_err}"), file=sys.stderr)
    return []


class Report:
    def __init__(self) -> None:
        self.required_fail = 0
        self.optional_fail = 0

    def check(self, label: str, ok: bool, found: str, *, required: bool = True) -> None:
        if ok:
            mark = GREEN("PASS")
        elif required:
            mark = RED("MISSING")
            self.required_fail += 1
        else:
            mark = YEL("PENDING")
            self.optional_fail += 1
        print(f"  [{mark}] {label}")
        if found:
            print(DIM(f"          found: {found}"))
        elif not ok:
            print(DIM("          found: (nothing)"))


def any_contains(records: list[str], needle: str) -> str | None:
    for r in records:
        if needle.lower() in r.lower():
            return r
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify QuoteFoundry email DNS.")
    ap.add_argument("--rua", default="datafikr@gmail.com",
                    help="expected DMARC report address (informational only)")
    args = ap.parse_args()

    rep = Report()
    print(f"\nQuoteFoundry email DNS check  -  {ROOT}\n" + "=" * 52)

    # --- SENDING: Resend transactional (send. subdomain) ---------------------
    print("\nSENDING - Resend (quote email from quotes@%s)" % SEND)
    mx = resolve(SEND_RETURN_PATH, "MX")
    rep.check(f"{SEND_RETURN_PATH} MX -> Amazon SES (feedback-smtp)",
              bool(any_contains(mx, "amazonses.com")),
              any_contains(mx, "amazonses.com") or "; ".join(mx))

    send_txt = resolve(SEND_RETURN_PATH, "TXT")
    spf_send = [t for t in send_txt if t.lower().startswith("v=spf1")]
    rep.check(f"{SEND_RETURN_PATH} SPF includes amazonses.com",
              bool(any_contains(spf_send, "amazonses.com")),
              "; ".join(spf_send))
    if len(spf_send) > 1:
        print(RED(f"          ! {len(spf_send)} v=spf1 records on {SEND_RETURN_PATH} - must be exactly ONE"))
        rep.required_fail += 1

    # DKIM can live at either name depending on which domain was verified.
    dkim_names = [f"resend._domainkey.{SEND}", f"resend._domainkey.{ROOT}"]
    dkim_found = ""
    for n in dkim_names:
        recs = resolve(n, "TXT")
        hit = any_contains(recs, "p=") or any_contains(recs, "DKIM")
        if hit:
            dkim_found = f"{n} -> {hit[:60]}..."
            break
    rep.check("resend._domainkey DKIM key present", bool(dkim_found), dkim_found)

    # --- AUTH POLICY: DMARC --------------------------------------------------
    print("\nAUTH POLICY - DMARC")
    dmarc = resolve(f"_dmarc.{ROOT}", "TXT")
    dmarc_rec = any_contains(dmarc, "v=DMARC1")
    rep.check("_dmarc TXT has v=DMARC1 (p=none to start)",
              bool(dmarc_rec), dmarc_rec or "; ".join(dmarc))
    if dmarc_rec and args.rua.lower() not in dmarc_rec.lower():
        print(YEL(f"          note: rua does not mention {args.rua} (aggregate reports won't reach you)"))

    # --- RECEIVING: Cloudflare Email Routing (contact@) ----------------------
    print("\nRECEIVING - Cloudflare Email Routing (contact@%s -> Gmail)" % ROOT)
    root_mx = resolve(ROOT, "MX")
    rep.check("root MX -> *.mx.cloudflare.net",
              bool(any_contains(root_mx, "mx.cloudflare.net")),
              "; ".join(root_mx))

    root_txt = resolve(ROOT, "TXT")
    spf_root = [t for t in root_txt if t.lower().startswith("v=spf1")]
    rep.check("root SPF includes _spf.mx.cloudflare.net",
              bool(any_contains(spf_root, "_spf.mx.cloudflare.net")),
              "; ".join(spf_root))
    if len(spf_root) > 1:
        print(RED(f"          ! {len(spf_root)} v=spf1 records on {ROOT} - must be exactly ONE (merge includes)"))
        rep.required_fail += 1

    # --- app reachability (not email, but a useful sanity line) --------------
    print("\nAPP - domain resolves")
    a = resolve(ROOT, "A")
    rep.check(f"{ROOT} A record resolves", bool(a), "; ".join(a), required=False)

    # --- summary -------------------------------------------------------------
    print("\n" + "=" * 52)
    if rep.required_fail == 0:
        print(GREEN("READY - all required email DNS records are live."))
        print(DIM("Next: send one live test (see runbook Step 6) and confirm inbox + reply forwarding."))
        return 0
    print(RED(f"NOT READY - {rep.required_fail} required record(s) missing."))
    print(DIM("Add/fix the records in Cloudflare + Resend, wait for propagation, re-run."))
    print(DIM("Guide: docs/consulting/11-email-dns-setup.md"))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
