# Landing demo video assets

Drop the produced demo here to make it play on the landing page (where the CSS
animation currently runs as a fallback). **No code change is needed** — the
player is already wired in `src/app/demoVideo.ts` + `src/screens/LandingDemo.tsx`.

Export the composed video from the Claude Design handoff
(`Quote Foundry Demo Video`) — it stitches the 4 scene clips with the camera
moves, burned-in captions, and end card into one file.

Required files:

| File | Notes |
|------|-------|
| `demo.webm`        | VP9, primary source |
| `demo.mp4`         | H.264, Safari/fallback source |
| `demo-poster.webp` | poster frame + mobile tap-to-play face (~60 KB) |

Spec (from the handoff / doc 09 §2):
- **Aspect ratio 16:9 (1920×1080).** The player derives its box from this
  (`demoVideo.aspect`) and uses `object-fit: contain`, so the WHOLE frame shows —
  never cropped — on desktop and mobile. If you re-export at another ratio,
  update `aspect` in `src/app/demoVideo.ts`.
- ~59s, muted, captions burned in, seamless loop.
- Target total < 4.5 MB (VP9/H.264 at CRF ~40/28 gets there; the raw handoff
  clips are ~10.6 MB combined — export/encode down).

Until these files exist the `<video>` 404s and the landing page falls back to the
animated loop automatically — it never dead-ends. To force the animation
regardless, set `enabled: false` in `src/app/demoVideo.ts`.
