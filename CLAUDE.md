# CLAUDE.md — QuoteForge

Guidance for Claude Code. Read this fully before writing code. It encodes
decisions already made, invariants that must not break, and what is
deliberately out of scope. When in doubt, prefer the choices documented here
over inventing new ones.

---

## 1. What QuoteForge is

A quoting micro-SaaS for **US metal-fab / sheet-metal / welding job shops**
(5–50 employees). It lets an estimator turn a custom job into an accurate,
branded quote in ~10 minutes instead of an afternoon, using **the shop's own
stored rates** — not AI guesswork.

Positioning: "quote faster, win more jobs, stop losing margin."
NEVER position it as "AI generates accurate quotes." Accuracy comes from the
shop's rates and the deterministic engine; AI only assists with reading
uploaded documents.

What it is NOT: CAD, CAM, ERP, MRP, a toolpath generator, or a full RFQ
platform. It does not replace the estimator's judgment.

---

## 2. Tech stack (decided — do not swap without reason)

- **Frontend:** React + TypeScript. Functional components + hooks.
- **Backend / DB / Auth:** Supabase (Postgres + Row-Level Security + Supabase Auth).
- **Email:** transactional provider (Resend or Postmark), server-side only.
- **PDF:** server-side generation (pdfkit/reportlab-style; current code uses pdfkit).
- **Spreadsheet parse:** SheetJS (xlsx). **PDF text parse:** pdf-parse / pdfjs.
- **Billing (later):** Stripe Checkout + Customer Portal.

Supabase was chosen specifically for **Row-Level Security** — per-shop data
isolation enforced at the database, not in app code. Do not move auth/data off
Supabase without re-solving isolation.

---

## 3. Reference implementation (already built & tested — REUSE, don't rewrite)

These exist in the project as proven, test-passing modules. Treat them as the
source of truth and wire them to live Supabase. Do not re-architect them.

| Area | Files | Status |
|------|-------|--------|
| DB schema + RLS | `quoteforge_schema.sql` | 6 tables, RLS on all, validated |
| Engine + types | `data-access-layer/lib/quoteEngine.ts`, `types.ts` | canonical values locked by test |
| Services | `data-access-layer/services/quoteService.ts`, `rateService.ts` | snapshot + compute-on-save |
| Supabase client wrapper | `data-access-layer/lib/supabase.ts` | `Result<T>` pattern, `run()` helper |
| Auth + provisioning | `auth-wiring/services/authService.ts`, `components/AuthProvider.tsx` | 12/12 tests |
| Email send | `email-integration/server/sendQuoteEmail.ts`, `services/emailService.ts` | 12/12 tests |
| PDF generation | `pdf-generation/src/generateQuotePdf.mjs` | margin-hiding verified |
| Screens | `remaining-screens/components/*.tsx`, `vertical-slice/components/QuoteEditor.tsx` | wired to services |
| Doc assist (Tier 1+2) | `doc-assist/src/*.ts` | 25 + 20 tests |
| Mock backend (runs whole app) | `mock-supabase/` | 16/16 end-to-end |

Each module has a sibling `*.test.mjs`. Run them. Keep them green.

---

## 4. NON-NEGOTIABLE INVARIANTS (breaking any of these is a bug)

### 4.1 Per-shop data isolation
- Every shop-scoped table has a `shop_id` and an RLS policy keyed to
  `current_shop_id()` (resolved from the JWT).
- Services must NEVER pass `shop_id` manually or filter by it in app code —
  RLS does it. The client carries the user's token; the DB enforces scope.
- `bootstrap_shop()` is `SECURITY DEFINER` (the one hole in the wall). It must
  ONLY ever create a shop for the calling `auth.uid()` — never accept a user id
  as a parameter.
- Test adversarially: log in as shop A, try to fetch shop B's quote by id,
  confirm empty.

### 4.2 Rate snapshotting
- On quote create, copy the shop's CURRENT rates into the quote's
  `rate_snapshot` (JSONB). The quote computes from its snapshot FOREVER.
- Editing shop rates affects NEW quotes only. It must NEVER change a quote that
  already exists. (The rate-settings screen promises this in the UI — it must be
  true in code.)
- `update()` on a draft recomputes from the EXISTING snapshot, not live rates.
- `clone()` re-snapshots at CURRENT rates (a repeat job is priced at today's cost).
- **Deep-copy the rates when snapshotting** (`structuredClone`). A shared
  reference bug was caught in the mock run — mutating live rates mutated the
  "frozen" snapshot. Real Postgres JSONB copies by value, but app code must too.

### 4.3 One engine, shared by screen and save
- `computeQuote(inputs, rates)` is a PURE function. The live editor and the save
  path call the SAME function. This makes "screen total != saved total"
  structurally impossible. Do not duplicate the math anywhere.
- Order is SEQUENTIAL, not additive: cost → ×(1+overhead) → ×(1+margin).
  Margin applies to cost+overhead, not bare cost. Getting this wrong silently
  under-prices every job.
- Canonical check (240lb, qty1, burn35, labor 1.5/3/4/1.5, outside $85,
  rates 75/80/90/65 burn120 steel0.85 scrap15 cons12 oh18 margin30):
  material 234.60, labor 810, burn 70, cons 48, cost 1247.60, overhead 224.57,
  margin 441.65, **quoted_price 1913.82**. The test locks these. Keep it passing.

### 4.4 Customer PDF hides internal economics
- The customer-facing PDF shows scope + total ONLY. Margin, overhead, and bare
  shop cost must NEVER appear on it. Group engine lines into customer scope
  (material / fabrication labor & machine time / outside services) and fold the
  remainder into "shop fees & handling."
- The internal quote-detail view DOES show the full breakdown. Two views, one
  quote. Don't leak the internal view into the customer document.

### 4.5 Email deliverability
- Send from YOUR authenticated subdomain (e.g. quotes@send.quoteforge.app) with
  the shop NAME as display sender and the shop's real email as reply-to. You
  cannot send "as" the shop's domain without their DNS — faking it = spam.
- Server re-verifies the quote belongs to the caller's shop (service-role key
  bypasses RLS, so this check is on us).
