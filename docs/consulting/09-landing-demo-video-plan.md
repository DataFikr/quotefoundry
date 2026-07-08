# 09 — Landing-Page Demo Video: Content & Integration Plan (HANDOFF)

> **Status:** approved plan, NOT yet implemented.
> **Intended executor:** founder (recording) + coding agent (Opus model) for edit/integration.
> Executor: read CLAUDE.md first — positioning rules are binding (never "AI quotes";
> the story is "quote faster, win more jobs, stop losing margin").

## Context

The Phase-1 outreach campaign ([08-outreach-campaign-plan.md](08-outreach-campaign-plan.md)) will drive ~160 cold prospects to quotefoundry.app. Today the landing page ([src/screens/LandingScreen.tsx](../../src/screens/LandingScreen.tsx)) is copy-only: hero → three-steps → founding-beta → footer. A prospect who clicks through from a cold email has ~5 seconds of attention and no proof the "10 minutes" claim is real. This plan adds a **sub-60-second, GIF-style silent demo loop** showing a real quote built in the app, plus a benefits row naming the three highlights: **Accurate costing · RFQ processing · Job status tracker**.

Research basis (July 2026): shortening a demo from 4 min to 90s raised conversions 2.1% → 8.3% in a SproutVideo case study; hero-adjacent placement paired with the headline + primary CTA is the consistent pattern; muted autoplay loop (or click-to-play with a strong poster) beats sound-on autoplay, which backfires. Monday.com's "the page is a demo of itself" and Cloudforecast's embedded no-signup demo are the reference patterns.

