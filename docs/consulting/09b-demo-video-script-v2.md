# 09b — Landing Demo Video Script v2 (feature refresh) — for Claude Design

> **Purpose:** replacement script for the landing-page demo loop, updated to feature the
> new capabilities (pipeline analytics, labor-by-duration estimator, suggested reference
> rates, material catalog + suggested prices, accept/decline loop, follow-up tracking).
> **Feed this file to Claude Design for video generation.**
> Supersedes the 7-scene shot list in [09-landing-demo-video-plan.md](09-landing-demo-video-plan.md)
> §2 (the integration/layout plan in 09 still stands: same `<video muted loop>` embed,
> same placement under the hero).
>
> **Target length: ~60 s** (tight cut for low-attention cold traffic). A 90 s variant is in the git history of this file.

## Positioning guardrails (BINDING — from CLAUDE.md)
- **Never** say or imply "AI generates the quote / AI prices the job." Accuracy comes from
  the shop's own stored rates + the deterministic engine.
- "**Suggested**" rate = **regional reference preset** (BLS wage pattern). "**Suggested**"
  material price = **market reference price**. Always attributable to reference data, never AI.
- Story is **"quote faster, win more jobs, stop losing margin."** Closing hook: **under 10 minutes.**

---

## Global spec (apply to every scene)
- **Length:** ~60 s (target 59 s). Silent, **muted**. Loops seamlessly (end card → cut to scene 1).
- **Frame:** 1280×800 (16:10 app window), clean modern SaaS UI, visible cursor with deliberate motion, energy of ~2× speed.
- **Captions are the voiceover** — burn in every caption: heading font (Lato), **white text on a 70%-opacity brand-navy pill**, bottom-center. One caption on screen at a time; keep them short.
- **Palette (design tokens, no new colors):** brand navy `color.panelFrom` (deep indigo), accent **CTA orange**, tint `#F8FAFF` backgrounds, success green for "won"/positive deltas, danger red only for the follow-up "gone quiet" flag.
- **Demo data (fictional — never a real prospect):** Shop = **"Ironline Fabrication."** Customer = **"Cedar Ridge Builders."** Canonical job = **structural brackets, 240 lb A36 steel, qty 1 → quoted $1,913.82.** Region = **Gulf Coast / South (Houston)**. Branded sender = `quotes@send.quotefoundry.app`.
- **Hook rule:** motion + payoff within the first 3 seconds. Open on money moving, never a blank form.
- **Pacing at 60 s:** one deliberate action per scene, no idle frames. Cut on motion.

---

## Scene-by-scene script (60 s cut)

### Scene 1 — Pipeline analytics · money at a glance  `0:00–0:09` (9s)
**On screen:** Pipeline dashboard loads. **Win-rate donut animates 0 → 68%**, **"Quoted per month" bars rise**, **"Won this month" counts up to $42,180** (green ▲). All motion in the first 3 s.
**Caption:** `Your whole month — win rate, revenue, what's open.`

**Claude Design prompt:** *Analytics dashboard, white/tint background. Animated green donut filling to 68% labeled "win rate," a rising "Quoted per month" bar chart, and a large "Won this month $42,180" stat with a green up-arrow. Deep-indigo + green accents, clean SaaS, smooth ease-out.*

---

### Scene 2 — New quote · labor by duration · suggested reference rate  `0:09–0:22` (13s)
**On screen:** **New quote** → customer "Cedar Ridge Builders," material **A36 Steel, 240 lb**. **Labor estimator:** type **`3` `Weeks` `8`** hr/day → **"≈ 120 total hours"** → **Fill hours**. Rate chip **"Apply Gulf Coast reference rates"** fills the $/hr fields. Dark cost panel rolls up to **$1,913.82**.
**Captions:**
1. `Estimate labor by day, week, or month.`
2. `Your rates, suggested for your region → $1,913.82.`

**Claude Design prompt:** *Quote editor, two-panel. Left: a "Labor estimator" card — Duration "3", Unit "Weeks", Daily hours "8", live "≈ 120 total hours," and a "Fill hours" button; a chip reads "Gulf Coast reference rates." Right: a dark cost panel where a bold total "$1,913.82" animates upward as inputs change. Indigo panel, orange accent button.*

