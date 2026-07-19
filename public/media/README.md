# Landing demo video assets

The landing page shows `demo-poster.webp` (static thumbnail) until the user
clicks play on EITHER desktop or mobile, then plays `demo.mp4` looping
continuously like a muted GIF (the composed ~60s "2× speed" demo: RFQ + costing
→ branded PDF + send → pipeline → customer inbox → end card). Wired in
`src/app/demoVideo.ts` + `src/screens/LandingDemo.tsx`.

Current files (regenerated from `video/Quote Foundry Demo Video v2.mp4` +
`video/Demo Poster Thumbnail v2-selection.png`):

| File | Notes |
|------|-------|
| `demo.mp4`         | H.264, 1280×720 (16:9), ~60s, ~4.0 MB, muted, captions burned in |
| `demo-poster.webp` | static thumbnail / click-to-play face (center-cropped to 16:9) |

Sizing: the player derives its box from `demoVideo.aspect` (16 / 9) with
`object-fit: contain`, so the WHOLE frame shows — never cropped — on desktop and
mobile. If you re-export at another ratio, update `aspect` in
`src/app/demoVideo.ts`.

**Size:** `demo.mp4` is ~4.0 MB — within the doc-09 budget (< 4.5 MB). It was
compressed from the 1920×1080 master (`video/Quote Foundry Demo Video v2.mp4`,
~40 MB, kept out of the repo) via two-pass H.264 at 1280×720 / ~550 kbps, and
the poster was center-cropped from `video/Demo Poster Thumbnail v2-selection.png`
(2560×1600 → 16:9). To regenerate:

```bash
# two-pass H.264, target ~4 MB for 60s
ffmpeg -y -i "master.mp4" -vf scale=1280:720 -r 30 -c:v libx264 -b:v 550k -pass 1 -an -f null -
ffmpeg    -i "master.mp4" -vf scale=1280:720 -r 30 -c:v libx264 -b:v 550k -pass 2 -movflags +faststart -an demo.mp4
# poster: crop the 16:10 thumbnail to the video's 16:9 frame, encode webp
ffmpeg -y -i "thumbnail.png" -vf "crop=2560:1440,scale=1280:720" -c:v libwebp -quality 82 demo-poster.webp
```

Until `demo.mp4` exists the `<video>` 404s and the landing page falls back to the
animated CSS loop automatically — it never dead-ends. To force the animation
regardless, set `enabled: false` in `src/app/demoVideo.ts`.
