# 11 — Email DNS Setup Runbook (Day 1 · founder + agent)

> **Goal:** make QuoteFoundry able to (a) **send** quote emails from
> `quotes@send.quotefoundry.app` and outreach from `contact@quotefoundry.app`,
> and (b) **receive** replies to `contact@` in datafikr@gmail.com — all with
> SPF/DKIM/DMARC so mail lands in the inbox, not spam.
>
> **DNS host:** Cloudflare (`dion/mallory.ns.cloudflare.com`). All records below
> are added in the **Cloudflare dashboard**; the Resend records are copied from
> the **Resend dashboard**.
>
> **Verifier:** `python scripts/leadfinder/verify_email_dns.py` — run it after
> each change; re-run until it prints `READY`.

---

## Current state (re-verified against dashboards 2026-07-14)

| Record | Status |
|---|---|
| Resend domain `send.quotefoundry.app` | ✅ **Verified** (sending is fully live) |
| `resend._domainkey.send.quotefoundry.app` DKIM | ✅ live |
| `send.send.quotefoundry.app` MX (SES `feedback-smtp.us-east-1`) | ✅ live |
| `send.send.quotefoundry.app` SPF (`v=spf1 include:amazonses.com ~all`) | ✅ live |
| root A → Vercel `76.76.21.21` (Cloudflare-proxied) | ✅ resolves (app deploy DNS done) |
| `_dmarc.quotefoundry.app` DMARC (`p=none`, rua → datafikr@gmail.com) | ✅ live |
| root MX → Cloudflare Email Routing (`route1/2/3.mx.cloudflare.net`) | ✅ live |
| root SPF → Cloudflare (`include:_spf.mx.cloudflare.net`) | ✅ live |
| Cloudflare Email Routing: `contact@quotefoundry.app` → datafikr@gmail.com | ✅ Enabled / Active |

