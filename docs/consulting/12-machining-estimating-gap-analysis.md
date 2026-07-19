# 12 — Machining-Estimating Gap Analysis (SendCutSend + Excel-corpus research)

> **Status:** research done 2026-07-17; the three P0 gaps SHIPPED the same day
> (engine + editor + rates screen; see §4). Founder action: run
> `server/migrations/2026-07-17_setup_tooling.sql` before deploying.
> Labels: **[EVIDENCE]** = source checked this session · **[INFERENCE]** = our synthesis.

## 1. Why this research

The outreach list tiers "machin\*" shops as Tier A (08-outreach), but QuoteFoundry's
engine was shaped around fab/weld jobs priced per-lot. Machinists evaluate quoting
tools against the Excel sheets they built themselves — if the tool can't express
setup amortization, it reads as a toy to exactly the audience we're emailing.

## 2. SendCutSend — material catalog inspiration [EVIDENCE: sendcutsend.com/materials, 2026-07-17]

- **175+ materials in 5 categories** (Metal / Composite / Plastic / Rubber-gasket /
  Wood), filterable by category, cutting method, and service.
- Per material: available thicknesses (in + mm), finish options, compatible
  processes (laser/waterjet/CNC-routed), post-processing services.
- **Takeaway for QF:** organization sells confidence. A categorized library with
  credible defaults beats a 4-row flat list — even before any pricing changes.
  Their thickness-level detail is geometry-driven (instant-quote from CAD) and
  stays OUT of QF scope (CLAUDE.md §9: no CAD/geometry).

## 3. The Excel-estimating corpus — what an accurate machining quote needs

Sources [EVIDENCE]: Practical Machinist — ["Needing an Excel quote workup template"](https://www.practicalmachinist.com/forum/threads/needing-an-excel-quote-workup-template.268613/),
["software for estimating"](https://www.practicalmachinist.com/forum/threads/software-for-estimating.429738/),
["Built a free quoting calculator…"](https://www.practicalmachinist.com/forum/threads/built-a-free-quoting-calculator-to-get-off-my-spreadsheet-would-love-you-guys-to-tear-it-apart.449764/);
cycle-time guides (americanmicroinc.com, machiningcalc.com, cncoptimization.com).
(The Reddit Answers page the founder supplied aggregates the same corpus; Reddit
blocks direct fetch — consistent with doc 03's finding.)

The converged formula:

```
Part Cost = (Setup ÷ Qty) + (Cycle time × Machine rate) + Material + Tooling
            + Secondary ops + Overhead   →  then margin
```

Feature list the corpus repeats, vs QuoteFoundry:

| # | Feature (from the corpus) | QF before 2026-07-17 | Now |
|---|---|---|---|
| 1 | Setup + programming time, **amortized across the lot** | ❌ hours were flat per-job | ✅ `hrs_setup` × `rate_setup`, one-time |
| 2 | **Quantity price-break table** (spread setup over 1/10/25/50/100) | ❌ | ✅ `priceBreaks()` live in the editor cost panel (estimator-only) |
| 3 | Perishable **tooling** cost per job | ❌ (consumables were weld-hour-tied) | ✅ `tooling_cost` line |
| 4 | Cycle time × machine rate | ✅ burn_minutes × rate_burn | unchanged |
| 5 | Material cost per part | ✅ weight × $/lb × scrap, multi-line | unchanged + categorized catalog |
| 6 | Secondary / outside ops | ✅ outside_services | unchanged |
| 7 | Overhead → margin | ✅ sequential (stronger than most sheets) | unchanged |
| 8 | Multi-tab library structure (summary / materials / operations) | partial | Rates screen now groups materials by category |
| 9 | Load/unload & handling per part; efficiency factor | ❌ | **deferred** — [INFERENCE] low demand at 5–50-person scale; revisit on design-partner feedback |
| 10 | Feeds/speeds-derived cycle time | ❌ | **out of scope** — that's CAM territory (§9), estimator judgment stays |

## 4. What shipped (2026-07-17)

- **Engine** (`quoteEngine.ts`): `line_setup` (hrs_setup × rate_setup, falling
  back to rate_cutting for pre-upgrade snapshots), `line_tooling`, and pure
  `priceBreaks()` — the entered-qty row provably equals `computeQuote`.
  Canonical $1,913.82 untouched (all new fields default 0). 7 new engine tests.
- **Editor**: Setup & programming (hr) + Tooling ($) inputs in the Machine card;
  live **price-break strip** (×1/×10/×25/×50/×100 per-unit, current qty
  highlighted) in the dark cost panel — internal-only, labeled as such.
- **Rates screen**: Setup & programming $/hr in the Labor tab; **Add from
  catalog** button merging a 15-material starter catalog (Carbon steel /
  Stainless / Aluminum / Copper alloys / Other — reference $/lb the shop edits);
  library rows grouped by category with a category picker.
- **Customer surfaces** (§4.4): setup + tooling fold into the existing
  "Fabrication labor & machine time" line on the PDF, preview, and public quote
  page — never labeled, never itemized. Existing margin-leak gates still green.
- **DB**: `2026-07-17_setup_tooling.sql` (quotes.hrs_setup, quotes.tooling_cost,
  shop_rates.rate_setup default 75), mirrored in the main schema.

## 5. Outreach angle this unlocks [INFERENCE]

Step-1 email and demo can now truthfully say: *"enter setup hours once and see
your price at 1, 10, 25, 50, 100 pieces — the setup amortization your Excel
sheet does, without the Excel sheet."* That sentence is aimed squarely at the
Tier-A "machin\*" segment and is the direct answer to the corpus's #1 feature.

## 6. Deferred (decide post-launch, from real design-partner files)

- Per-thickness sheet pricing and density-based weight calc (SendCutSend-style) —
  needs real quote data to justify.
- Load/unload & handling allowances; efficiency factor.
- Anything requiring geometry/CAD/feeds-speeds — permanently out (CLAUDE.md §9).