- Open tracking only advances `sent → opened`, NEVER downgrades won/lost. Treat
  it as a soft "viewed" signal, never as proof of reading.

---

## 5. Document Assist module (optional, tiered — see PRD_Document_Assist_Module.md)

Optional branch INTO the existing editor. Never a separate workflow, never an
RFQ entity. Pre-fills the same fields the estimator would type.

- **Tier 1 — Spreadsheet (XLSX/CSV):** deterministic header matching against a
  synonym list. ZERO AI tokens. High confidence on exact header match. Priority.
- **Tier 2 — Text-layer PDF:** extract embedded text (free), run the
  **text-layer gate**, keyword-match fields. ZERO tokens by default. Fields are
  ALWAYS medium/low confidence (never high) — estimator must verify.
- **Tier 3 — Store-and-fallback:** scanned PDFs, images, DWG/STP/DXF, ZIP →
  attach the file, fall back to manual entry. NEVER OCR, NEVER a vision model.

**The text-layer gate is the cost bright line.** A PDF with no usable text layer
goes to Tier 3 — we never spend vision tokens on pixels. Err toward store-only
when unsure (a wrong "no" = manual entry, cheap; a wrong "yes" = wasted effort).

AI structuring of messy PDF text is DEFERRED and OFF by default
(`AI_STRUCTURING_ENABLED = false`). Enable only if real files prove keyword
matching insufficient; send extracted TEXT (cheap), never images; cap confidence
at medium.

Every uploaded file is stored against the quote regardless of tier. No upload
ever dead-ends. Engine-priced fields (labor hrs, rates) are NEVER extracted.

The synonym list (Tier 1) and regex rules (Tier 2) are meant to GROW from real
files. Log unmatched headers; expand from real misses. Don't over-anticipate.

---

## 6. Data model (see quoteforge_schema.sql for the real thing)

Tables: `shops`, `shop_users`, `shop_rates`, `customers`, `quotes`,
`quote_events` (+ add `quote_files` for doc-assist). All shop-scoped tables have
RLS. `quotes` carries `rate_snapshot` JSONB and stored computed totals (so list
views read numbers instead of recomputing). Quote numbers are app-side
(`Q-YYYY-NNN`), with `unique(shop_id, quote_number)` as the race safety net.
Customer name/email are snapshotted onto the quote too (so a PDF is stable even
if the customer record changes later).

---

## 7. Build order (do them in this sequence)

1. **Live Supabase wiring** — create project, load `quoteforge_schema.sql`,
   connect services/auth/editor, confirm a real sign-up → save-quote round-trip.
   This converts all the proven-in-test code into a running app. DO THIS FIRST.
2. **The daily loop screens** against live services: auth → pipeline → editor →
   detail → PDF → email send. Reuse the built components.
3. **PDF + email wiring** — connect generate → attach → send; set up the sending
   subdomain DNS (SPF/DKIM/DMARC) EARLY (propagation takes calendar time).
4. **Responsive pass** — pipeline table → cards, editor two-panel → stacked,
   40px+ touch targets, `@media (max-width:600px)`. Prioritize pipeline +
   quote-detail (the screens used on phones). Editor: functional, not fancy.
5. **Doc Assist** — wire Tier 1 first, then Tier 2. Optional, additive.
6. **Billing (LAST)** — Stripe Checkout + Customer Portal + trial logic.
   Hand-invoice the first design-partner shops; don't let billing block launch.

---

## 8. Pricing & GTM context (so product decisions align)

- Flat **per-shop** pricing (NOT per-user — per-user fees are the #1 competitor
  resentment). Target tiers: Solo $79 / Shop $149 (anchor) / Shop Plus $249.
  Launch at a lower FOUNDING price; raise as accuracy-loop/analytics ship.
- Charging: free design partners first (told upfront it becomes paid + founder
  discount) → 14-day card-required trial → reminder 3 days before charge →
  grandfather early shops. Never surprise-charge.
- Trust is the scarce resource in this market. Don't overpromise (esp. on AI).

---

## 9. Deliberately OUT of scope for MVP (do not build without a decision)

Accuracy loop / log-actuals, win-rate analytics, auto follow-ups, multi-user /
team roles, invoice/PO conversion, CAD/DXF geometry parsing, OCR/vision,
RFQ-as-entity, draft BOM builder, quote revisions, customer portal.

These are the post-launch roadmap. The accuracy loop (logging actual hours after
a job, comparing to estimate) is the eventual RETENTION MOAT and the one feature
that genuinely needs a mobile-first design — but it needs completed jobs to have
data, so it is post-launch by necessity.

If a task in flight requires OCR, a vision model, CAD geometry, a new RFQ entity,
or a BOM builder, it has left MVP scope — STOP and confirm before proceeding.

---

## 10. Working style for this codebase

- Keep the engine pure and the isolation structural. Those two properties are
  what make the product trustworthy; protect them in every change.
- Every service method returns `Result<T>` ({data, error}) — handle errors as
  values, don't throw across the data layer.
- Prove behavior with tests at the I/O boundary (the existing `*.test.mjs`
  pattern), then wire to live Supabase. Logic proven in tests; runtime confirmed
  against the real DB.
- When you touch rates, quotes, or isolation, re-run the relevant test and the
  mock `runApp.mjs` end-to-end before moving on.
