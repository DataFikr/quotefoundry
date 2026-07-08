# Landing demo video assets

Drop the produced 55-second demo here to make it play on the landing page
(where the CSS animation currently runs). No code change is needed — see
`src/app/demoVideo.ts` and `docs/consulting/09-landing-demo-video-plan.md` §2.

Required files (target total < 4.5 MB, muted, 1280×800, captions burned in):

| File | Notes |
|------|-------|
| `demo.webm`        | VP9, primary source |
| `demo.mp4`         | H.264, Safari/fallback source |
| `demo-poster.webp` | poster frame + mobile tap-to-play face (~60 KB) |

Encode commands are in doc 09 §2. Until these exist, `<video>` 404s and the
landing page falls back to the animated loop automatically. To force the
animation regardless, set `enabled: false` in `src/app/demoVideo.ts`.
