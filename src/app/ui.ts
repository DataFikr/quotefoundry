// ui.ts — shared presentational helpers derived from the design tokens, so the
// screens stay consistent with src/design/tokens.ts (the design-gate source).
import { color } from '../design/tokens';
import type { QuoteStatus } from '../data-access-layer/lib/types';

export const money = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US');
export const money2 = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const cardShadow = '0 14px 30px -22px rgba(60,60,120,.5)';
export const cardShadowLg = '0 18px 40px -28px rgba(60,60,120,.55)';

export const card: React.CSSProperties = {
  background: color.surface,
  borderRadius: 22,
  boxShadow: cardShadowLg,
};

export const heading = "'Lato', sans-serif";
export const bodyFont = "'Source Sans 3', sans-serif";

const STATUS_STYLE: Record<QuoteStatus, { label: string; bg: string; color: string }> = {
  draft:  { label: 'Draft',  bg: '#F0F0F8', color: color.muted },
  sent:   { label: 'Sent',   bg: 'rgba(94,129,244,.12)', color: color.accentDeep },
  opened: { label: 'Opened', bg: 'rgba(94,129,244,.16)', color: color.accentDeep },
  won:    { label: 'Won',    bg: color.successBg, color: color.success },
  lost:   { label: 'Lost',   bg: '#FFEFF1', color: color.danger },
};

export function statusPill(s: QuoteStatus) {
  return STATUS_STYLE[s] ?? STATUS_STYLE.draft;
}

export function initials(name?: string): string {
  if (!name) return '—';
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}
