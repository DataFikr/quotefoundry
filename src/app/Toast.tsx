// ============================================================================
// Toast.tsx — the minimal toast primitive (design P0 2.3 / P1 4.2).
// One toast at a time, bottom-center, auto-dismisses; optional action button
// (used for Undo on Mark won/lost). Dark surface = readable over any screen.
// ============================================================================
import { useState, useRef, useCallback } from 'react';
import { color } from '../design/tokens';
import { heading } from './ui';

export interface ToastData {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function useToast(timeoutMs = 5000) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((t: ToastData) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), timeoutMs);
  }, [timeoutMs]);

  return { toast, show, dismiss };
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" data-testid="toast"
      style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', zIndex: 70, display: 'flex', alignItems: 'center', gap: 14, background: color.panelTo, color: '#fff', borderRadius: 14, padding: '13px 18px', boxShadow: '0 18px 40px -12px rgba(10,10,30,.55)', animation: 'qfFade .18s ease-out', maxWidth: '92vw' }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button onClick={() => { toast.onAction!(); onDismiss(); }} data-testid="toast-action"
          style={{ border: 'none', borderRadius: 9, padding: '7px 14px', background: 'rgba(255,255,255,.14)', color: '#AFC0FF', fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {toast.actionLabel}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss notification"
        style={{ border: 'none', background: 'transparent', color: '#9EA0C8', cursor: 'pointer', fontSize: 15, padding: 2 }}>
        <i className="las la-times" />
      </button>
    </div>
  );
}