**Terminology guard:** "RFQ processing" in customer-facing copy means the **Document Assist** upload flow (drop the customer's RFQ spreadsheet/PDF → fields pre-fill). It is NOT a new RFQ entity (out of MVP scope per CLAUDE.md §9). "Job status tracker" means the existing quote pipeline (draft → sent → opened → won/lost).

**Format decision — "GIF" implemented as muted video:** a 55-second GIF at readable resolution would be 30–80 MB and murder page load. The executor builds the *GIF experience* with `<video autoplay muted loop playsinline>` serving **WebM + MP4 (~2–4 MB)** with a poster image. This is what every reference site actually does; keep the user-facing behavior identical to a GIF (autoplays silently, loops, no controls chrome by default).

---

## 1. Layout — where the video goes

**Placement: a new "demo" section directly under the hero CTA row, visually overlapping the hero gradient into the white section** — the standard Linear/Pipedrive/Attio pattern: a browser-style frame card, centered, `max-width: 960px`, rounded corners + soft shadow, top half sitting on the hero's `linear-gradient(180deg, TINT, #F8FAFF)` background.

```
┌────────────────────────────────────────────┐
│  nav (unchanged)                           │
├────────────────────────────────────────────┤
│  HERO (unchanged copy + CTAs)              │
│  "Quote structural steel jobs in 10        │
│   minutes, not all afternoon"              │
│  [Quote your first job free] [Log in]      │
│  ✓ no card  ✓ live in 15 min  ✓ cancel     │
│      ┌──────────────────────────────┐      │ ← video card overlaps
├──────┤  ●●●  app.quotefoundry.app   ├──────┤   the hero/white seam
│      │                              │      │
│      │   ▶ 55s silent demo loop     │      │
│      │   (poster until loaded)      │      │
│      │                              │      │
│      └──────────────────────────────┘      │
│   "Watch a real job quoted in under 10     │
│    minutes — at 2× speed"                  │
│                                            │
│  ⚙ Accurate costing  📄 RFQ processing     │ ← NEW benefits row
│  📊 Job status tracker  (3 cards)          │
├────────────────────────────────────────────┤
│  THREE STEPS (unchanged)                   │
├────────────────────────────────────────────┤
│  FOUNDING PARTNER BETA (unchanged)         │
├────────────────────────────────────────────┤
│  footer (unchanged)                        │
└────────────────────────────────────────────┘
```

Why here and not inside the hero block: the H1 + CTA stay above the fold untouched (they're proven copy), and the video top edge peeking above the fold is itself a scroll cue. On **mobile**: no autoplay — show the poster with a centered play button (click-to-play) to respect data plans; the card goes full-bleed minus the 22px gutter.

**Benefits row (the three highlights)** sits immediately under the video as three tint cards (reuse the exact card style of the three-steps grid — `TINT` background, 18px radius, Line Awesome icons):
1. **Accurate costing** — "Priced from your shop's own rates — labor, material, burn, margin. Not guesswork." (icon: `la-calculator`)
2. **RFQ processing** — "Drop in the customer's RFQ spreadsheet or PDF — part, material, qty pre-filled." (icon: `la-file-invoice`)
3. **Job status tracker** — "Every quote tracked draft → sent → opened → won. Know what to chase." (icon: `la-tasks`)

---

## 2. The video — content flow, script, thumbnail

**Spec:** raw recording ≈ 1:50 at normal speed → exported at **2× ≈ 55 seconds**, 1280×800 (16:10 app window), silent, on-screen captions burned in (it's muted — captions ARE the voiceover), loops seamlessly (end card ≈ 2s then cut back to scene 1).

### Shot list / flow (times are final, at 2×)

| # | Time | On screen (recorded in the app, mock data) | Burned-in caption (the hook script) |
|---|------|--------------------------------------------|-------------------------------------|
| 1 | 0:00–0:06 | An RFQ spreadsheet dragged onto the editor; fields flash-fill (part, material, qty) | **"A customer RFQ just landed."** → **"Fields filled. No retyping."** |
| 2 | 0:06–0:22 | Estimator enters weights/hours; cost panel recalculates live on every keystroke | **"Your rates. Your labor. Your margin."** → **"Watch the price build itself."** |
| 3 | 0:22–0:34 | Quoted price locks in; click Preview → branded customer PDF (scope + total only) | **"A branded quote your customer takes seriously."** |
| 4 | 0:34–0:44 | Click Send; quote status flips **draft → sent**; then the **opened** badge appears | **"Sent. And you'll know when they open it."** |
| 5 | 0:44–0:52 | Pipeline board: quotes in draft / sent / opened / won columns, values visible | **"Every job tracked. Nothing slips."** |
| 6 | 0:52–0:55 | End card, brand navy (`color.panelFrom`): bolt logo + text | **"Your rates. Your quote. Under 10 minutes."** + "Start free — no card" |

The captions map one-to-one to the three benefit cards below the video (scene 1 → RFQ processing, scene 2 → accurate costing, scenes 4–5 → job status tracker) — the page reads as proof of the row beneath it.

**Hook rule:** scene 1 must show *motion + payoff inside 5 seconds* (file drop → fields fill). Never open on an empty form or a login screen.

### Thumbnail / poster frame
A designed still (not a random frame): **split composition** — left 60%: the quote editor with the cost panel visible and the quoted price large; right 40%: the branded PDF preview; center: white play button (72px circle, `CTA` orange); top-left chip in brand navy: **"⏱ Under 10 min — real demo, 2× speed"**. Export `demo-poster.webp` (~60 KB). This is the `poster=` attribute AND the mobile click-to-play face, so it must sell the video by itself.

### Recording notes (founder or agent)
- Run the app on the mock backend (`mock-supabase/` runs the whole app — no live data, no real customer names). Seed a believable job: e.g. "Structural brackets — 240 lb steel, qty 1" (the canonical engine example, so the numbers look right on camera).
- Shop name in the demo: a fictional "Ironline Fabrication" — never a real prospect's name.
- Window at 1280×800, 100% zoom, cursor visible, deliberate movements (2× makes hesitation look like chaos — rehearse once).
- Windows tools: **OBS Studio** (free) or **ScreenToGif** for capture; captions + end card + speed in any editor, or ffmpeg-only (below).

### Edit/encode (agent-executable, ffmpeg)
```bash
# 2x speed, strip audio
ffmpeg -i raw.mp4 -filter:v "setpts=0.5*PTS" -an demo-2x.mp4
# web encodes (target < 4 MB total)
ffmpeg -i demo-2x.mp4 -vcodec libx264 -crf 28 -preset slow -movflags +faststart -vf scale=1280:-2 demo.mp4
ffmpeg -i demo-2x.mp4 -c:v libvpx-vp9 -crf 40 -b:v 0 -vf scale=1280:-2 demo.webm
# poster base frame (then design pass for the split composition)
ffmpeg -i demo.mp4 -ss 00:00:23 -frames:v 1 demo-poster-base.png
```
Captions: burn in with ffmpeg `subtitles=captions.srt:force_style=...` or in the editor — burned-in either way (muted loop, no `<track>` reliance), styled: heading font, white on 70%-navy pill, bottom-center.

---

## 3. Execution phases

- **Phase A — Script & seed (agent, 0.5 day):** finalize the 6-scene shot list into a rehearsal doc; prepare mock-backend seed data (one customer, one RFQ spreadsheet matching Doc-Assist Tier-1 headers, rates preloaded) so the recording needs zero improvisation.
- **Phase B — Record (founder, 0.5 day):** one rehearsal + 2–3 takes on the mock backend per the recording notes. Deliver `raw.mp4`.
- **Phase C — Edit & encode (agent, 0.5 day):** 2× speed, captions, end card, poster design; export `demo.webm`, `demo.mp4`, `demo-poster.webp` into `public/media/`; verify total payload < 4.5 MB.
- **Phase D — Landing integration (agent, 1 day):** new `DemoSection` in [LandingScreen.tsx](../../src/screens/LandingScreen.tsx) between hero and three-steps per the layout above: browser-frame card, `<video autoplay muted loop playsinline preload="none" poster>` + IntersectionObserver to `play()` only when visible and `pause()` off-screen (honors the existing "network diet" work); mobile = poster + tap-to-play; benefits row of 3 cards reusing the three-steps card style and design tokens (`TINT`, `ACCENT`, `DK` — no new colors); caption line under the card: "Watch a real job quoted in under 10 minutes — at 2× speed."
- **Phase E — Measure & iterate (founder + agent, ongoing):** log a `demo_played` event; watch outreach click-throughs → sign-ups before/after launch; if mobile taps are low, test a different poster composition.

## Files to create/modify

| File | Action |
|---|---|
| `src/screens/LandingScreen.tsx` | add `DemoSection` (video card + benefits row) between hero and three-steps |
| `public/media/demo.webm`, `demo.mp4`, `demo-poster.webp` | new assets (Phases B–C) |
| `docs/consulting/09-landing-demo-video-plan.md` | this plan — update status as phases complete |

Reuse: design tokens from `src/design/tokens.ts` (`color.panelFrom`, `accent`, etc.), `useIsMobile`, the three-steps card styling, Line Awesome icons already loaded, mock backend `mock-supabase/` for recording.

## Verification
1. Devtools/Lighthouse on the landing page: video does not load before scroll (`preload="none"`), LCP unchanged (poster must not become the LCP element), total media transfer < 4.5 MB.
2. Desktop: video autoplays muted when scrolled into view, loops seamlessly, pauses off-screen.
3. Mobile (≤600px): no autoplay; poster + play button; tap plays inline (`playsinline` — no iOS fullscreen hijack).
4. Copy audit: no "AI" claims anywhere in captions, poster, or benefits row; "RFQ processing" copy describes upload-and-prefill only.
5. Existing tests stay green; `data-testid` hooks added (`landing-demo`, `demo-play`).
