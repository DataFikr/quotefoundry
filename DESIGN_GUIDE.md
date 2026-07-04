# QuoteFoundry Design Guide

Extracted from `design/QuoteFoundry.dc.html` (the Claude Design mockup / handoff).
This is the human-readable companion to `src/design/tokens.ts`, which is the
machine source the Playwright **design-guide gate** asserts computed styles
against. When the two disagree, `tokens.ts` wins and this doc gets updated.

## Palette

| Role | Token | Hex |
|------|-------|-----|
| Brand accent | `accent` | `#5E81F4` |
| Brand accent (deep / text, links, totals) | `accentDeep` | `#1B51E5` |
| App background | `appBg` | `#F4F4FB` |
| Card / surface | `surface` | `#FFFFFF` |
| Primary text | `ink` | `#1C1D21` |
| Body text | `body` | `#46485F` |
| Muted / sublabels | `muted` | `#9698D6` |
| Faint / placeholders | `faint` | `#B0B0C8` |
| Card border / input border | `border` | `#ECECF4` |
| Hairline / rail border | `borderSoft` | `#EEEEF4` |
| Success (won, positive) | `success` | `#16A86A` |
| Danger (lost, alerts) | `danger` | `#EF5368` |
| Dark cost panel | `panelFrom`→`panelTo` | `#2B2D42` → `#1C1D2B` |
| Panel margin highlight | `panelAccentText` | `#7CE7AC` |

## Typography

- **Lato** — headings, screen titles, numerals, totals. Weights **700 / 900**.
- **Source Sans 3** — body copy, labels, inputs. Weights **400 / 600**.
- Google Fonts href is in `tokens.ts` (`fonts.googleHref`) and `index.html`.

## Shape & spacing

- **Radii:** sm 10 · md 12 · lg 14 · xl 16 · card 20 · cardLg 22 · pill 9 (px).
- **Control heights:** editor inputs **46px**, rate inputs **48px**, primary
  buttons **44px**.
- **Cards:** white surface, radius 20–22px, soft drop shadow
  `0 14–18px 30–40px -22..-28px rgba(60,60,120,.5)`.
- **Icon rail:** 84px wide, white, items in 46px rounded-14 squares.

## Layout landmarks (per screen)

- **Pipeline:** 4-up stat-card grid, then a list card with filter tabs, search,
  a 6-column row grid (`Job/Quote# · Customer · Date · Quoted · Status · clone`).
- **Editor:** two-panel — left inputs (Document Assist + grouped fields), right
  **sticky dark cost-summary panel** with live breakdown and quoted price.
- **Detail:** left scope/totals card (margin/overhead labeled internal-only),
  right customer + activity timeline. "Preview & send / Mark won / Mark lost".
- **Customers:** 3-up card grid, search + "Add customer".
- **Rates:** amber "applies to new quotes only" banner, 2-col numeric fields.
- **Customer PDF (`#qf-print`):** scope + total ONLY — never margin/overhead/cost.

## Invariants the look must respect

- The dark cost panel shows margin/overhead **only inside the app** (toggle
  `showMargin`); the **customer PDF must never** show them (CLAUDE.md §4.4).
- Status pills: draft (muted), sent/opened (accent), won (success), lost (danger).
