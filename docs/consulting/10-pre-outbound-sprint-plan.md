# 10 — Pre-Outbound Enhancement Sprint (7/15–7/17, 4h/day · outbound launch 7/20/2026)

> **Status:** approved plan (2026-07-14).
> **Model budget:** Fable 5 access ends **7/19** — reserve it for security-boundary and
> invariant-touching work; use Opus (/fast) for spec-following mechanical work.
> Executor: read CLAUDE.md first; positioning rules there are binding.

## Context

Outbound to ~160 metal-fab shops ([08-outreach-campaign-plan.md](08-outreach-campaign-plan.md))
launches **7/20/2026**. Current-state audit (this session): build-order items 1–4 are DONE —
live Supabase verified 9/9 incl. adversarial isolation, all daily-loop screens wired in
`src/app/AppShell.tsx`, PDF/email serverless endpoints in `api/`, responsive pass validated
at 390px, 52/52 tests green, demo video live on landing. The binding constraint is **not
features — it's deployment, email deliverability, and distribution assets**.

This sprint: ship the mandatory infra, add ONE asymmetric hook feature (**public quote link
+ Accept/Decline**), and publish the **transparent pricing + comparison page** — the
differentiator no incumbent can copy.

Founder decisions (locked): hook feature = public quote link + Accept; GTM asset = pricing +
comparison page. Stale-quote follow-up nudge = stretch goal only.

---

## 1. Competitive positioning (evidence base: [03-market-demand-research.md](03-market-demand-research.md) + live fetches 2026-07-14)

**Audience psychology:** owner-estimator at a 5–50-person fab/weld shop. Job-to-be-done: get
the quote out tonight without underbidding. Dominant anxiety: "software companies burn me —
opaque pricing, per-user fees, months of setup." Purchase trigger: lost a job to a faster
quoter, or the Excel sheet broke. Awareness stage: **problem-aware, solution-skeptical** —
copy leads with pain + transparency, never "AI."

**Unit economics:** founding offer $49/mo or $490/yr (USER-PROVIDED, [05-market-testing-roadmap.md](05-market-testing-roadmap.md)).
CAC ≈ founder time only (cold email). Reply target 20% (TARGET, aggressive; cold-email
BENCHMARK is 1–5% — doc 08 states this honestly).

### Asymmetric battlecard

