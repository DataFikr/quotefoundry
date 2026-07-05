// ============================================================================
// useHashRoute.ts — a ~60-line hash router for the in-app screens (Phase 4.1),
// replacing the old useState<Screen> in AppShell. Hash routing (not path)
// keeps deep links working on static hosting with NO server rewrites, and
// survives refresh. Routes:
//   #/quotes                → pipeline
//   #/quotes/new            → editor (new)
//   #/quotes/:id            → detail
//   #/quotes/:id/edit       → editor (existing)
//   #/customers             → customers
//   #/rates                 → rates
// Browser back/forward fire `hashchange`, which re-parses → correct screen.
// A non-serialisable payload (editor's presetCustomer) is preserved across a
// FORWARD navigate via a ref; back/forward re-parse from the URL (blank preset,
// which is fine — a shared/refreshed "new quote" URL just starts empty).
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Screen } from './AppShell';

export function parseHash(hash: string): Screen {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'customers') return { name: 'customers' };
  if (parts[0] === 'rates') return { name: 'rates' };
  if (parts[0] === 'quotes') {
    if (!parts[1]) return { name: 'pipeline' };
    if (parts[1] === 'new') return { name: 'editor' };
    if (parts[2] === 'edit') return { name: 'editor', quoteId: parts[1] };
    return { name: 'detail', quoteId: parts[1] };
  }
  return { name: 'pipeline' };
}

export function toHash(s: Screen): string {
  switch (s.name) {
    case 'customers': return '#/customers';
    case 'rates': return '#/rates';
    case 'detail': return `#/quotes/${s.quoteId}`;
    case 'editor': return s.quoteId ? `#/quotes/${s.quoteId}/edit` : '#/quotes/new';
    case 'pipeline':
    default: return '#/quotes';
  }
}

export function useHashRoute(): { screen: Screen; navigate: (s: Screen, replace?: boolean) => void } {
  const extra = useRef<Screen | null>(null); // last forward target (carries presetCustomer)
  const [screen, setScreen] = useState<Screen>(() => parseHash(window.location.hash));

  // Stamp a hash on first mount when there isn't one, so a later refresh
  // restores this screen instead of dumping to the default.
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', toHash(screen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash(window.location.hash);
      // if the forward target matches this route, reuse it (keeps presetCustomer)
      setScreen(extra.current && toHash(extra.current) === toHash(parsed) ? extra.current : parsed);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((s: Screen, replace = false) => {
    extra.current = s;
    const target = toHash(s);
    if (replace) {
      window.history.replaceState(null, '', target); // no back-entry (e.g. save → detail)
      setScreen(s);
    } else if (window.location.hash !== target) {
      window.location.hash = target; // pushes history + fires hashchange → setScreen
    } else {
      setScreen(s); // same route, refresh the payload
    }
  }, []);

  return { screen, navigate };
}
