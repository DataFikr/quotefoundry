# QuoteFoundry — Front-End Design Review & Design SWOT

*Consulting engagement deliverable 6 · July 2026*
*Method: full design-system code audit (every claim cites a file path), computed WCAG contrast math (not eyeballed), and live-researched reference designs (URLs verified this session). Companion to deliverables 01–05; recommendations respect the product-scope freeze from 04 and fit the "polish only" budget in 05.*

---

## 1. Executive summary & scorecard

QuoteFoundry's UI is **visually cohesive, token-disciplined, and unusually well-guarded by
tests for a pre-launch solo project — but it is desktop-first (not mobile-first),
essentially inaccessible to keyboard and screen-reader users, and missing the interaction
conventions (URL routing, confirmations, toasts) that CRM users treat as table stakes.**
Nothing here requires a redesign; it requires a focused polish pass.

| Area | Grade | One-line justification |
|---|---|---|
| Visual language | **A−** | Cohesive card/pill/dark-panel system from a single mockup-extracted token file (`src/design/tokens.ts`) |
| Token discipline | **A** | One source of truth, mirrored CSS vars, *enforced by Playwright design gates* (`e2e/smoke.spec.ts`, `e2e/stage4.spec.ts`) — rare and genuinely excellent |
| Component architecture | **C** | No shared Button/Input/Modal primitives; each screen hand-rolls controls; only `card`/`statusPill()`/`money()` are shared (`src/app/ui.ts`) — drift is a matter of time |
| Responsive / mobile-first | **C+** | Every screen has a mobile variant, but via a single 600px JS conditional (`src/app/useIsMobile.ts`); no tablet tier; editor's live price falls below the fold on phones |
| Interaction feedback | **C−** | Spinner + inline errors exist; no toasts, no undo, no confirmation on outcome actions, near-zero motion (2 keyframes in `src/styles/global.css`) |
| Accessibility | **F** | Zero ARIA in the codebase; `input:focus { outline: none }` (`src/styles/global.css:28`); one `htmlFor` in the entire app; multiple token colors fail WCAG AA (computed, §3) |
| Navigation / IA | **C+** | Clear flow, but state-based routing in `src/app/AppShell.tsx` — refresh loses your place, no deep links, browser Back is broken; icon rail has no labels |
| Performance weight | **B−** | No UI framework (great), but two full icon-font CDNs + 7 font weights in `index.html`; Tabler icons barely used |

---

## 2. Design-system audit

### What is genuinely good (keep, and say so to any future designer)

1. **Token discipline enforced by tests.** `tokens.ts` is extracted verbatim from the design
   mockup, and Playwright asserts *computed styles* against it — button background, pill
   colors, panel gradient, font family — plus screenshot diffs at 2% tolerance. Most funded
   startups don't have this. It means any polish pass below can be made safely.
