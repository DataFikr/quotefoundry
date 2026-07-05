# QuoteFoundry — Master Execution Plan (Consolidated)

*Consulting engagement deliverable 7 · July 2026*
*Consolidates: 01 feature inventory, 02 SWOT, 03 market research, 04 PMF verdict, 05 90-day roadmap, 06 design review — into ONE sequential plan a Claude Code session can execute phase by phase.*

**How to use this document:** work phases strictly in order; within a phase, tasks are
ordered. Each task is tagged **[CLAUDE]** (executable in a coding session) or **[FOUNDER]**
(requires human accounts/money/judgment — Claude can prepare but not complete). Do not start
a phase until the previous phase's **gate** passes. Product scope is FROZEN per 04 §4 — if a
task seems to require a new feature, stop and re-read the Deferred list (§9).

**Standing invariants for every code task** (from CLAUDE.md — violations are bugs):
engine stays pure, one engine for screen and save; RLS does isolation (never filter shop_id
in app code); rate snapshots are immutable; customer PDF never shows margin/overhead/cost;
never position as "AI generates quotes"; keep all `*.test.mjs`/vitest/e2e suites green;
update design-gate expected values in the same commit as any token change.

---

## Phase 0 — Founder prerequisites (day 1; everything else queues behind this)

| # | Task | Owner | Notes |
|---|---|---|---|
| 0.1 | Buy domain (e.g. quotefoundry.app) | **[FOUNDER]** | Needed by 1.2 and 2.x |
| 0.2 | **Start email DNS now**: create `send.` subdomain, add SPF/DKIM/DMARC per Resend's records | **[FOUNDER]** (Claude can generate the exact DNS records checklist) | Propagation is calendar time — this is why it's task 0.2, not 3.x |
| 0.3 | Create Supabase project (free tier) | **[FOUNDER]** | Grab URL + anon key + service-role key |
| 0.4 | Create Vercel (or Netlify) account, connect the git repo | **[FOUNDER]** | Vercel recommended: API routes solve the 3 server endpoints |
| 0.5 | Create Resend account; get API key | **[FOUNDER]** | |
| 0.6 | Create Sentry (free) + Plausible or GA4 account | **[FOUNDER]** | For 1.6 |

**Gate 0: domain purchased, DNS records submitted, all keys available as env values.**

---

## Phase 1 — Launch plumbing (05 §weeks 1–2; traces to 01 §2.2/§4)

