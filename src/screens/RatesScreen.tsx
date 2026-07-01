// ============================================================================
// RatesScreen.tsx — the shop rate library, split into 3 sub-tabs:
//   Material : the material library (name + $/lb) with add/remove, + scrap %
//   Labor    : labor + machine + consumables $/hr rates
//   Margin   : overhead % and target margin %
// The amber banner promises "applies to new quotes only" — TRUE in code: quotes
// price from their own frozen snapshot (CLAUDE.md §4.2).
// ============================================================================
import { useState, useEffect } from 'react';
import { rateService } from '../data-access-layer/services/rateService';
import type { ShopRates, Material } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, cardShadowLg } from '../app/ui';

type Tab = 'material' | 'labor' | 'margin';
type NumKey = keyof Omit<ShopRates, 'materials'>;
type Field = { key: NumKey; label: string; prefix?: string; suffix?: string };

const LABOR: Field[] = [
  { key: 'rate_cutting', label: 'Cutting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_fitting', label: 'Fitting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_welding', label: 'Welding labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_finishing', label: 'Finishing labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_burn', label: 'Burn rate (plasma/laser)', prefix: '$', suffix: '/hr' },
  { key: 'rate_consumables', label: 'Consumables', prefix: '$', suffix: '/wh' },
];
const MARGIN: Field[] = [
  { key: 'overhead_pct', label: 'Overhead uplift', suffix: '%' },
  { key: 'margin_pct', label: 'Target margin', suffix: '%' },
];

export function RatesScreen() {
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [tab, setTab] = useState<Tab>('material');
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'saved'>('clean');
  const [draft, setDraft] = useState({ name: '', price: '' });

  useEffect(() => { rateService.get().then((r) => r.data && setRates(r.data)); }, []);

  function patch(p: Partial<ShopRates>) { setRates((prev) => (prev ? { ...prev, ...p } : prev)); setStatus('dirty'); }
  function setNum(key: NumKey, v: number) { patch({ [key]: v } as Partial<ShopRates>); }

  function addMaterial() {
    const name = draft.name.trim();
    const price = Number(draft.price);
    if (!name || !(price > 0) || !rates) return;
    patch({ materials: [...(rates.materials ?? []), { name, price }] });
    setDraft({ name: '', price: '' });
  }
  function editMaterial(i: number, m: Partial<Material>) {
    if (!rates) return;
    const materials = (rates.materials ?? []).map((x, j) => (j === i ? { ...x, ...m } : x));
    patch({ materials });
  }
  function removeMaterial(i: number) {
    if (!rates) return;
    patch({ materials: (rates.materials ?? []).filter((_, j) => j !== i) });
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

  const numField = (f: Field) => (
    <label key={f.key} style={{ display: 'block' }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: color.body, fontFamily: heading }}>{f.label}</span>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', border: `1.5px solid ${color.border}`, borderRadius: 12, height: 48, padding: '0 14px' }}>
        {f.prefix && <span style={{ fontSize: 14, color: color.faint, fontWeight: 600, marginRight: 4 }}>{f.prefix}</span>}
        <input type="number" value={rates[f.key] as number} onChange={(e) => setNum(f.key, Number(e.target.value) || 0)} data-rate={f.key}
          style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 15, width: '100%', color: color.ink }} />
        {f.suffix && <span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>{f.suffix}</span>}
      </div>
    </label>
  );

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'material', label: 'Material' }, { key: 'labor', label: 'Labor' }, { key: 'margin', label: 'Margin' },
  ];

  return (
    <div style={{ padding: '30px 34px 48px', maxWidth: 920 }} data-screen="rates">
      <div data-testid="rates-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: color.warnBg, border: `1px solid ${color.warnBorder}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
        <i className="las la-info-circle" style={{ color: '#D99A2B', fontSize: 20, marginTop: 1 }} />
        <div style={{ fontSize: 14, color: '#8A6A20', lineHeight: 1.5 }}>
          Changes apply to <b>new quotes only</b>. Quotes you've already saved keep the rates they were built with.
        </div>
      </div>

      {/* sub-tabs */}
      <div style={{ display: 'inline-flex', gap: 6, background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: 13, padding: 4, marginBottom: 22 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} data-tab={t.key}
              style={{ border: 'none', borderRadius: 10, padding: '9px 20px', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: on ? color.accent : 'transparent', color: on ? '#fff' : color.muted }}>
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ background: color.surface, borderRadius: 22, padding: '28px 30px', boxShadow: cardShadowLg }}>
        {tab === 'material' && (
          <div data-panel="material">
            <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 14 }}>Material library ($/lb)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(rates.materials ?? []).map((m, i) => (
                <div key={i} data-material={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input value={m.name} onChange={(e) => editMaterial(i, { name: e.target.value })}
                    style={{ flex: 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5 }} />
                  <div style={{ display: 'flex', alignItems: 'center', width: 160, border: `1.5px solid ${color.border}`, borderRadius: 12, height: 46, padding: '0 14px' }}>
                    <span style={{ color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span>
                    <input type="number" step="0.01" value={m.price} onChange={(e) => editMaterial(i, { price: Number(e.target.value) || 0 })} data-material-price={m.name}
                      style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%' }} />
                    <span style={{ color: color.faint, fontWeight: 600 }}>/lb</span>
                  </div>
                  <button onClick={() => removeMaterial(i)} title="Remove" data-remove-material={m.name}
                    style={{ width: 40, height: 40, border: 'none', borderRadius: 11, background: '#FFEFF1', color: color.danger, cursor: 'pointer', fontSize: 16 }}><i className="las la-trash" /></button>
                </div>
              ))}
            </div>

            {/* add material */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid #F2F2F8` }}>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="New material (e.g. Galvanized Sheet)" data-testid="new-material-name"
                style={{ flex: 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5 }} />
              <div style={{ display: 'flex', alignItems: 'center', width: 160, border: `1.5px solid ${color.border}`, borderRadius: 12, height: 46, padding: '0 14px' }}>
                <span style={{ color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span>
                <input type="number" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0.00" data-testid="new-material-price"
                  style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%' }} />
                <span style={{ color: color.faint, fontWeight: 600 }}>/lb</span>
              </div>
              <button onClick={addMaterial} data-testid="add-material"
                style={{ height: 46, padding: '0 18px', border: 'none', borderRadius: 12, background: color.accentDeep, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <i className="las la-plus" /> Add
              </button>
            </div>

            <div style={{ marginTop: 22, maxWidth: 260 }}>{numField({ key: 'scrap_pct', label: 'Drop / scrap allowance', suffix: '%' })}</div>
          </div>
        )}

        {tab === 'labor' && (
          <div data-panel="labor" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{LABOR.map(numField)}</div>
        )}

        {tab === 'margin' && (
          <div data-panel="margin" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>{MARGIN.map(numField)}</div>
        )}

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
