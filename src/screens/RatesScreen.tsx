// ============================================================================
// RatesScreen.tsx — the shop rate library editor. The amber banner promises
// "applies to new quotes only" — and that's TRUE in code: rateService.update
// only changes shop_rates; existing quotes price from their own snapshot
// (CLAUDE.md §4.2). Styled to design/QuoteForge.dc.html.
// ============================================================================
import { useState, useEffect } from 'react';
import { rateService } from '../data-access-layer/services/rateService';
import type { ShopRates } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, cardShadowLg } from '../app/ui';

type Field = { key: keyof ShopRates; label: string; prefix?: string; suffix?: string };
const FIELDS: Field[] = [
  { key: 'rate_cutting', label: 'Cutting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_fitting', label: 'Fitting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_welding', label: 'Welding labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_finishing', label: 'Finishing labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_burn', label: 'Burn rate', prefix: '$', suffix: '/hr' },
  { key: 'price_steel', label: 'Steel price', prefix: '$', suffix: '/lb' },
  { key: 'scrap_pct', label: 'Drop / scrap allowance', suffix: '%' },
  { key: 'rate_consumables', label: 'Consumables', prefix: '$', suffix: '/wh' },
  { key: 'overhead_pct', label: 'Overhead uplift', suffix: '%' },
  { key: 'margin_pct', label: 'Target margin', suffix: '%' },
];

export function RatesScreen() {
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'saved'>('clean');

  useEffect(() => { rateService.get().then((r) => r.data && setRates(r.data)); }, []);

  function set(key: keyof ShopRates, value: number) {
    setRates((p) => (p ? { ...p, [key]: value } : p));
    setStatus('dirty');
  }

  async function save() {
    if (!rates) return;
    setStatus('saving');
    await rateService.update(rates);
    setStatus('saved');
  }

  if (!rates) return <div style={{ padding: 40, color: color.muted }}>Loading rates…</div>;

  const statusText = { clean: 'All changes saved', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved' }[status];
  const statusColor = status === 'dirty' ? color.danger : status === 'saved' ? color.success : color.muted;

  return (
    <div style={{ padding: '30px 34px 48px', maxWidth: 920 }} data-screen="rates">
      <div data-testid="rates-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: color.warnBg, border: `1px solid ${color.warnBorder}`, borderRadius: 16, padding: '16px 20px', marginBottom: 24 }}>
        <i className="las la-info-circle" style={{ color: '#D99A2B', fontSize: 20, marginTop: 1 }} />
        <div style={{ fontSize: 14, color: '#8A6A20', lineHeight: 1.5 }}>
          Changes apply to <b>new quotes only</b>. Quotes you've already saved keep the rates they were built with.
        </div>
      </div>

      <div style={{ background: color.surface, borderRadius: 22, padding: '28px 30px', boxShadow: cardShadowLg }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'block' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: color.body, fontFamily: heading }}>{f.label}</span>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', border: `1.5px solid ${color.border}`, borderRadius: 12, height: 48, padding: '0 14px' }}>
                {f.prefix && <span style={{ fontSize: 14, color: color.faint, fontWeight: 600, marginRight: 4 }}>{f.prefix}</span>}
                <input type="number" value={rates[f.key]} onChange={(e) => set(f.key, Number(e.target.value) || 0)} data-rate={f.key}
                  style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15, width: '100%', color: color.ink }} />
                {f.suffix && <span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>{f.suffix}</span>}
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, paddingTop: 22, borderTop: `1px solid #F2F2F8` }}>
          <span data-testid="rates-status" style={{ fontSize: 13.5, fontWeight: 700, color: statusColor, fontFamily: heading }}>{statusText}</span>
          <button onClick={save} data-testid="save-rates"
            style={{ height: 48, padding: '0 28px', border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
