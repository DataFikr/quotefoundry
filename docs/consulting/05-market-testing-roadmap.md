# QuoteFoundry — 90-Day Market-Testing Roadmap to First $1,000

*Consulting engagement deliverable 5 of 5 · July 2026*
*Cross-references: launch blockers (01 §4), SWOT strategic read (02), demand evidence and keyword language (03), PMF verdict (04). Goal: **$1,000 cumulative revenue within 3 months**, inbound-first (SEO/GEO/LLM/AEO), solo founder.*

---

## 0. The strategy in one paragraph

The central tension (02 T3): a cold domain will not rank on Google inside 90 days, but the
revenue clock is 90 days. So this plan runs **two tracks at once**: (a) build the inbound
surface immediately — it's cheap, it compounds, and its AEO components (directories,
answer-formatted pages, llms.txt) *can* produce citations inside the window; (b) source the
actual first $1,000 from trust-dense channels where a solo founder wins today — design
partners, the exact forums already asking for this tool (03 §1.1), and light personal
outbound from the 1,026-shop leadfinder list. Product scope is frozen per the PMF verdict
(04 §4): every hour goes to distribution.

## 1. Revenue math (checked arithmetic)

Pricing frame per CLAUDE.md §8: target tiers Solo $79 / Shop $149 / Shop Plus $249; launch
at a lower **founding price**, first shops hand-invoiced (no Stripe needed — correct per
build order).

