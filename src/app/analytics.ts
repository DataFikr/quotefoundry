// ============================================================================
// analytics.ts — GA4 page_view for the hash-routed SPA.
// ----------------------------------------------------------------------------
// The gtag snippet in index.html loads GA4 but uses send_page_view:false, so
// EVERY page_view (including the first) is sent from here. GA4's Enhanced
// Measurement "history changes" does not follow hash routing, so we send the
// event explicitly on each screen change. No-op when gtag is absent (local dev,
// or the tag blocked) — analytics must never break the app.
// ============================================================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Convert an in-app hash route ("#/quotes/123") into a real path so GA4 records
// each screen as a distinct page — GA4 drops the "#" fragment otherwise, which
// would collapse every screen into a single "/" pageview.
export function trackPageView(hashPath: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const route = hashPath.replace(/^#/, '') || '/';
  window.gtag('event', 'page_view', {
    page_location: window.location.origin + route,
    page_title: document.title,
  });
}
