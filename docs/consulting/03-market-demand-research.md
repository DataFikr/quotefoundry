# QuoteFoundry — Market Demand Research (Live Refresh, July 2026)

*Consulting engagement deliverable 3 of 5 · July 2026*
*Method: ~18 live web searches and page fetches conducted this session. Each claim is tagged **[VERIFIED]** (source checked this session, URL + access date given) or **[CARRIED OVER]** (from the prior research in `docs/compass_artifact_markdown.md`, not re-verified). All URLs accessed 2026-07-01.*

**Research limitation, stated upfront:** Reddit threads remain poorly indexed by web
search — multiple query formulations returned no direct thread links (the prior compass
research hit the same wall). Owner-voice evidence below therefore leans on Practical
Machinist, PlasmaSpider, WeldingWeb-adjacent forums, and trade press. Reddit demand signals
should be gathered by browsing r/Machinists, r/Welding, and r/smallbusiness directly during
the community phase of go-to-market — which doubles as the participation motion anyway.

---

## 1. The pain: quoting is slow, manual, and loses money

### 1.1 Persistent, current demand for exactly this tool [VERIFIED]

Practical Machinist — the largest owner forum in this niche — has a continuous stream of
threads asking for job-shop quoting software, spanning a decade and continuing into 2024–25:

