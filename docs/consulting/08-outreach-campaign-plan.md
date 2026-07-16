# 08 — Phase-1 Outreach Campaign: Execution Plan (HANDOFF)

> **Status:** approved plan, NOT yet implemented.
> **Intended executor:** a coding agent (Opus model) in a later session.
> Executor: read CLAUDE.md first; positioning rules there are binding.

## Context

QuoteFoundry's PMF evaluation ([04-pmf-evaluation.md](04-pmf-evaluation.md)) concluded: **strong product-problem fit, unproven distribution — proceed to market test**. This campaign is that test: cold-email ~160 US metal-fab shops (all leads in [scripts/leadfinder/all_leads.csv](../../scripts/leadfinder/all_leads.csv) that have an email), asking for feedback on whether QuoteFoundry solves their quoting pain, with a target of **≥20% replies (~32 replies)**. Replies feed the design-partner funnel from the 90-day roadmap ([05-market-testing-roadmap.md](05-market-testing-roadmap.md)).

**Founder decisions (locked — do not re-litigate):**
- Send as `QuoteFoundry <contact@quotefoundry.app>` — the product domain. The founder's name never appears; sign every email "— the QuoteFoundry team, quotefoundry.app".
- Automation = **Python + Resend API**. No n8n, no Zapier. Reuses the provider already wired in `src/email-integration/`.
- Launch with the ~160 leads that already have emails. No enrichment crawl for now.
- Replies route to **datafikr@gmail.com** via DNS-level email forwarding.

**Expectation-setting (state this in the campaign doc):** typical cold-email reply rates are 1–5%; 20% is aggressive. Maximize odds via tight targeting, personalization, a feedback-ask (not a sales-ask), and 2 follow-ups. Phone fallback (97% of leads have phones) triggers if replies lag (see Phase 5).

**List facts (verified 2026-07-06):** 324 leads total; 160 have email. Top-5 towns by concentration: Warren MI (49), Elk Grove Village IL (48), Detroit MI (47), Grand Prairie TX (42), Houston TX (42) — they hold ~125 of the 160 emails. Email all 160 across all 8 towns, prioritized by tier.

---

## Deliverables to build

### 1. Marketing plan document — `docs/consulting/08-outreach-campaign.md`
Follows the existing 01–07 numbering. Contains: campaign goal & success metric, audience & tiering rationale, the email sequence copy, sending cadence, compliance rules, metrics definition, phone-fallback trigger, and the design-partner conversion path (founding offer from 05-roadmap: free beta → founding price locked forever). Copy MUST follow the positioning lock in CLAUDE.md §1: **"quote faster, win more jobs, stop losing margin" — never "AI quotes"**.

### 2. Prospect scoring script — `scripts/leadfinder/score_leads.py`
Stdlib-only, same style as [parse_leads.py](../../scripts/leadfinder/parse_leads.py). Reads `all_leads.csv`, writes `outreach_targets.csv` with all existing columns plus `tier`, `first_line_hint` (trade keyword for personalization), `batch_order`.

Scoring (who best evaluates the MVP — 5–50-person job shops quoting custom work):
- **Drop:** no email; placeholder emails (e.g. `email@website.com`); name keywords outside ICP: awning, canvas, roofing, fence, mobile welding, supply, distribut.
- **Tier A:** own-domain email matching website domain + ICP keyword in name (fabricat, sheet metal, weld, laser, machin, metal works, precision) → most established, most likely to have the quoting pain.
- **Tier B:** freemail (gmail/yahoo) with website, or own-domain email without ICP keyword.
- **Tier C:** freemail, no website — smallest shops; still ICP (the Excel/paper 54%), lower deliverability confidence.
- Print a tier/town summary report (same report pattern as parse_leads.py).

### 3. Sender script — `scripts/leadfinder/send_outreach.py`
Python, Resend REST API (`https://api.resend.com/emails`, `RESEND_API_KEY` env var — same auth pattern as [src/email-integration/server/sendQuoteEmail.ts](../../src/email-integration/server/sendQuoteEmail.ts)).

Behavior:
- Reads `outreach_targets.csv` + state file `outreach_log.csv` (send timestamps, template step, Resend message id, `replied` / `unsubscribed` / `bounced` flags).
- `--step 1|2|3` selects template (initial / day-4 follow-up / day-9 follow-up). Follow-ups only go to rows whose step N−1 send is ≥ the wait days old AND not flagged replied/unsubscribed/bounced.
- Sends **10 per run** (hard cap; `--limit` overridable), Tier A first, ~2s sleep between sends.
- Personalization: `{shop_name}` (cleaned — strip Inc/LLC via the `_SUFFIXES` regex from parse_leads.py), `{city}`, `{first_line_hint}`.
- `--dry-run` is the DEFAULT (explicit `--send` required to send). Dry-run prints fully rendered emails.
- Plain-text body only (best cold deliverability). `reply_to: contact@quotefoundry.app`. CAN-SPAM footer: physical mailing address placeholder (founder fills) + "reply 'no thanks' and we won't email again".
- Management flags: `--mark-replied <email>`, `--unsubscribe <email>`, `--to-override <email>` (test sends).
- Suppression: never re-email anyone flagged replied/unsubscribed/bounced.