Recommended founding offer: **$49/mo founding-forever (vs $79 list)** and a
**$490 founding annual** (10 months' price, prepaid).

Paths to $1,000 inside the window (payments can only realistically start ~week 6, so
monthly plans contribute at most ~2 months each):

| Path | Math | Total | Feasibility |
|---|---|---|---|
| A. Annual-anchored | 2 × $490 founding-annual + 1 monthly month | $980 + $49 = **$1,029** | **Recommended** — 2–3 conviction customers, not 10 |
| B. Monthly volume | 9 shops × $49 × ~2.5 avg months | **$1,102** | Needs ~9 conversions by week 8 — aggressive |
| C. Mixed | 1 × $490 annual + 6 shops × $49 × 2 mo | $490 + $588 = **$1,078** | Realistic blend |
| D. List-price mixed | 3 shops × $149 × 2 mo + 1 × $79 × 2 mo | $894 + $158 = **$1,052** | If founding discount proves unnecessary |

**Working target: 10–12 design partners recruited → 4–6 convert to paid by week 8–9, with
the annual option offered first.** The annual founding deal is the single highest-leverage
sales motion in this plan: it turns the $1k goal into "convince two shops."

## 2. Week-by-week plan

### Weeks 1–2 — Launch blockers (dev; traces to 01 §4)

| Task | Traces to |
|---|---|
| **Day 1: buy domain + start email DNS** (SPF/DKIM/DMARC on `send.` subdomain) — propagation is calendar time | 01 §2.2 email row |
| Provision Supabase project, load `server/quotefoundry_schema.sql`, set `VITE_SUPABASE_URL`/`ANON_KEY` | 01 §2.2 |
| Deploy frontend to Vercel/Netlify; wire 3 server endpoints (PDF `/api/generate-pdf`, email send, tracking pixel) as functions | 01 §2.2 |
| Un-stub `e2e/stage8.spec.ts`; run adversarial RLS test (shop A → shop B's quote = empty) on the real DB | 01 §3 |
| Full production round-trip: sign-up → set rates → quote → PDF → email to self | CLAUDE.md §7.1 |
| Add error tracking (Sentry free tier) + privacy-friendly analytics (Plausible/GA4) | 01 §2.2 monitoring row |

**Gate: a stranger can sign up and send a real quote from production. Nothing in weeks 3–12
matters until this is true.**

### Weeks 2–3 — Inbound surface (dev + content; traces to 01 §2.4, 03 §3–4)

**Technical SEO/AEO (one-time, ~2 days):**
- Title/meta/OG tags on all public pages; JSON-LD `SoftwareApplication` schema **with price** (public pricing is an AEO weapon incumbents can't copy — 03 §4.4)
- `robots.txt` **explicitly allowing** `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User` (03 §4.1)
- `sitemap.xml`, `llms.txt` (product summary + key page index, 03 §4.2)
- **Public pricing page** — flat per-shop tiers, founding price, "no per-user fees" stated verbatim (the researched resentment, 03 §2.1); FAQ section with FAQ schema

**Cornerstone content (5 pages, targeting 03 §3's verified query language; each formatted for answer-extraction: question H2s, 40–60-word direct answers, comparison tables):**
1. "How to price a welding or fabrication job" (rates × hours + overhead + margin — teach the engine's own model; the verbatim forum question)
2. "Free fabrication quote template (spreadsheet)" — lead magnet; meets Excel users where they are, and the template's headers match Doc Assist Tier 1's synonym list so their filled template imports perfectly
3. "Paperless Parts alternatives for small fab shops (2026)" — honest comparison incl. price transparency table
4. "JobBOSS² alternatives for shops under 50 people" — proven-commercial keyword (ProShop pays for it, 03 §2.2)
5. "What does fabrication quoting software cost in 2026?" — the price-comparison page only a transparent vendor can write

**Directories (free tiers, same week):** Capterra, G2, Software Advice/GetApp listing — these feed LLM "best X" answers directly (03 §4.5).

### Weeks 3–5 — Design-partner recruitment (sales)

- **Target: 10–12 active design partners.** Offer per CLAUDE.md §8: free during partnership, told upfront it becomes paid, founding price locked forever.
- **Sources:** (a) the leadfinder list — personal, one-at-a-time emails/calls to Houston shops (1,026 candidates; even a 1% meeting rate = 10 conversations); (b) forum relationships (below); (c) any personal network.
- **The onboarding promise is the demo:** "bring one RFQ you quoted last week; leave with the same quote done in 10 minutes on your rates." This directly tests the activation benchmark.
- **Instrument activation:** track time-to-first-real-quote per shop. Benchmark (compass/04 §3.2): first quote sent in one session, or the product isn't fast enough.

### Weeks 3–12 — Community presence (continuous, ~3 hrs/week)

- Create real-name accounts on Practical Machinist (fabrication + shop-management subforums), r/Machinists, r/Welding, r/smallbusiness, WeldingWeb. **Participate genuinely for 2–3 weeks before ever mentioning the product** — answer pricing/quoting questions with substance (the "how to price a job" content doubles as answer material).
- Reddit is under-indexed by search (03 preamble) — browsing/participating *is* the research and the marketing simultaneously. Log recurring pain phrasings; feed them back into content and the Doc Assist synonym list.
- When relevant threads ask for quoting software (they recur — 03 §1.1), disclose ("I built this"), link, and offer founding terms. Forum-honest beats forum-stealthy; these communities reward disclosure and punish astroturf.

### Weeks 6–9 — Conversion

- Week 6: partners with ≥5 real quotes sent get the conversion conversation — annual founding ($490) offered first, monthly founding ($49) as fallback. Hand-invoice (Wave/Stripe invoice link — no Checkout build, per build order §7.6).
- Publish 1–2 partner outcomes as case snippets on the site ("Shop X cut quote time from 2 evenings to 20 minutes") — with permission; these become the trust proof for cold visitors and LLM-citable specifics.
- Ship *polish only* from partner feedback (onboarding friction, rate-setup UX) — no new modules (04 §4 freeze).

### Weeks 9–12 — Push to $1k + compounding

- Second recruitment wave using case proof (warmer conversion).
- 2–3 more content pages from logged community language (long-tail: "quoting software for 2-man fab shop").
- Check AEO surface: ask ChatGPT/Perplexity/Claude "affordable quoting software for a small fab shop" — verify whether QuoteFoundry is cited; adjust llms.txt/content where absent.
- If short of $1k at week 10: the leadfinder outbound motion scales (it's sitting in the repo, `scripts/leadfinder/`), and the annual offer can be sweetened (e.g., $449) without violating the never-surprise-charge principle.

## 3. Decision gates (pre-committed, per 04 §4)

| Signal by | Threshold | Action if missed |
|---|---|---|
| Week 5 | ≥8 design partners active | Pivot recruitment channel (double down on outbound list; try one paid community sponsorship, e.g., forum vendor listing) |
| Week 6 | Activation: median first real quote ≤1 session | Stop selling, fix onboarding — this is the product's core claim |
| Week 9 | ≥3 paying shops | Run the pre-committed diagnosis: if ≥3 partners independently name the same missing feature as the blocker, that feature is the real wedge; otherwise it's positioning/price — adjust those, not scope |
| Week 12 | $1,000 collected | If ≥$500 + strong activation: extend 4 weeks, same plan. If <$500 with good activation but no conversion: pricing/segment problem. If activation itself failed: product problem — revisit PMF |

## 4. What is explicitly NOT in this plan

- Stripe Checkout/billing automation (hand-invoice until ~10 paying shops — build order §7.6)
- Paid ads (trust-scarce market + tiny budget; revisit post-$1k)
- New product modules (accuracy loop, compliance, scheduling — post-launch roadmap, 04 matrix rows 7–9)
- OCR/vision/AI pricing of any kind (CLAUDE.md bright lines)
- Broad "machine shop" positioning — aim at fab/weld shops specifically (04 §3.4)

## 5. Effort budget (solo founder, ~12 weeks)

| Track | Weeks 1–2 | Weeks 3–5 | Weeks 6–12 |
|---|---|---|---|
| Dev (deploy, endpoints, SEO infra) | 80% | 10% | 10% (polish only) |
| Content (5 cornerstones → +2–3) | 10% | 30% | 20% |
| Sales/partners/community | 10% | 60% | 70% |

The shape of the bet: **two weeks of plumbing, then the founder becomes a salesperson with
a very good demo.** The SEO/AEO assets built in weeks 2–3 are not expected to pay inside the
window — they are the compounding channel that makes month 4–12 growth inbound, which is the
strategy the user chose. The first $1,000 comes from humans who were shown the product by
the human who built it.
