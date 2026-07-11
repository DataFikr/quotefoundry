// ============================================================================
// demoVideo.ts — points the landing demo at the produced ~59-second video
// (doc 09 Phases B–C; composed from the Claude Design handoff). While `enabled`
// is true, LandingDemo mounts a real <video> at these paths; if the files are
// absent (they 404 until encoded), the <video> errors and LandingDemo falls
// back to the CSS animation loop automatically — the page never dead-ends.
//
// `aspect` is the source frame ratio (W / H). LandingDemo drives the player's
// box from this with object-fit:contain, so the WHOLE frame always shows —
// never cropped/truncated — on both desktop and mobile. The handoff composes at
// 1920×1080, so 16 / 9. Change here if you re-export at another ratio.
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
  aspect: '16 / 9',
} as const;
