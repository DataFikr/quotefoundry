// ============================================================================
// demoVideo.ts — points the landing demo at the produced 55-second video
// (doc 09 Phases B–C). While `enabled` is true, LandingDemo mounts a real
// <video> at these paths; if the files are absent (they 404 until the founder
// records + encodes them), the <video> errors and LandingDemo falls back to the
// CSS animation loop automatically — the page never dead-ends.
//
// To go live: encode per docs/consulting/09-landing-demo-video-plan.md §2 and
// drop demo.webm / demo.mp4 / demo-poster.webp into public/media/. No code edit.
// To force the animation instead, set enabled: false.
// ============================================================================
export const demoVideo = {
  enabled: true,
  webm: '/media/demo.webm',
  mp4: '/media/demo.mp4',
  poster: '/media/demo-poster.webp',
} as const;