- ["What should a basic job shop quoting software have?"](https://www.practicalmachinist.com/forum/threads/what-should-a-basic-job-shop-quoting-software-have.274648/) — owners specifying their wishlist
- ["Software for estimating"](https://www.practicalmachinist.com/forum/threads/software-for-estimating.429738/) — July 2024 thread, still asking the same question
- ["Quoting / Estimation Software?"](https://www.practicalmachinist.com/forum/threads/quoting-estimation-software.375039/)
- ["Quoting software recommendations"](https://www.practicalmachinist.com/forum/threads/quoting-software-recommendations.385613/) — in the fabrication (laser/plasma/welding) subforum
- ["Job Shop Quoting/Charging"](https://www.practicalmachinist.com/forum/threads/job-shop-quoting-charging.391807/)
- ["Using Xometry as a 'free' quoting software?"](https://www.practicalmachinist.com/forum/threads/using-xometry-as-a-free-quoting-software.410582/) — owners resorting to a marketplace's instant-quote engine because nothing affordable exists

The recurring pattern in these threads (per search-level summaries; Practical Machinist
blocks robotic page fetches): small shops are told to "just use Excel," build fragile
spreadsheets with drop-downs for work-center rates, and outgrow them. The demand has not
been met between 2013 and 2025 — the question keeps being asked.

### 1.2 Speed is revenue [VERIFIED]

- Typical quote turnaround in job shops is **5–6 days**; a complete RFQ *can* be quoted in 24 hours at a responsive shop ([Mavlon](https://mavlon.co/post/reduce-aerospace-quote-turnaround-time)).
- Shops responding to RFQs in **1–2 days win 28–35%** of quotes; shops taking **5+ days win 12–20%** ([Mavlon](https://mavlon.co/post/reduce-aerospace-quote-turnaround-time); see also [Modern Machine Shop, "When It Comes to RFQ Response, Time Is Money"](https://www.mmsonline.com/articles/when-it-comes-to-rfq-response-time-is-money)).
- **35–50% of deals go to the vendor who responds first** ([Manufacturing Lead Generation](https://manufacturingleadgeneration.com/quote-turnaround-time-manufacturers/)). The compass doc's Lead Connect 78% figure is [CARRIED OVER]; the 35–50% figure is the more conservative, independently repeated version.

### 1.3 Accuracy is margin [VERIFIED, vendor-sourced — treat as directional]

- Fab shops "lose money on 20–30% of jobs because they can't track true costs"; manual costing typically **underbids by 8–15%**, i.e. $40K–$75K/year of lost margin for a $500K shop ([FabOps blog](https://fabops.app/blog/hidden-cost-manual-job-costing-fabrication.html) — a vendor blog, so directional not gospel, but consistent with owner anecdotes).
- Owner-voice examples of the failure mode: a job quoted at $75 that cost $85 in shielding gas alone ([Everlast welding forum](https://www.everlastgenerators.com/forums/showthread.php/2927-How-you-price-out-a-welding-job)); fabricators pricing by feel with material ×1.35 plus $50–100/hr tiered labor ([PlasmaSpider](https://plasmaspider.com/viewtopic.php?t=33417)) — i.e., exactly the rates-times-hours model QuoteFoundry encodes, currently done by hand.

### 1.4 The market still runs on paper [VERIFIED]

- **54% of small/medium plants use pen, paper, or spreadsheets as their MES**; only **8% of plants** run a commercial MES; the market is $5.5B (2024) → forecast $8.7B (2031), with 300+ vendors and no dominant player ([IoT Analytics MES Market Report 2025–2031](https://iot-analytics.com/mes-vendors-replace-pen-paper-spreadsheets/)). This directly re-verifies the compass doc's core market claim.
- Adjacent corroboration: ~30% of US general contractors still estimate solely in Excel ([HCSS](https://www.hcss.com/blog/excel-vs-estimating-software/) — construction, not fab, but same SMB estimating behavior).

---

## 2. The competitors: a price and trust umbrella, refreshed

### 2.1 Current pricing landscape [VERIFIED]

| Competitor | Current pricing (July 2026) | Notes |
|---|---|---|
| **Paperless Parts** | No public pricing; quote-based ([pricing page](https://www.paperlessparts.com/pricing/), [Capterra](https://www.capterra.com/p/179259/paperlessPARTS/)) | Targets 5–500-person shops; heavily AI-flavored (AI BOM Builder launched at FABTECH 2025). Opaque pricing is itself a documented small-shop turnoff. |
| **Tempus Tools ToolBox** | **$100/mo** Starter (20 quotes/mo cap), **$300/mo** Regular, **$500/mo** Advanced; 25% annual discount; 14-day trial, cancel anytime ([pricing page](https://tempustools.com/pricing/)) | The nearest transparent comparable — but **laser-cutting-specific** (geometry-driven). Its Starter tier caps quotes at 20/month. |
| **JobBOSS²** | Quote-based; 2025–26 reviews repeat: "expensive," costly add-on modules, slow paid support ([SoftwareConnect](https://softwareconnect.com/reviews/jobboss-erp/), [Capterra reviews](https://www.capterra.com/p/219273/JobBOSS/reviews/), [G2](https://www.g2.com/products/jobboss2/reviews)) | Balance: many reviewers also praise it once implemented — the pain is cost + implementation, not existence of features. |
| **SecturaFAB** | Quote-based; "go live in weeks, not months" ([site](https://get.secturafab.com/)) | Aims at metal service centers + fab; positions on speed-to-live. |
| MRPeasy / Katana / ProShop / Fulcrum / MIE Trak | [CARRIED OVER] from compass doc ($49–149/user/mo; $179+/mo; ~$45–50K; etc.) | Not re-verified this session. |

**The open slot is confirmed:** nothing transparent exists below Tempus's $100/mo — and
Tempus is laser-only with a quote cap. A **flat $79–149/mo, per-shop, general fab/weld
quoting tool with public pricing** has no direct occupant.

### 2.2 Competitive keyword demand is proven by competitors themselves [VERIFIED]

"Alternative" queries are commercially active: ProShop runs a dedicated
["Better JobBOSS Alternative" landing page](https://get.proshoperp.com/better-jobboss-alternative);
Capterra/Software Advice/Slashdot/FitGap all maintain
["Paperless Parts alternatives"](https://www.capterra.com/p/179259/paperlessPARTS/alternatives/) and
["JobBOSS² alternatives"](https://us.fitgap.com/products/012119/jobboss/alternatives) pages.
Where incumbents spend on a keyword, the keyword converts — and these directory pages are
exactly what LLMs cite when asked "alternatives to X."

### 2.3 Incumbents are all leaning AI [VERIFIED]

At FABTECH 2025 the software story was "information automation": Paperless Parts demoed its
AI BOM Builder and AI print-quoting; CADDi pushed AI/OCR data aggregation
([The Fabricator](https://www.thefabricator.com/thefabricator/article/shopmanagement/the-age-of-information-automation-at-fabtech-2025),
[MFG Insiders recap](https://mfginsiders.com/recap-of-fabtech-2025-top-ten-trends-insights/),
[Canadian Metalworking product preview](https://www.canadianmetalworking.com/canadianfabricatingandwelding/product/automationsoftware/fabtech-2025-product-preview-software-helps-streamline-quoting)).
In a trust-scarce market, everyone shouting "AI quotes" creates a differentiation opening for
**"your rates, deterministic math, no guesswork"** — QuoteFoundry's existing positioning.

### 2.4 Trade-fair signal: the market target moved down-market [VERIFIED]

FABTECH 2025 (Chicago) introduced a dedicated **Job Shop Pavilion** among its seven
technology pavilions ([FABTECH](https://www.fabtechexpo.com/news/fabtech-2025-to-feature-technology-advances-for-modernizing-manufacturing)) —
organizers see enough small-job-shop buying intent to give it its own floor. Quoting software
was a named product-preview category.

---

## 3. Search-demand language (feeds the SEO/AEO plan in deliverable 05)

Query language observed in live results and forum titles this session — this is the exact
vocabulary content should target:

**High commercial intent (comparison/alternative):**
- "JobBOSS alternative" / "JobBOSS² alternatives" (incumbent-funded landing pages exist)
- "Paperless Parts alternative(s)" (multiple directory pages exist)
- "best manufacturing quoting and estimating software" (SoftwareConnect runs a [2026 roundup](https://softwareconnect.com/roundups/best-manufacturing-estimating-quoting-software/))
- "machine shop quoting software" (competitors bid on it — [Machine Research targets the term + "reddit"](https://www.machineresearch.com/reddit), i.e. they're chasing Reddit-intent searches)

**Problem-aware / how-to (top of funnel, LLM-citable):**
- "how to price a welding job" / "how do you price out a welding job" (forum threads with this exact title exist)
- "how to quote fabrication work" / "job shop quoting" 
- "welding quote template" / "fabrication estimate spreadsheet" (the Excel-replacement entry point)
- "quote turnaround time" / "RFQ response time" (trade-press vocabulary)

**Niche long-tail (low volume, near-zero competition):**
- "quoting software for small fab shop" / "quoting software for 1 or 2 man shop" (verbatim forum phrasing)
- "estimating software without per-user fees"

## 4. AEO/GEO/LLM visibility findings [VERIFIED]

Current (2026) practice for being cited by ChatGPT/Perplexity/Claude answers
([LLMrefs AEO guide](https://llmrefs.com/answer-engine-optimization),
[WitsCode LLM SEO guide](https://witscode.com/guides/ai-llm-seo),
[PoweredBySearch AEO best practices](https://www.poweredbysearch.com/blog/aeo-llm-seo-best-practices/)):

1. **Allow AI crawlers in robots.txt**: `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User` — blocked crawlers = invisible to answer engines.
2. **llms.txt**: curated Markdown file at site root telling models what the product is and which pages matter ([nivonto glossary](https://nivonto.tech/glossary/what-is-llms-txt)).
3. **Direct-answer page structure**: question-form H2s, 40–60-word direct answers, comparison tables, FAQ schema — content formatted to be *extracted*, not just ranked.
4. **Transparent pricing is an AEO asset**: models preferentially cite pages that answer "how much does X cost" concretely — quote-based incumbents structurally can't be cited for price.
5. **Directory presence feeds LLM training/retrieval**: Capterra/G2/Software Advice listings (free tiers exist) are heavily drawn on for "best X software" answers.
6. AI-referred visitors reportedly convert at higher rates than generic organic, since the model pre-qualifies the click ([WitsCode](https://witscode.com/guides/ai-llm-seo)) — vendor-adjacent claim, directional.

**Implication:** for a 90-day window on a cold domain, AEO + directories + community are the
realistic visibility channels; classical Google rankings are the 6–12-month compounding
asset. This shapes deliverable 05.

---

## 5. What changed vs. the compass research (delta summary)

| Compass claim | This session's finding |
|---|---|
| Quoting is the #1 convertible pain | **Re-confirmed** — PM threads through July 2024, FABTECH 2025 product category, turnaround stats |
| 54% pen/paper/spreadsheet (IoT Analytics) | **Re-verified at source** |
| Price umbrella $10–15K balk / per-user resentment | **Sharpened**: nearest transparent competitor is Tempus at $100/mo laser-only with 20-quote cap; sub-$100 flat general-fab slot is empty |
| Reddit under-indexed | **Still true in 2026** — plan community browsing, not search scraping |
| Incumbent bloat/cost complaints | **Refreshed**: JobBOSS² 2025–26 reviews repeat "expensive + paid support" pattern |
| (not covered) | **New**: incumbents pivoting hard to AI-quoting creates positioning contrast for deterministic engine |
| (not covered) | **New**: AEO/llms.txt/directory playbook — the realistic 90-day visibility path |

## 6. Verdict on demand

Demand is real, current, and specifically shaped like QuoteFoundry: small fab/weld shops
quoting by hand in Excel, losing jobs on speed and margin on accuracy, priced out of or
burned by incumbents, and still asking forums for "basic job shop quoting software" as of
2024–25. The unoccupied slot — transparent flat-fee, per-shop, general fab quoting under
$150/mo — matches the planned pricing exactly. The binding constraint is not demand; it is
**discoverability and trust within the 90-day window**, addressed in deliverables 04–05.
