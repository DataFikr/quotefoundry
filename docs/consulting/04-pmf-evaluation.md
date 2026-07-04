# QuoteFoundry — Product-Market Fit Evaluation

*Consulting engagement deliverable 4 of 5 · July 2026*
*Cross-references: feature inventory (01), market research (03). Verdict at the end.*

---

## 1. Pain × feature matrix

Each top researched pain (03) mapped to the MVP feature that addresses it, or explicitly
marked as a gap. "Evidence" cites the research doc's sources.

| # | Researched pain | Evidence (03) | MVP answer | File | Fit |
|---|---|---|---|---|---|
| 1 | **Quoting is slow** — 5–6 day industry turnaround; fast responders win 28–35% vs 12–20% | §1.2 Mavlon/MMS | Editor with live pricing from stored rates; quote in ~10 min; clone for repeat jobs | `src/screens/EditorScreen.tsx`, `quoteService.clone()` | ✅ **Direct hit** — this is the product's reason to exist |
| 2 | **Quoting is inaccurate / loses margin** — manual costing underbids 8–15%; jobs lost money on gas alone | §1.3 FabOps, Everlast forum | Deterministic engine: material + labor + burn + consumables + outside → overhead → margin, sequentially; consumables are a first-class line item | `src/data-access-layer/lib/quoteEngine.ts` | ✅ **Direct hit** — the engine encodes exactly the rates-×-hours model owners describe doing by hand, including the consumables they forget |
| 3 | **Excel is the incumbent and it breaks** — "just use Excel" is the forum default; 54% of SMB plants on paper/spreadsheets | §1.1, §1.4 | Same mental model as their spreadsheet (rates × hours) but with a rate library, snapshotting, pipeline, branded PDF — the "spreadsheet, graduated" | Rates: `src/screens/RatesScreen.tsx` | ✅ **Strong** — low concept-switching cost is a feature; Doc Assist Tier 1 even ingests their existing spreadsheets (`spreadsheetParser.ts`) |
| 4 | **Unprofessional / slow customer-facing output** — quotes as emails or handwritten | §1.1 forum pattern | Branded PDF that shows scope + total and structurally hides margin/cost; tracked email send with open signal | `pdf-generation/`, `email-integration/` | ✅ **Strong** — margin-hiding is verified by test, not aspiration |
| 5 | **Incumbents are bloated, per-user-priced, opaque, expensive** — JobBOSS² "expensive + paid support" (2025–26 reviews); Paperless Parts quote-based only; Tempus $100/mo laser-only w/ 20-quote cap | §2.1 | Flat per-shop $79–149 planned, public pricing, no per-user fees, no modules to buy, live in a session | Pricing plan: CLAUDE.md §8 | ✅ **Strong on design** — ⚠️ but pricing page doesn't exist yet (01 §2.4) and the price promise is only credible once public |
| 6 | **Repeat jobs re-quoted from scratch** — "changing a quantity or material means redoing the whole quote" | §1.1 [CARRIED OVER via compass] | Clone re-snapshots at current rates; editing a draft recomputes live | `quoteService.ts` | ✅ **Direct hit** |
| 7 | **Estimate-vs-actual — "did we make money on that job?"** | §1.3; compass finding #2 (retention hook) | ❌ **Not in MVP** — deliberately post-launch (needs completed-job data to exist) | — | ⚠️ **Gap, acceptable** — research says this drives *retention*, not first purchase. Doesn't block the first $1k. Must be on the public roadmap to signal direction |
| 8 | **Scheduling / delivery-date confidence** | §1.1 compass carried-over | ❌ Out of scope | — | ⚠️ **Gap, acceptable** — compass evidence says pure schedulers underdeliver without job data; adjacent, not core |
| 9 | **Compliance (welder continuity, MTRs)** | compass finding #4 | ❌ Out of scope (Stage-3 roadmap) | — | ⚠️ **Gap, deliberate** — the researched wedge order is quoting first, compliance later |
| 10 | **RFQ arrives as a PDF/spreadsheet that must be re-keyed** | §1.1 Xometry thread; FABTECH AI-quoting trend | Doc Assist Tier 1 (spreadsheet, deterministic, zero tokens) live; Tier 2 (text PDF) stubbed; every file stored regardless | `src/doc-assist/` | ✅ **Partial** — Tier 1 covers the spreadsheet case; PDF pre-fill is "coming soon," which is honest and sufficient for launch |

**Coverage: the top 6 pains — the purchase-driving ones — are all directly addressed by
shipped, tested code. The unaddressed pains (7–9) are retention/expansion features that the
research itself sequences post-launch.**

## 2. Where the deliberate scope-cuts align with the evidence

The #1 documented abandonment driver is bloat plus data-entry burden (03 §2.1; compass
finding #2: "zero interest in a full-time employee just for data entry to keep the ERP
happy"). QuoteFoundry's exclusion list — no MRP, no inventory, no BOM automation, no
multi-user seats at launch — is not missing product; it *is* the product thesis. A shop
owner can hold the entire tool in their head after one session. Nothing in the MVP requires
ongoing data entry beyond what quoting itself requires.

The same is true of the AI posture. The FABTECH 2025 field is converging on "AI quotes your
parts" (03 §2.3) while the buyer community is trust-scarce and burned. QuoteFoundry's
"your rates, deterministic math — AI only reads your documents, never prices your work"
is a *contrarian differentiator that gets stronger as competitors get louder about AI.*

## 3. What could still break fit

1. **Distribution, not product.** The tool is unreachable (01 §2.2) and invisible (01 §2.4).
   Every fit conclusion above is moot until a shop can find it and sign up. This is the
   binding risk, and it is a go-to-market problem — deliverable 05's job.
2. **The first-session test.** The compass benchmark stands: if a trial shop can't send its
   first real quote in one sitting, the "faster than your spreadsheet" claim fails at the
   moment of maximum attention. Onboarding (rates setup) is the friction point to watch —
   rate entry is the one "data-entry tax" the product does levy, once.
3. **Solo-founder trust discount.** Shops burned for $4K–$37K will ask who's behind this.
   Mitigations are cheap but mandatory: real founder page, public pricing, no card for
   trial, data export, honest roadmap.
4. **Segment mismatch risk (minor).** The engine's model (weight-based material, hourly
   labor, burn time) fits structural/weld/sheet fab. Pure CNC machine shops quoting from
   3D geometry will find it thin — that's fine, but marketing must aim at fab/weld shops,
   not "machine shops" broadly, or trials will churn for the wrong reason.

## 4. PMF verdict

**Fit assessment: STRONG on product-problem fit, UNPROVEN on distribution — proceed to
market test without product changes.**

- The problem is verified as real, current (threads through 2024–25), and expensive to the
  buyer (8–15% underbidding; 2–3× win-rate spread on quote speed).
- The MVP's shipped feature set covers every purchase-driving pain in the research, and its
  deliberate gaps match the research's own "don't build early" list.
- The pricing slot (flat, public, <$150/mo, general fab) is verified empty as of July 2026.
- Nothing found in this research justifies adding product scope before market testing. The
  correct next investment is 100% distribution: deploy, publish pricing, build the
  SEO/AEO surface, and put the product in front of the communities already asking for it.

**Recommendation:** hold the wedge positioning exactly as written in CLAUDE.md §1
("quote faster, win more jobs, stop losing margin" — never "AI quotes") and spend the full
90-day window on the market-testing plan in deliverable 05. Re-evaluate product scope only
against a signal defined in advance: if ≥3 design-partner shops independently refuse to pay
for quoting alone and name the same missing feature, that feature is the real wedge —
otherwise, ship nothing new until $1k is collected.