### 4. Email sequence copy (in the 08 doc + as constants in send_outreach.py)
Three short plain-text emails, feedback-framed, citing verified pain points from [03-market-demand-research.md](03-market-demand-research.md):
- **Step 1 (Day 0):** subject ≈ "quick question about quoting at {shop_name}". Body: 5–6-day industry quote turnaround / fast responders win 28–35% vs 12–20%; we built a quoting tool for shops your size in {city}; would you look and tell us if we got it wrong? Single CTA: reply with feedback (free founding access as thanks).
- **Step 2 (Day 4):** shorter bump — the manual-costing-underbids-8–15% / margin angle.
- **Step 3 (Day 9):** final — "closing the feedback group" + one-line ask; mention flat per-shop pricing, no per-user fees.
- All signed "— the QuoteFoundry team, quotefoundry.app". No founder name anywhere.

### 5. Founder manual checklist (goes in the 08 doc — infra the agent cannot do)
1. Resend dashboard: verify root domain `quotefoundry.app` (SPF + DKIM at the DNS host). Existing plan only covers the `send.` subdomain; root verification is required for `contact@`.
2. Add DMARC record (`p=none` to start).
3. Set up email forwarding `contact@quotefoundry.app` → `datafikr@gmail.com`: Cloudflare Email Routing (free, if DNS is on Cloudflare) or ImprovMX free tier. Resend is send-only here; receive path is DNS-level forwarding.
4. Test round-trip: send to contact@, confirm it lands in Gmail; reply and confirm threading.
5. Fill the physical-address placeholder in the template footer (CAN-SPAM requirement).
6. Warm-up: week 1 send only 10/day; watch bounces in Resend dashboard; pause if bounce rate >5%.

### 6. Campaign phases
- **Phase 0 — Infrastructure (founder, days 1–3):** checklist above; DNS propagation buffer.
- **Phase 1 — List & scoring (agent, day 1):** build + run score_leads.py; founder eyeballs Tier A.
- **Phase 2 — Copy approval (founder, day 2):** approve/edit the 3 templates before any send.
- **Phase 3 — Sender build & dry-run (agent, days 2–3):** send_outreach.py; review dry-run output; one live test to the founder's own address.
- **Phase 4 — Launch (weeks 1–3):** 10/run, 1 run/day week 1 (Tier A only), 2 runs/day after; steps 2–3 fire per schedule. Founder marks replies as they arrive in Gmail (`--mark-replied`).
- **Phase 5 — Measure & convert (weeks 2–4):** weekly readout: sent/delivered/bounced/replied by tier & town. If reply rate <5% after 60 step-1 sends → stop and revise subject/copy. If <10% at full send → activate phone-call fallback (phones from CSV). Positive replies → founding-partner offer; log feedback themes into the 08 doc.

### 7. MCP note
No new MCP required — Resend is plain HTTPS. Optional Phase-5 upgrades: Gmail MCP (available in this Claude Code environment) to scan forwarded replies and auto-mark `replied`; Notion MCP for a feedback tracker. Nice-to-haves, not blockers.

---

## Files to create/modify

| File | Action |
|---|---|
| `docs/consulting/08-outreach-campaign.md` | create — full marketing plan + copy + founder checklist |
| `scripts/leadfinder/score_leads.py` | create — tiering → `outreach_targets.csv` |
| `scripts/leadfinder/send_outreach.py` | create — Resend sender, 10/run, log/state, dry-run default |
| `scripts/leadfinder/README.md` | update — document the two new scripts |
| `scripts/leadfinder/.gitignore` | update — ignore `outreach_log.csv` (send state / PII) |

Reuse: `_SUFFIXES` / `clean()` from parse_leads.py; Resend call shape from `src/email-integration/server/sendQuoteEmail.ts`; positioning + pain-point copy from CLAUDE.md §1 and docs/consulting/03, 04, 05.

## Verification
1. `python score_leads.py` → tier/town report prints; spot-check that placeholder emails and out-of-ICP names are dropped and Tier A looks right.
2. `python send_outreach.py --step 1` (dry-run) → 10 rendered emails with correct personalization, footer, reply-to.
3. `python send_outreach.py --step 1 --send --to-override datafikr@gmail.com --limit 1` → real send to the founder's inbox; verify from-name, reply-to, formatting, and reply forwarding round-trips.
4. Re-run dry-run → log prevents duplicate sends; `--step 2` before day 4 sends nothing.