| Competitor | Their strength (conceded) | Trade-off it forces | Our angle |
|---|---|---|---|
| **Paperless Parts** | Deep geometry analysis, ITAR/CMMC, #1 brand | Opaque quote-based pricing; built for shops with a full-time estimator; heavy implementation | "Public price, live in 15 min, no sales call" |
| **uptool / Toolpath** | AI automation, 2-min quotes | "AI quotes" = trust liability in this market; CNC-milling-centric | "Your rates, deterministic math, no guesswork" |
| **Xometry** | Free instant quotes, steady job flow | It's a marketplace — it owns your customer and commoditizes your work | "Your customer, your margin, your brand on the PDF" |
| **Tempus ToolBox** ($100/mo) | Transparent pricing, laser geometry | Laser-only; 20-quote/mo cap on Starter tier | General fab/weld, no quote caps, cheaper |
| **Excel / do nothing (the real #1)** | Free, familiar, infinitely flexible | Fragile, no pipeline, no branded output, underbids 8–15% (BENCHMARK, vendor-sourced) | "Keep your rates-times-hours model — we make it fast, branded, trackable" |
| BidAnchor / Urable / MyDetailQuote | *(not competitors — adjacent-niche trades/detailing tools)* | — | **UX patterns to borrow:** accept-and-pay links, automated follow-up, 60-second quote, free no-signup tool |

**Empty slot confirmed:** transparent flat per-shop pricing under $150/mo for general
fab/weld quoting has no occupant. **The pricing page IS the positioning.**

**Pain points (forums, last 3 yrs — verified in doc 03):** 5–6 day turnarounds vs 1–2-day
shops winning 28–35%; Excel fragility ("just use Excel" advice unchanged since 2013);
per-user fee resentment; opaque pricing as a documented turnoff; margin leaks from by-feel
pricing. Practical Machinist blocks scraping — community evidence gathering = participate
directly (post-launch motion).

---

## 2. Sprint plan — 3 days × 4 hours, with model allocation

**Allocation principle:** **Fable 5** for anything touching the security boundary, pricing
invariants, or architecture (public quote endpoint, margin-hiding reuse, final review
passes). **Opus /fast** for well-specified mechanical work: the outreach scripts (doc 08 was
written as an Opus handoff), deploy config, landing/comparison copy, CSS.

### Day 1 (7/15) — Ship the infrastructure · **Opus**

| Hrs | Task |
|---|---|
| 1.5 | **Deploy to Vercel**: connect repo, env vars from `.env.production` (**rotate the Resend API key first** — it's exposed in the env file and session logs), verify the 3 serverless endpoints (`api/send-quote-email.ts`, `api/generate-pdf.ts`, `api/track-open.ts`), point `quotefoundry.app` DNS, SSL. |
| 1.0 | **Email DNS (founder + agent)**: verify root `quotefoundry.app` + `send.` subdomain in Resend (SPF/DKIM), DMARC `p=none`, `contact@` → datafikr@gmail.com forwarding (Cloudflare Email Routing / ImprovMX). Start day 1 — propagation takes calendar time. |
| 1.5 | **Outreach scripts** per doc 08 spec: `scripts/leadfinder/score_leads.py` + `scripts/leadfinder/send_outreach.py` (dry-run default, 10/run cap, suppression log, CAN-SPAM footer). Run scoring, eyeball Tier A. |

End-of-day gate: `npm run verify:live` against the deployed app; live quote → PDF → email →
open-pixel round-trip to the founder's inbox.

### Day 2 (7/16) — Public quote link + Accept/Decline · **Fable 5**

The one feature no sub-$150 competitor demos: customer opens a branded link on their phone,
taps **Accept** → pipeline flips to won, shop notified. This is the outbound demo moment.

| Hrs | Task |
|---|---|
| 0.5 | Migration: `quotes.public_token uuid not null default gen_random_uuid()` + unique index. Token is the ONLY public credential; RLS untouched. |
| 1.5 | `api/quote-view.ts`: service-role lookup by token → returns **customer-safe payload only** — MUST reuse the customer-scope grouping from `src/pdf-generation/src/generateQuotePdf.mjs` (material / fabrication / outside services / shop fees & handling). Never send engine lines, margin, overhead, or `rate_snapshot` over this endpoint. |
| 1.0 | Public route `#/q/:token` in `AppShell.tsx`: mobile-first customer view (shop logo, scope groups, big total, validity date, Accept / Decline) + `api/quote-respond.ts`. Status rules mirror the open-tracking invariant: accept only advances `sent/opened → won`, decline → `lost`, NEVER downgrades or overrides a shop-set outcome; every response logged to `quote_events`. Include the link in the quote email + `CustomerPreviewModal`. |
| 1.0 | Tests: (a) adversarial — wrong/absent token returns nothing; shop A token cannot reach shop B data; (b) margin-leak — assert payload contains no margin/overhead/cost keys (same discipline as `pdf.test.ts`); (c) status-transition rules. Keep all existing tests green. |

### Day 3 (7/17) — GTM assets + regression + launch readiness · **Opus, Fable 5 review**

| Hrs | Task |
|---|---|
| 1.5 | **Pricing + comparison page** (Opus): founding-offer pricing table on `LandingScreen.tsx` ($49/mo founding / $490/yr; list $79–149 shown as future price — truthful, no fake scarcity); comparison route `#/compare`: QuoteFoundry vs Paperless Parts vs Tempus vs Excel — concede their strengths honestly (geometry analysis, ITAR), win on transparent price / per-shop / deterministic / accept-link. |
| 0.5 | **AEO files** (Opus): `robots.txt` allowing AI crawlers (OAI-SearchBot, Claude-SearchBot, PerplexityBot et al.), `llms.txt` at site root, FAQ-structured pricing answers (doc 03 §4 playbook). |
| 1.0 | **Outreach launch prep** (Opus): dry-run all 3 email steps, one live test send to datafikr@gmail.com, verify reply-forwarding round-trip, fill the CAN-SPAM physical-address placeholder (founder). |
| 1.0 | **Regression + review** (Fable 5): full `npm run test` + `npm run verify:live` + Playwright smoke at 390px; review Opus output for invariant violations (esp. anything near rates/quotes/isolation); update outreach step-1 copy to mention the accept-link ("your customer can accept from their phone"). |

**Stretch (only if Day 2 finishes early):** stale-quote follow-up nudge — pipeline badge for
`sent` quotes >4 days old + one-click follow-up email (Opus builds, Fable reviews the
status-transition logic).

---

## 3. Critical pre-outbound checklist (all must be true before 7/20)

1. ☐ quotefoundry.app serves the deployed app over SSL; signup → quote → send works live
2. ☐ Email round-trip verified: send from `send.` subdomain lands in Gmail inbox (not spam); reply to `contact@` reaches datafikr@gmail.com
3. ☐ Resend API key rotated (current key is exposed in `.env.production` and session logs)
4. ☐ Public quote link: token access tested adversarially; no margin/overhead in payload
5. ☐ Pricing visible on landing (cold-email recipients WILL check the site; opaque pricing kills the differentiator)
6. ☐ Outreach: score_leads.py run, Tier A eyeballed, dry-run reviewed, one live test send verified, CAN-SPAM footer complete
7. ☐ All tests green, canonical $1,913.82 engine test untouched
8. ☐ GA4 receiving events from the production domain

## 4. Design upgrade backlog (Claude Design)

- **In-sprint:** the public customer quote page is the flagship design artifact — run
  `/design-critique` on it before shipping (mobile-first, 44px+ Accept button, shop
  branding, WCAG AA against `src/design/tokens.ts`).
- Comparison-page table: /design-critique for scannability (checkmark-matrix pattern).
- **Post-sprint:** status-pill consistency pass (flagged in [06-design-review.md](06-design-review.md));
  PDF template refresh (photo-header variant as a 4th theme); pipeline "aging" visual (color
  ramp on days-since-sent); Figma MCP sync of landing hero for A/B variants; **free
  fab-quote calculator page** — the Practical Machinist / AEO play, deliberately deferred:
  forum users despise being sold to, so build the free artifact the week after outbound and
  only then participate in forums; never post product links before it exists.

## 5. Verification

- Engine/isolation: `npm run test` (52 tests) + `npm run verify:live` (9 live checks incl.
  cross-shop adversarial) after every day.
- New endpoints: curl `api/quote-view` with valid/invalid/foreign tokens; JSON-diff payload
  against a margin/overhead keyword denylist.
- E2E: Playwright smoke — landing → signup → quote → send → open public link → Accept →
  pipeline shows won. Desktop + 390px.
- Outreach: dry-run output inspected for all 3 steps; duplicate-send prevention re-run; live
  test to founder inbox.

## 6. Protocol compliance (marketing_deep_thinking)

**Checklist:** ☑ Phase-1 psychology/economics stated before strategy ☑ Phase-2 blueprint
before copy/plan ☑ metrics labeled USER-PROVIDED / BENCHMARK / TARGET ☑ ethics floor:
comparison page concedes competitor strengths truthfully, CAN-SPAM footer + suppression in
sender, founding price is a real dated offer (no fake scarcity) ☑ awareness-stage match:
problem-aware/solution-skeptical copy, never "AI quotes" ☑ substitutes (Excel /
non-consumption) included ☑ every recommendation is product/audience/budget-specific.

**DEFECT → FIX log:**
1. Initial framing treated competitor feature parity as the goal → research shows
   distribution/trust is binding; cut to ONE feature + infra.
2. Urable / MyDetailQuote / BidAnchor misclassified as competitors → reclassified as
   adjacent-niche UX pattern sources.
3. Battlecard omitted Excel/non-consumption → added as the real #1 competitor (54%
   pen/paper/spreadsheet, IoT Analytics).
4. Public quote endpoint could leak internal economics if it renders engine lines →
   mandated reuse of the PDF customer-grouping function + a margin-leak test.
5. Resend API key exposure noticed during audit → rotation added to Day 1.

**Weakest assumption:** that a public accept-link meaningfully lifts cold-email
reply/demo conversion. Cheapest test: A/B the outreach step-1 copy — half mention
"customers accept from their phone," half don't; compare reply rates after 60 sends.
