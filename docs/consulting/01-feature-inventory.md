# QuoteFoundry — MVP Feature Inventory & Launch-Readiness Audit

*Consulting engagement deliverable 1 of 5 · July 2026*
*Method: full codebase dissection of `micro-mes` repository. Every claim below references a file path.*

---

## 1. What the product is (as built)

A quoting web app for US metal-fab / sheet-metal / welding job shops (5–50 employees). An
estimator enters job inputs (material weight, labor hours by discipline, outside services),
the app computes a priced quote from **the shop's own stored rates** via a deterministic
engine, and produces a branded customer PDF and a tracked email send. No AI pricing;
AI-adjacent functionality is limited to optional document pre-fill (spreadsheet parsing,
zero tokens).

---

## 2. Feature inventory

### 2.1 Implemented and working (against the mock backend)

| # | Feature | Where | Notes |
|---|---------|-------|-------|
| 1 | **Landing page** | `src/screens/LandingScreen.tsx` | Hero, 3-step CTA, "no credit card / live in 15 min / cancel anytime" |
| 2 | **Auth + shop provisioning** | `src/screens/AuthScreen.tsx`, `src/auth-wiring/` | Sign-up → `bootstrap_shop()` provisioning; 12/12 tests |
| 3 | **Quote editor with live pricing** | `src/screens/EditorScreen.tsx` | Two-panel: inputs left, live cost summary right; same engine as save path |
| 4 | **Pricing engine (pure function)** | `src/data-access-layer/lib/quoteEngine.ts` | Sequential math: cost → ×(1+overhead) → ×(1+margin). Canonical value $1,913.82 test-locked |
| 5 | **Rate snapshotting** | `src/data-access-layer/services/quoteService.ts` | Quote freezes rates at creation (`structuredClone`); rate edits never reprice existing quotes; clone re-snapshots at current rates |
| 6 | **Quote pipeline** | `src/screens/PipelineScreen.tsx` | Filter/search by status (draft/sent/opened/won/lost); stat cards: open pipeline $, win rate, avg quote |
| 7 | **Quote detail (internal view)** | `src/screens/DetailScreen.tsx` | Full cost breakdown incl. overhead/margin, activity timeline, send / won / lost / clone actions |
| 8 | **Rate settings** | `src/screens/RatesScreen.tsx` | 3 tabs: material library ($/lb + scrap %), labor rates (cut/fit/weld/finish + burn $/hr + consumables), overhead & margin % |
| 9 | **Customer management** | `src/screens/CustomersScreen.tsx` | CRUD; customer snapshot copied onto quote (PDF stays stable if record changes) |
| 10 | **Customer PDF (margin-hiding)** | `src/pdf-generation/src/generateQuotePdf.mjs` | Customer sees scope + total only; margin/overhead/cost folded away — verified by test |
| 11 | **Quote email + open tracking** | `src/email-integration/server/sendQuoteEmail.ts` | Resend integration, authenticated subdomain sender, reply-to shop, tracking pixel advances `sent → opened` only; 12/12 tests |
| 12 | **Doc Assist Tier 1 (spreadsheet)** | `src/doc-assist/src/spreadsheetParser.ts` | XLSX/CSV header-synonym matching pre-fills the editor; zero AI tokens; 25 tests |
| 13 | **Doc Assist Tier 3 (store-only)** | `src/doc-assist/src/docAssistService.ts` | Any file (DWG/images/scans) attached to quote; no upload dead-ends |
| 14 | **Mobile responsive pass** | `useIsMobile()` hook across screens | ≤600px breakpoint; 40px+ touch targets; validated by stage-7 e2e gate at 390px |
| 15 | **Per-shop data isolation (RLS)** | `server/quotefoundry_schema.sql` | 6 tables, RLS on all, `current_shop_id()` from JWT; services never pass `shop_id` |

### 2.2 Code-complete but NOT deployed (the launch blockers)