**Email DNS is COMPLETE.** `python scripts/leadfinder/verify_email_dns.py` prints
`READY` (exit 0). All that remains is the **Step 6 live round-trip test** and the
outreach-domain decision below. (Note: if a public resolver like Google still
shows a record as pending, that's cache lag — the verifier now falls through to
Cloudflare's resolver, which reflects the zone authoritatively.)

> **Why the records read `send.send...`:** the Resend domain is
> `send.quotefoundry.app`, and Resend nests the bounce/return-path one level
> deeper at `send.send.quotefoundry.app` (SPF is checked against the envelope
> return-path, so it belongs there). This is correct — Resend shows *Verified*.
> The DKIM stays at `resend._domainkey.send`. Don't "fix" these to `send.` — they
> are right as-is.

---

## Step 1 — Resend SENDING records ✅ DONE (reference only)

The `send.quotefoundry.app` domain is already **Verified** in Resend. These three
records are live in Cloudflare (all **DNS only / grey cloud** — never proxy MX/TXT):

| Type | Name (in Cloudflare) | Content | Status |
|---|---|---|---|
| TXT | `resend._domainkey.send` | `p=MIGfMA0GCSqG…` (DKIM) | ✅ Verified |
| MX | `send.send` | `feedback-smtp.us-east-1.amazonses.com` (priority 10) | ✅ Verified |
| TXT | `send.send` | `v=spf1 include:amazonses.com ~all` | ✅ Verified |

Nothing to do here. (Do **not** rename the `send.send` records to `send.` — see
the note above for why the nesting is correct.)

**Outreach sender — DECIDED 2026-07-15 (amends doc 08):** Resend free tier allows
ONE verified domain, and it's spent on `send.quotefoundry.app`. So outreach sends
from that subdomain, not the root:

| Field | Value | Handled by |
|---|---|---|
| **From** | `QuoteFoundry <outreach@send.quotefoundry.app>` | Resend (verified — authenticates) |
| **Reply-To** | `contact@quotefoundry.app` | Cloudflare Email Routing → datafikr@gmail.com |

This supersedes doc 08's `From: contact@quotefoundry.app` (root) — the root is NOT
verified for sending, and verifying it would cost the one free-tier domain slot.
Reply-To is unchanged from doc 08. When `send_outreach.py` is built, its `from`
must use `@send.quotefoundry.app` (NOT `@quotefoundry.app`). Pick any local-part
on the subdomain (`outreach@`, `hello@`); keep `contact@quotefoundry.app` reserved
for inbound replies only.

> **Note:** `send@quotefoundry.app` (a mailbox on the root) is NOT sendable — only
> `<anything>@send.quotefoundry.app` (the verified subdomain) is. The `send.` in
> the verified domain is a subdomain label, not a mailbox name.

**Reputation caveat:** cold outreach and transactional quote email now share the
`send.quotefoundry.app` reputation. Fine at doc 08's 10/day warm-up — but a cold
spam spike could dent quote-email delivery, so keep volume low and watch bounces.

**Reply hygiene (do before the campaign):** replies to `contact@` are *forwarded*
mail and Gmail may spam-file them (forwarding breaks auth alignment). In Gmail,
add a filter `to:(contact@quotefoundry.app)` → **Never send it to Spam** so no
prospect reply gets buried. (This is separate from *outbound* deliverability,
which is properly authenticated via Resend.)

**One-SPF rule:** any single name may hold only ONE `v=spf1` TXT record. The
verifier flags duplicates. (Not currently an issue — the root SPF is Cloudflare's
alone, and the send-subdomain SPF is Resend's alone.)

## Step 2 — Add DMARC (Cloudflare dashboard)

One TXT record on the root. This exact value is safe to paste:

| Type | Name | Value |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:datafikr@gmail.com; adkim=r; aspf=r` |

`p=none` = monitor only (no mail is rejected while you observe). `rua=` sends
aggregate reports to the founder inbox. Tighten to `p=quarantine` later, only
after reports confirm SPF+DKIM pass for all legitimate mail.

## Step 3 — Turn on Cloudflare Email Routing for `contact@` (RECEIVING)

Cloudflare dashboard → **Email → Email Routing → Get started**:

1. Cloudflare **auto-adds** the required records (3× MX `route1/2/3.mx.cloudflare.net`
   and an SPF TXT `v=spf1 include:_spf.mx.cloudflare.net ~all`). Accept them.
2. **Routing rules** → add address: `contact@quotefoundry.app` →
   destination `datafikr@gmail.com`.
3. Cloudflare emails datafikr@gmail.com a **verify** link — click it to activate
   the destination.

> **SPF merge caution:** if outreach is later sent from `contact@quotefoundry.app`
> via Resend, the root will need Resend's send mechanism too. Keep it to ONE root
> SPF: `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all`.
> Receiving (Cloudflare MX) and sending (Resend) coexist fine — MX governs
> inbound, SPF governs outbound; they don't conflict as long as SPF stays single.

## Step 4 — Verify (agent-built script)

```
python scripts/leadfinder/verify_email_dns.py
```

Re-run until it prints **READY**. Propagation on Cloudflare is usually minutes.
Every check that's still amber/red names the exact missing record.

## Step 5 — Warm-up & hygiene (before outreach volume)

Per [08-outreach-campaign-plan.md](08-outreach-campaign-plan.md) §Founder checklist:
- Week 1: cap sends at ~10/day; watch bounces in the Resend dashboard; pause if
  bounce rate > 5%.
- Keep DMARC at `p=none` until aggregate reports look clean.

## Step 6 — Live round-trip test (do this last)

1. **Receive:** from any personal account, email `contact@quotefoundry.app`;
   confirm it lands in datafikr@gmail.com; reply and confirm threading.
2. **Send (quote path):** once deployed, send a real quote to your own address;
   confirm it arrives from `quotes@send.quotefoundry.app`, not in spam, with the
   shop name as sender and PDF attached.
3. **Send (outreach path):** `python scripts/leadfinder/send_outreach.py --step 1
   --send --to-override datafikr@gmail.com --limit 1` (per doc 08) — confirm
   from-name, `reply_to: contact@`, and that a reply forwards back to Gmail.

---

## What the agent did vs. what the founder must do

**Agent (done):**
- Built `scripts/leadfinder/verify_email_dns.py` (DoH-based, stdlib, exit-code gate).
- Confirmed DNS host = Cloudflare and captured current record state (DKIM already live).
- Wrote this runbook with the exact records and merge rules.

**Founder (dashboard actions — cannot be scripted without a Cloudflare API token):**
- Add the Resend MX/SPF records in Cloudflare; click Verify in Resend (both domains).
- Add the DMARC TXT record.
- Enable Cloudflare Email Routing and verify the `contact@` → Gmail destination.
- Run the verifier; do the live round-trip test.

> If you want this fully automated, create a scoped **Cloudflare API token**
> (Zone.DNS: Edit for quotefoundry.app) and a **Resend API** domain read, and the
> agent can add the records and poll verification programmatically instead of by
> hand. Not required for launch.