---

### Scene 3 — Material catalog · upload + suggested price  `0:22–0:31` (9s)
**On screen:** Rates → **Material** tab. **Market reference cards** ("304 Stainless — **$2.10/lb**"); tap **`+`** → row drops into library. Then **Import list** → CSV uploads, rows cascade in ("**12 added**").
**Caption:** `Upload your price list — or use market reference prices.`

**Claude Design prompt:** *Material rates screen. A row of "market reference" cards each with a metal name and price per pound (e.g. "304 Stainless $2.10/lb") and a "+" button. Below, a materials table; a CSV file icon drops in and new rows animate in with a toast "12 added." Tint background, indigo/green accents.*

---

### Scene 4 — Send → received → accept → pipeline updates  `0:31–0:45` (14s)
**On screen:** **Preview** → branded **PDF (scope + total only)** → **Send** → pill **draft → sent**. Quick cut: **inbox** email from **"Ironline Fabrication"** with **`Quote_….pdf`** attached → customer's public link → cursor clicks **Accept** → checkmark. Back in app: pipeline row flips **green "Won,"** revenue ticks up.
**Captions:**
1. `Send a branded quote. They accept online — one click.`
2. `Pipeline updates itself. Job won.`

**Claude Design prompt:** *Three quick beats. (a) Branded PDF quote with shop logo, scope lines, total, and a "Send" button; status pill "draft" → "sent." (b) Inbox showing an email from "Ironline Fabrication" with a PDF attachment, then a customer web page with green "Accept" / outline "Decline"; cursor clicks Accept, checkmark confirms. (c) App pipeline row turns green to "Won," revenue counter ticks up. Indigo/orange/green, fast smooth transitions.*

---

### Scene 5 — Pipeline · status & follow-up on lapse days  `0:45–0:53` (8s)
**On screen:** Pipeline list — columns **Job · Customer · Sent · Since sent · Quoted · Status**; pills across **draft/sent/opened/won**; one row flagged **red "6d since sent · needs follow-up,"** pulsing. Top stat card: **"Needs follow-up: 1."**
**Caption:** `Every status in one place — chase what's gone quiet.`

**Claude Design prompt:** *Quote pipeline table with columns Job, Customer, Sent, "Since sent," Quoted, and colored status pills (draft/sent/opened/won). One row shows a pulsing red "6d since sent — needs follow-up" badge; a top stat card reads "Needs follow-up: 1." Clean SaaS table, indigo header, muted zebra rows.*

---

### Scene 6 — End card · the hook  `0:53–0:59` (6s)
**On screen:** Full **brand-navy** card, bolt logo, headline then CTA fade in.
**Captions (large, centered):**
- `Your rates. Your quote. Under 10 minutes.`
- sub: `Start free — no card.`

**Claude Design prompt:** *Full-screen deep-indigo end card with a small bolt logo, bold white headline "Your rates. Your quote. Under 10 minutes." and an orange pill button "Start free — no card." Minimal, confident, subtle fade-in.*

---

## Caption master sheet (for burn-in / SRT)
| # | Time | Caption |
|---|------|---------|
| 1 | 0:02 | Your whole month — win rate, revenue, what's open. |
| 2 | 0:10 | Estimate labor by day, week, or month. |
| 2 | 0:16 | Your rates, suggested for your region → $1,913.82. |
| 3 | 0:23 | Upload your price list — or use market reference prices. |
| 4 | 0:32 | Send a branded quote. They accept online — one click. |
| 4 | 0:40 | Pipeline updates itself. Job won. |
| 5 | 0:46 | Every status in one place — chase what's gone quiet. |
| 6 | 0:54 | Your rates. Your quote. Under 10 minutes. |
| 6 | 0:57 | Start free — no card. |

## Loop / seam
End card holds ~1.5 s, then hard-cut back to Scene 1's dashboard (donut resets to 0 and re-fills) so the loop reads as intentional.

## Timing summary
9 + 13 + 9 + 14 + 8 + 6 = **59 s**. If Claude Design runs long, trim Scene 4's inbox beat first, then Scene 3, to hold ≤ 60 s.
