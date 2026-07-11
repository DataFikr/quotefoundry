// ============================================================================
// demoVideo.ts — points the landing demo at the produced demo video (the
// composed 60s "2× speed" cinematic exported from the Claude Design handoff:
// RFQ+costing → branded PDF+send → pipeline → customer inbox → end card).
// While `enabled` is true, LandingDemo mounts a real <video>; if the file is
// absent (404), the <video> errors and LandingDemo falls back to the CSS
// animation loop automatically — the page never dead-ends.
//
// `aspect` is the source frame ratio (W / H); the export is 1920×1080 → 16 / 9.
// The player derives its box from this with object-fit:contain, so the WHOLE
// frame always shows — never cropped/truncated — on desktop and mobile.
//
// The shipped demo.mp4 is compressed to ~4.0 MB (1280×720 H.264, two-pass ~550
// kbps) — within the doc-09 < 4.5 MB budget. Re-export from the 1920×1080 master
// in video/ if you need to regenerate. To force the animation instead, set
// enabled: false.
// ============================================================================
export const demoVideo = {
  enabled: true,
  mp4: '/media/demo.mp4',
  poster: '/media/demo-poster.webp',
  aspect: '16 / 9',
} as const;