2. **A real visual identity.** The light lavender canvas (#F4F4FB), white 20–22px-radius
   cards with soft long-throw shadows, periwinkle accent, and the dark gradient cost panel
   with green accent text (`panelAccentText` on `panelTo` = 11.0:1 contrast — excellent)
   read as contemporary SaaS, not bootstrap-admin-template.
3. **Consistent control metrics.** 44–48px controls and a 40px touch minimum
   (`control` in tokens.ts) — the touch-target discipline most desktop-first apps lack.
4. **Domain-correct emphasis.** The most important number in the product — quoted price —
   gets the strongest visual treatment in the app (Lato 900 on the dark panel). The design
   understands its own hierarchy.

### What is weak

1. **No component layer.** Inputs, buttons, selects, and modals are re-declared as inline
   style objects per screen (e.g., `inputBox` inside `EditorScreen.tsx`). With 8 screens
   this is survivable; every new screen increases divergence risk, and there is no single
   place to add a focus ring or an aria attribute once.
2. **Focus is deliberately destroyed.** `input:focus, textarea:focus { outline: none; }`
   (`global.css:28`) with nothing substituted. Keyboard users cannot see where they are.
   This is one CSS rule away from being materially better.
3. **Icon fonts, 2013-style.** Line Awesome *and* Tabler webfont CSS both load from CDNs in
   `index.html`; icons are `<i class>` glyphs — invisible to screen readers, flash-of-blank
   on slow networks, and the modern norm is tree-shaken SVG (Lucide/Tabler-react).
4. **Two brands in one app.** `LandingScreen.tsx` defines its own palette (`DK #042C53`,
   `BLUE #185FA5`, `GREEN #0F6E56`) disconnected from the app's periwinkle/lavender system.
   A trial user crosses a visible brand seam at the exact moment of sign-up — the moment
   deliverable 04 flagged as the trust-critical first session.
5. **Design gates cover color/font, not geometry or a11y.** Spacing, radii, shadows, focus
   visibility, and contrast are unasserted — the categories where drift will actually happen.

---

## 3. The three verdicts: modern, lightweight, mobile-first?

### Modern? — **Mostly yes on look, no on mechanics.**
The aesthetic (soft depth, big radii, pill statuses, dark data panel) sits comfortably next
to 2025-era SaaS. What dates it: icon fonts instead of SVG, near-total absence of motion
(state changes snap; modern UIs use 120–200ms eases), no dark mode, no hover affordances on
interactive rows beyond `cursor: pointer`, and the landing/app palette split.

### Lightweight? — **Yes in JS, no in network.**
No React UI framework and no CSS framework keeps the bundle honest. But `index.html` ships
Lato ×4 weights + Source Sans 3 ×3 weights + two complete icon-font stylesheets from three
external CDNs. The Tabler webfont is almost entirely unused. Inline styles also mean zero
cacheable CSS — every style travels inside the JS bundle every release.

### Mobile-first? — **No. It is desktop-first with a competent mobile retrofit.**
Honest assessment: every screen *works* at 390px (stage-7 e2e gate proves it), touch targets
respect the 40px minimum, and the table→card transform on Pipeline is the right pattern.
But: one breakpoint (600px) with a JS conditional means a 768px tablet gets the full desktop
layout squeezed; there are no CSS media queries at all, so nothing adapts without React; and
the flagship interaction regresses on phones — **in the editor, the mobile layout stacks the
cost panel *below* the entire input form (`EditorScreen.tsx:171–334`), so the live-updating
quoted price — the product's core promise — is off-screen while the estimator types.** A
persistent mini-total bar (sticky bottom, tap to expand) is the standard mobile answer.
Verdict matters because deliverable 05's ICP quotes from the shop floor on a phone.

---

## 4. User flow vs. established CRM standards

Benchmark set: Pipedrive (visual pipeline standard), HubSpot (onboarding standard), Attio
(current design benchmark — 4.7/5 G2, praised specifically for a "clean, fast, Notion-style
interface" — [review roundup](https://www.coffee.ai/articles/attio-crm-reviews-alternatives-2026), [Attio](https://attio.com/)).

### What QuoteFoundry already gets right (per CRM convention)
- Status pills with semantic colors; stat cards above the list; row → detail drill-in;
  clone-as-first-class-action; empty states with a CTA (`PipelineScreen.tsx`).
- A focused, single-object pipeline (quotes) — closer to Pipedrive's clarity than to
  HubSpot's sprawl, which is right for this ICP.

### Where it breaks CRM-standard expectations

| # | Gap | CRM standard | Severity |
|---|---|---|---|
| 1 | **No URL routing** — screens are `useState` in `AppShell.tsx`; refresh dumps you to Pipeline, quotes can't be linked/bookmarked, browser Back exits | Every CRM: a record has a URL. Estimators will want to paste a quote link into a text/email to themselves | **High — the single biggest flow gap** |
| 2 | **No confirmation or undo on outcome actions** — "Mark lost" fires instantly (`DetailScreen.tsx`) | Confirm-or-undo on status-terminal actions everywhere (HubSpot/Pipedrive both) | High — misclicks corrupt pipeline stats the owner trusts |
| 3 | **No toasts/notifications** — save/send feedback is button-state only | Non-blocking toast with undo is the norm | Medium |
| 4 | **Unlabeled 84px icon rail** — three unlabeled glyphs (`AppShell.tsx`) | Labeled or tooltipped nav (Attio labels; Linear tooltips + shortcuts) | Medium — three items is learnable, but tooltips are ~free |
| 5 | **No global search / command palette** | Attio/Linear-era standard (⌘K) | Low for MVP — note as expectation, don't build yet |
| 6 | **List-only pipeline, no kanban** | Pipedrive made kanban *the* mental model for "pipeline" | Low — list is defensible for quotes; revisit post-$1k |
| 7 | **No keyboard path** — mouse-only dropdown (`onMouseDown` + `preventDefault` in editor customer select), no shortcuts | Power estimators live on the keyboard in Excel — the tool replacing Excel shouldn't be slower by keyboard | Medium |

The flow itself — Landing → Auth → Pipeline → Editor → Detail → Send — is clean and matches
the daily loop in CLAUDE.md. The gaps are all *mechanics around* the flow, not the flow.

---

## 5. Reference designs worth stealing from (verified July 2026)

**Product UI (CRM/dashboard):**
- [Attio](https://attio.com/) + [Attio real-screen UX patterns on SaaS UI](https://www.saasui.design/application/attio) — the current B2B CRM design benchmark; steal: record-page layout, labeled left nav, restrained motion, list-density controls.
- [Mobbin — CRM web screens](https://mobbin.com/explore/web/app-categories/crm) and [CRM mobile screens](https://mobbin.com/explore/mobile/app-categories/crm) — real production flows (Pipedrive, HubSpot et al.); steal: mobile pipeline card patterns and how mobile CRMs keep the key number visible (persistent summary bars).
- Figma Community kits (free, high-adoption) to lift component patterns without adopting a framework:
  [Venture CRM Dashboard UI Kit](https://www.figma.com/community/file/1340997556708750617/venture-crm-dashboard-ui-kit),
  [CRM UI Kit for SaaS Dashboards (185 screens / 200+ components)](https://www.figma.com/community/file/1463555657173424575/crm-ui-kit-for-saas-dashboards),
  [Midbox CRM/Admin UI Kit](https://www.figma.com/community/file/1487965188148097351/ui-kit-for-crm-dashboard-admin-saas-midbox),
  [CRM Dashboard UI Kit (free template)](https://www.figma.com/community/file/1608729335102335518/crm-dashboard-ui-kit-free-figma-template).
  Steal: toast/confirmation/modal patterns, table-density variants, empty/loading states.

**Landing page:**
- [Awwwards — SaaS category](https://www.awwwards.com/websites/saas/) and [SaaS Landing Page gallery](https://saaslandingpage.com/) — steal restraint, not spectacle: single accent color, real product screenshots, pricing above the fold.
- [20 best B2B SaaS landing pages 2025 (Caffeine)](https://www.caffeinemarketing.com/blog/20-best-b2b-saas-landing-page-examples) — annotated conversion patterns; relevant to the pricing-page work already planned in deliverable 05.
- Canva: only relevant for brand-kit collateral (social cards, one-pagers for design-partner outreach) — not a source for product UI.

**If/when the founder moves off hand-rolled primitives:** [shadcn/ui](https://ui.shadcn.com/)
(copy-in components, no runtime dependency — philosophically compatible with this codebase)
+ [Lucide](https://lucide.dev/) SVG icons to replace both icon fonts. Post-$1k, not now.

---

## 6. Computed accessibility findings (WCAG 2.1 AA, math not opinion)

Contrast ratios computed this session from the actual token values:

| Pair (usage) | Ratio | AA normal (4.5) | AA large/UI (3.0) |
|---|---|---|---|
| `muted` #9698D6 on `appBg` #F4F4FB (secondary text, disabled) | **2.47** | ❌ | ❌ |
| `muted` on white cards | **2.71** | ❌ | ❌ |
| `faint` #B0B0C8 on white (tertiary labels) | **2.12** | ❌ | ❌ |
| White on `accent` #5E81F4 (**primary button label**) | **3.55** | ❌ | ✅ |
| `success` #16A86A on `successBg` (**"Won" pill**) | **2.86** | ❌ | ❌ |
| `success` on white | 3.07 | ❌ | ✅ |
| `danger` #EF5368 on white (error text) | 3.44 | ❌ | ✅ |
| `body` #46485F on `appBg` | 8.15 | ✅ | ✅ |
| `ink` #1C1D21 on `appBg` | 15.38 | ✅ | ✅ |
| `panelAccentText` #7CE7AC on `panelTo` | 11.02 | ✅ | ✅ |

Combined with: zero ARIA attributes app-wide, focus outlines globally removed
(`global.css:28`), exactly one `htmlFor` in the codebase (the file-upload label in
`EditorScreen.tsx:239` — ironically correct), div-based rows acting as buttons, and a
mouse-only customer dropdown. **The buyer demographic skews 45+ (shop owners/estimators);
low-contrast small text is not an abstract compliance issue for them — it's legibility of
the prices they're checking.** The ICP also strengthens the case: shop floors are bright,
glare-heavy environments.

The fixes are cheap because of the token architecture: darkening `muted`, deepening
`accent` ~15% or bumping button label weight/size, and adding a `:focus-visible` ring are
single-point token/CSS edits, verified automatically by the existing design gates (which
should get 2–3 new assertions: focus visibility, contrast of pills/buttons).

---

## 7. Design SWOT

| | |
|---|---|
| **Strengths** | Test-enforced token system (near-unique at this stage); cohesive, contemporary visual identity; correct visual hierarchy (price is king); 40px+ touch discipline; framework-free = no design debt to someone else's system; margin-hiding customer preview modal mirrors the PDF (trust-consistent) |
| **Weaknesses** | Accessibility failing grade (contrast, focus, ARIA, keyboard); desktop-first retrofit at one breakpoint; mobile editor hides the live price; no component primitives (drift risk); no URL routing; minimal feedback (no toasts/confirm/undo); landing/app brand split; icon-font + font-weight network bloat |
| **Opportunities** | Token architecture makes the a11y fix a days-not-weeks job, testable by existing design gates; "legible on a bright shop floor, works one-handed on a phone" can become a *marketed differentiator* against dense incumbent ERPs (JobBOSS² is compared to 'DOS-based systems' by its own reviewers — deliverable 03); Attio-style labeled-nav polish is cheap and reads as 'modern' to LLM/AEO screenshots and directory reviewers; the planned pricing page (05) can launch brand-unified |
| **Threats** | First design partners are the least forgiving audience for misclicks with no undo ('Mark lost' misfire corrupts the stats the owner checks); a lost-on-refresh session during a live demo damages the trust the whole GTM depends on; ADA/508 exposure if any customer's customer is government-adjacent (structural steel often is); every screen added before primitives exist raises the refactor bill |

**Strategic read:** the design system's bones are strong and unusually well-protected; the
gaps are concentrated in exactly the layer a design partner touches in their first 10
minutes (focus, feedback, refresh, mobile price visibility). Fix that layer before week 3 of
the 05 roadmap; defer everything cosmetic.

---

## 8. Prioritized recommendations

Framed against the 05 roadmap's "polish only" budget. Nothing below re-opens product scope.

### P0 — before design partners touch it (fits 05 weeks 1–2, ~2–3 dev-days total)
1. **Restore focus visibility**: replace `outline: none` with a `:focus-visible` ring in `global.css` (one rule; token-colored).
2. **Contrast pass on 4 tokens**: darken `muted`/`faint`, deepen button/pill foregrounds to clear 4.5:1; update the design-gate expected values in the same commit.
3. **Confirm-or-undo on Mark won / Mark lost** (`DetailScreen.tsx`) — a 5-second undo toast is better UX than a modal.
4. **Mobile editor: sticky bottom mini-total** (tap to expand full panel) so the live price is never off-screen (`EditorScreen.tsx`).
5. **Link labels to inputs** (`htmlFor`/`id`) and make the customer dropdown keyboard-navigable.

### P1 — before public launch (fits 05 weeks 2–3, alongside the SEO work)
6. **URL routing** (`/quotes`, `/quotes/:id`, `/quotes/:id/edit`, `/customers`, `/rates`) — react-router or a ~50-line hash router; deep links are also an SEO/AEO asset.
7. **Toast layer** for save/send/clone feedback (one small shared component — the first entry in the primitives layer).
8. **Drop the Tabler webfont CDN; trim font weights** (Lato 300 and 900 → check usage; likely 400/700 + one display weight suffice).
9. **Unify landing palette with app tokens** — one brand across the sign-up seam.
10. **Icon-rail tooltips + aria-labels** (3 nav items).

### P2 — post-$1k (do not do now)
11. Extract Button/Input/Modal/Toast primitives (or adopt shadcn/ui + Lucide, replacing icon fonts entirely).
12. Tablet breakpoint (~900px) and CSS-media-query migration.
13. Dark mode (the token file makes this tractable).
14. Kanban pipeline view; ⌘K palette; keyboard shortcuts.
15. Extend design gates to assert focus rings, contrast, spacing.

---

## 9. Bottom line

The honest one-liner for the founder: **your design system is better-engineered than most
seed-stage startups' and worse to use with a keyboard than a 1998 website.** The visual
identity, token discipline, and test enforcement are assets — keep them and brag about them.
The deficits are concentrated, cheap to fix precisely *because* of that token architecture,
and sit directly on the first-session path that deliverable 04 identified as the make-or-
break moment. Spend 2–3 days on the P0 list before the first design partner logs in; do P1
alongside the launch plumbing; resist P2 until the first $1,000 is collected.