| Item | State | What's missing |
|------|-------|----------------|
| Live Supabase backend | Schema file ready (`server/quotefoundry_schema.sql`); app boots against mock when `VITE_SUPABASE_URL` is absent | Supabase project not provisioned; `.env` empty; stage-8 e2e gate (`e2e/stage8.spec.ts`) is a stub |
| PDF download endpoint | Generator works in tests | No HTTP endpoint (`/api/generate-pdf` or Edge Function) |
| Email send endpoint | Sender works in tests | No HTTP endpoint; no `RESEND_API_KEY`; no sending-domain DNS (SPF/DKIM/DMARC) |
| Tracking pixel endpoint | Logic tested | No `GET /api/track-open` route deployed |
| Hosting | `npm run build` produces `dist/` (Vite) | No vercel.json/netlify.toml, no CI/CD, no domain, no SSL |
| Monitoring | — | No error tracking or analytics of any kind |

### 2.3 Deliberately stubbed / out of MVP scope

- **Doc Assist Tier 2** (text-layer PDF): gate + keyword matching written, UI shows "coming soon" (`src/doc-assist/src/docAssistService.ts`).
- **Billing**: schema has Stripe fields (`shops.stripe_customer_id`, `plan`, `trial_ends_at`) but zero Stripe code — intentional; first shops hand-invoiced.
- Post-launch roadmap (per CLAUDE.md §9): estimate-vs-actual accuracy loop, win-rate analytics, auto follow-ups, multi-user roles, invoice/PO conversion, CAD/DXF parsing, OCR, quote revisions, customer portal.

### 2.4 Marketing / inbound surface — effectively zero

| Asset | Status |
|-------|--------|
| SEO metadata (title/description/OG) | ❌ generic `<title>QuoteFoundry</title>` only (`index.html`) |
| robots.txt / sitemap.xml | ❌ none |
| Structured data (JSON-LD) | ❌ none |
| llms.txt / AEO surface | ❌ none |
| Public pricing page | ❌ none |
| Content/blog/comparison pages | ❌ none |
| Directory listings (Capterra/G2) | ❌ none |
| Analytics | ❌ none |

### 2.5 Adjacent asset: outbound lead list

`scripts/leadfinder/` — a working Python Brave-Search crawler that discovers fab shops and
extracts contacts; `shopListHouston.json` holds **1,026 Houston-area sheet-metal shops**
(name, phone, city, review counts; mostly no emails). Not wired to the app. Relevant as an
optional outbound accelerant even though the chosen strategy is inbound.

---

## 3. Test coverage (all green as of this audit)

| Suite | Files | Coverage |
|-------|-------|----------|
| Unit/integration (Vitest) | `quoteEngine.test.ts`, `services.test.ts`, `authService.test.ts`, `emailService.test.ts`, `pdf.test.ts`, `docAssist.test.ts` | Engine math (canonical $1,913.82), snapshot immutability, RLS isolation, auth flow, email state machine, PDF margin-hiding, parsing |
| E2E (Playwright) | `e2e/smoke.spec.ts`, `stage4–stage10.spec.ts` | Screens, mobile, PDF, email flows. **stage8 (live Supabase) is a stub awaiting credentials** |
| Mock end-to-end | `src/mock-supabase/runApp.mjs` | 16/16 full-app run |

---

## 4. Launch-blocker checklist (ordered)

1. Provision Supabase project → load `server/quotefoundry_schema.sql` → set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. **Start email DNS immediately** (SPF/DKIM/DMARC on a sending subdomain) — propagation is calendar time, not work time.
3. Deploy frontend (Vercel/Netlify) + the three server endpoints (PDF, email send, tracking pixel) as Edge Functions or API routes.
4. Un-stub `e2e/stage8.spec.ts`; run the adversarial isolation test (shop A fetching shop B's quote must return empty) against the real DB.
5. Real sign-up → save-quote → PDF → email round-trip on production.
6. SEO/AEO infrastructure + pricing page (detailed in deliverable 05).

---

## 5. Bottom line

**The product is ~80–85% built and 0% launched.** Every user-facing feature the market-fit
analysis (deliverable 04) credits actually exists in code with passing tests — but none of it
is reachable by a customer today. The remaining work is deployment plumbing and an inbound
surface, not product invention. That is the correct problem to have three months before a
revenue deadline: the risk is concentrated in distribution, not engineering.