| # | Task | Owner | Files / detail | Acceptance |
|---|---|---|---|---|
| 1.1 | Load schema into Supabase | **[FOUNDER]** runs, **[CLAUDE]** preps | Run `server/quotefoundry_schema.sql` in SQL editor | All 6 tables + RLS policies exist |
| 1.2 | Wire live env | **[CLAUDE]** | `.env` from `.env.example`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; confirm `devBootstrap()` (src/app/) takes the live path when vars present | App boots against live Supabase locally |
| 1.3 | Implement the 3 server endpoints | **[CLAUDE]** | Vercel API routes (or Supabase Edge Functions): `POST /api/generate-pdf` → wraps `src/pdf-generation/src/generateQuotePdf.mjs`; `POST /api/send-quote-email` → wraps `src/email-integration/server/sendQuoteEmail.ts` (server re-verifies quote belongs to caller's shop — service-role bypasses RLS, per CLAUDE.md §4.5); `GET /api/track-open` → pixel + `sent → opened` only | Each endpoint exercised by a local test; email lands in inbox (not spam) once DNS verified |
| 1.4 | Deployment config + CI | **[CLAUDE]** | `vercel.json` (or netlify.toml), env vars in dashboard **[FOUNDER]**, build = existing `npm run build` | Production URL serves the app |
| 1.5 | Un-stub stage-8 e2e + adversarial RLS test | **[CLAUDE]** | `e2e/stage8.spec.ts`: real sign-up → save quote round-trip; then log in as shop A, fetch shop B's quote by id, expect empty (CLAUDE.md §4.1) | stage8 green against live DB |
| 1.6 | Error tracking + analytics | **[CLAUDE]** | Sentry SDK init in `src/main.tsx`; Plausible/GA snippet in `index.html` | Errors and pageviews visible in dashboards |
| 1.7 | Full production round-trip | **[FOUNDER]** | Sign up → set rates → quote → PDF → email to self → open → pixel advances status | Every step works on the production URL |

**Gate 1: a stranger can sign up and send a real tracked quote from production. All test suites green.**

---

## Phase 2 — Design P0: fix before any design partner logs in (06 §8 P0; ~2–3 dev-days)

All **[CLAUDE]**. Token changes must update design-gate expectations (`e2e/smoke.spec.ts`, `e2e/stage4.spec.ts`) in the same commit.

| # | Task | Files | Acceptance |
|---|---|---|---|
| 2.1 | Restore focus visibility: replace `input:focus…{outline:none}` with a token-colored `:focus-visible` ring (inputs, buttons, clickable rows) | `src/styles/global.css:28` | Tab through Pipeline → Editor: focus always visible; new design-gate assertion added |
| 2.2 | Contrast pass: darken `muted` (#9698D6) and `faint` (#B0B0C8) to ≥4.5:1 on `appBg`/white; fix white-on-`accent` button (3.55) and `success`-on-`successBg` pill (2.86) to ≥4.5:1 via deeper foregrounds or weight/size bump | `src/design/tokens.ts`, CSS vars in `src/styles/global.css`, gate values in e2e specs | Re-run contrast math (06 §6 method); all listed pairs ≥4.5 (or ≥3.0 where genuinely large text); screenshot-diff baselines regenerated intentionally |
| 2.3 | Undo on outcome actions: "Mark won"/"Mark lost" apply instantly but show a 5-second undo toast (introduces the minimal toast primitive — also satisfies P1 task 4.2) | `src/screens/DetailScreen.tsx`, new `src/app/Toast.tsx` | Misclick recoverable; status reverts on undo; quote_events not double-logged |
| 2.4 | Mobile editor sticky mini-total: persistent bottom bar showing live `quoted_price` (tap → expand full cost panel) when `useIsMobile()` | `src/screens/EditorScreen.tsx` (panel at ~line 334) | At 390px the live price is always visible while editing; stage-7 e2e extended to assert it |
| 2.5 | Form a11y: `htmlFor`/`id` on all label-input pairs; keyboard support (arrow/enter/escape) + `aria-expanded`/`role="listbox"` on the customer dropdown; `aria-label` on icon-rail nav buttons + `title` tooltips | `src/screens/EditorScreen.tsx`, `RatesScreen.tsx`, `AuthScreen.tsx`, `CustomersScreen.tsx`, `src/app/AppShell.tsx` | Whole quote-creation flow completable by keyboard only |

**Gate 2: keyboard-only quote creation works; contrast table (06 §6) passes; all suites green.**

---

## Phase 3 — Inbound surface (05 §weeks 2–3 + 06 P1 brand item; SEO/AEO/LLM)

| # | Task | Owner | Files / detail | Acceptance |
|---|---|---|---|---|
| 3.1 | Technical SEO/AEO base | **[CLAUDE]** | `index.html`: real title/meta description/OG tags; `public/robots.txt` **explicitly allowing** `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`; `public/sitemap.xml`; `public/llms.txt` (product summary + key pages, per 03 §4) | Files served on production; Rich Results test passes |
| 3.2 | Public pricing page | — | **DEFERRED by founder decision 2026-07-03**: beta-first pricing validation — dollar tiers publish only after 3–5 design partners react to founding pricing in conversation. Replaced by a "Founding partner beta" landing section (free during beta · founding price locked forever · flat per-shop, no per-user fees — no dollar figures). Converts to the full pricing page in one edit post-validation. | Beta section live on landing (`data-testid="founding-beta"`) ✅ 2026-07-03 |
| 3.3 | Unify landing palette with app tokens (06 P1) | **[CLAUDE]** | `src/screens/LandingScreen.tsx`: local `DK/BLUE/GREEN` consts replaced with `tokens.ts` values (post-contrast-pass accent family) | ✅ 2026-07-03 — no brand seam at sign-up |
| 3.4 | Cornerstone content pages — **TRIMMED to 2 of 5** (founder decision 2026-07-03): how-to-price guide + quote-template lead magnet shipped as static HTML in `public/guides/` (no router dependency), answer-formatted with FAQPage schema; template CSV headers locked to Doc Assist synonyms by `templateRoundtrip.test.ts`. Remaining 3 (Paperless Parts alternatives, JobBOSS² alternatives, what-does-it-cost) **deferred until beta feedback** settles positioning/pricing | **[CLAUDE]** drafted, **[FOUNDER]** reviews claims | Pages in sitemap, linked from landing footer | ✅ 2026-07-03 (2 pages) |
| 3.5 | Directory listings: Capterra, G2, GetApp/Software Advice free tiers | **[FOUNDER]** (Claude drafts listing copy) | Copy from positioning: deterministic engine, flat pricing. Do after production deploy (needs a live URL) | Listings live |

**Gate 3 (amended for the beta-first scope): production site is crawlable and citable by answer engines with the founding-partner story public (dollar pricing intentionally not yet published); ask ChatGPT/Perplexity "affordable quoting software for a small fab shop" at week 10 to check citation (05 §weeks 9–12).**

---

## Phase 4 — Design P1 remainder (before/at public launch; 06 §8 P1)

All **[CLAUDE]**.

| # | Task | Files | Acceptance |
|---|---|---|---|
| 4.1 | URL routing (hash): `#/quotes`, `#/quotes/:id`, `#/quotes/:id/edit`, `#/quotes/new`, `#/customers`, `#/rates` — a ~60-line hash router (`src/app/useHashRoute.ts`) replaced `useState<Screen>` in AppShell; App.tsx enters the app on an in-app hash so live refresh resumes. Hash (not path) needs no server rewrites | `src/app/useHashRoute.ts`, `src/app/AppShell.tsx`, `src/App.tsx` | ✅ 2026-07-04 — refresh preserves location (list + quote), quote URLs shareable, browser Back works; 5 routing/toast e2e specs added to `e2e/stage4.spec.ts` |
| 4.2 | Toast layer lifted to AppShell (survives the navigation a mutation triggers) and passed to every screen as `notify`; wired to save (editor), clone + delete + won/lost-undo (detail), clone + delete (pipeline), add + delete (customers), save (rates). Detail's local toast removed (one layer) | `src/app/AppShell.tsx`, `Toast.tsx`, all five screens | ✅ 2026-07-04 — non-blocking confirmation on every mutation |
| 4.3 | Network diet: removed the unused Tabler icon webfont CDN entirely (app uses Line Awesome only — zero `ti ti-*` usages), trimmed Lato `300` weight (kept 400/700/900) | `index.html` | ✅ 2026-07-04 — one fewer CDN stylesheet + a font weight; no missing glyphs (all screenshot gates green) |

**Gate 4: all suites green (52 vitest · 16 mock · 48 e2e) ✅. Lighthouse ≥90 perf/SEO/a11y on landing + pipeline — [FOUNDER] to measure on the deployed URL; the diet + Phase-2 a11y (focus rings, ARIA) + Phase-3 meta/OG/sitemap set it up to pass.**

---

## Phase 5 — Market-testing loop (05 §weeks 3–12; founder-led, Claude assists)

| # | Task | Owner | Claude's role |
|---|---|---|---|
| 5.1 | Recruit 10–12 design partners (leadfinder list `scripts/leadfinder/shopListHouston.json`, forums, network); free → founding price told upfront | **[FOUNDER]** | Draft outreach emails; filter/rank the 1,026-shop list (has website/email? review count?) |
| 5.2 | Community presence: PM, r/Machinists, r/Welding, WeldingWeb — participate 2–3 wks before mentioning product; always disclose | **[FOUNDER]** | Draft answer material from the how-to-price cornerstone; log recurring pain phrasing → feed content + Doc Assist synonym list |
| 5.3 | Instrument activation: time-to-first-real-quote per shop | **[CLAUDE]** | Analytics event on first quote save + send |
| 5.4 | Week 6+: conversion — $490 founding-annual first, $49/mo fallback; hand-invoice (no Stripe, per build order) | **[FOUNDER]** | Draft the conversion email + invoice text |
| 5.5 | Publish 1–2 permissioned case snippets on site | **[CLAUDE]** drafts | Adds LLM-citable specifics |
| 5.6 | Polish-only fixes from partner feedback | **[CLAUDE]** | Anything feature-shaped goes to §9 instead |

**Decision gates (pre-committed, 05 §3):** wk5 ≥8 active partners else pivot channel · wk6 median first-quote ≤1 session else stop selling and fix onboarding · wk9 ≥3 paying else run the diagnosis protocol · wk12 $1,000 collected else apply the 05 §3 branch logic.

---

## §9 Deferred — explicitly NOT in this plan (do not build without a new decision)

From 04/05 (product): accuracy loop, win-rate analytics, auto follow-ups, multi-user roles,
invoice/PO conversion, CAD/DXF, OCR/vision, RFQ-entity, quote revisions, customer portal,
Stripe Checkout (hand-invoice until ~10 paying shops), paid ads, Doc Assist Tier 2 un-stub.
From 06 (design P2): component-library extraction / shadcn+Lucide migration, tablet
breakpoint + CSS-media-query migration, dark mode, kanban view, ⌘K palette, keyboard
shortcuts, design-gate geometry/contrast assertions beyond those added in Phase 2.

---

## Verification summary (run at every gate)

1. `npm run test` (vitest) + `npm run test:e2e` (Playwright incl. design gates) — all green.
2. Mock end-to-end still passes: `npm run mock` (`src/mock-supabase/runApp.mjs`).
3. Adversarial RLS check green against live DB (1.5).
4. Contrast table (06 §6 pairs) recomputed after any token change.
5. Production round-trip (1.7) re-run after any deploy-affecting change.
6. Positioning check on any new public copy: no "AI quotes" language; flat per-shop pricing stated; no surprise-charge implications.
