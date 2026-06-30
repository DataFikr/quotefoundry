// useIsMobile.ts — matchMedia hook driving the responsive (≤600px) layouts.
// Inline-styled screens branch their grid templates on this.
import { useState, useEffect } from 'react';

const QUERY = '(max-width: 600px)';

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    on();
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}
