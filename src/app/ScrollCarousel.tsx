// ============================================================================
// ScrollCarousel.tsx — a horizontally scrollable row with modern edge arrows
// instead of a visible scrollbar. Used on mobile for the pipeline charts and
// the material reference cards. The arrows sit vertically centered on the left
// / right sides and appear only when there's more to scroll in that direction.
//
// The native scrollbar is hidden via `.qf-noscrollbar` (global.css); swipe
// still works (touch), and the arrows are the keyboard/click affordance.
// ============================================================================
import { useRef, useState, useEffect, useCallback } from 'react';
import { color } from '../design/tokens';

export function ScrollCarousel({ children, gap = 12, bleed = 16, testId }: {
  children: React.ReactNode;
  gap?: number;
  bleed?: number;   // negative-margin bleed so the row runs edge-to-edge on phones
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  // Tolerance covers sub-pixel rounding; start position is a clean 0 (no
  // scroll-snap inset), so the left arrow stays hidden until the user scrolls.
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // recompute when the row or its content resizes (e.g. quotes finish loading)
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [update, children]);

  const page = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  const arrowBase: React.CSSProperties = {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 38, height: 38, borderRadius: '50%', border: `1px solid ${color.border}`,
    background: 'rgba(255,255,255,.96)', color: color.body, cursor: 'pointer',
    boxShadow: '0 6px 16px -6px rgba(20,20,50,.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, zIndex: 5, transition: 'opacity .15s',
  };

  return (
    <div style={{ position: 'relative' }} data-testid={testId}>
      <div ref={ref} onScroll={update} className="qf-noscrollbar"
        style={{ display: 'flex', gap, overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: `0 -${bleed}px`, padding: `0 ${bleed}px 4px` }}>
        {children}
      </div>
      <button type="button" aria-label="Scroll left" data-carousel-arrow="left" onClick={() => page(-1)}
        style={{ ...arrowBase, left: 2, opacity: canLeft ? 1 : 0, pointerEvents: canLeft ? 'auto' : 'none' }}>
        <i className="las la-angle-left" />
      </button>
      <button type="button" aria-label="Scroll right" data-carousel-arrow="right" onClick={() => page(1)}
        style={{ ...arrowBase, right: 2, opacity: canRight ? 1 : 0, pointerEvents: canRight ? 'auto' : 'none' }}>
        <i className="las la-angle-right" />
      </button>
    </div>
  );
}
