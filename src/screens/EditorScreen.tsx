// ============================================================================
// EditorScreen.tsx — the quote editor. Left: grouped inputs. Right: the sticky
// dark cost-summary panel that recomputes live via the SAME computeQuote the
// save path uses (CLAUDE.md §4.3). Styled to design/QuoteForge.dc.html.
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import { rateService } from '../data-access-layer/services/rateService';
import { computeQuote } from '../data-access-layer/lib/quoteEngine';
import type { QuoteInputs, ShopRates } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money, money2, heading, cardShadowLg } from '../app/ui';

const EMPTY: QuoteInputs = {
  job_name: '', material_spec: '', material_weight: 0, quantity: 1, burn_minutes: 0,
  hrs_cutting: 0, hrs_fitting: 0, hrs_welding: 0, hrs_finishing: 0,
  outside_services: 0, finish_spec: '', lead_time: '', notes: '',
};

const inputBox: React.CSSProperties = {
  marginTop: 7, display: 'flex', alignItems: 'center', border: `1.5px solid ${color.border}`,
  borderRadius: 12, height: 46, padding: '0 14px', background: color.surface,
};
const labelText: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: color.body };
const rawInput: React.CSSProperties = { border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%', minWidth: 0, color: color.ink };

function Section({ title }: { title: string }) {
  return <div style={{ marginTop: 24, fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</div>;
}

export function EditorScreen({ quoteId, onSaved, onCancel }: { quoteId?: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const [inputs, setInputs] = useState<QuoteInputs>(EMPTY);
  const [customer, setCustomer] = useState({ name: '', email: '' });
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [editId, setEditId] = useState<string | undefined>(quoteId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (quoteId) {
        const res = await quoteService.get(quoteId);
        if (res.data) {
          setInputs({ ...EMPTY, ...res.data.inputs });
          setCustomer({ name: res.data.customer_name ?? '', email: res.data.customer_email ?? '' });
          setRates(res.data.rate_snapshot); // edit prices from the EXISTING snapshot
          setEditId(res.data.id);
          return;
        }
      }
      const r = await rateService.get();
      if (r.data) setRates(r.data);
    })();
  }, [quoteId]);

  const totals = useMemo(() => (rates ? computeQuote(inputs, rates) : null), [inputs, rates]);

  function set<K extends keyof QuoteInputs>(key: K, value: QuoteInputs[K]) {
    setInputs((p) => ({ ...p, [key]: value }));
  }
  const num = (key: keyof QuoteInputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (Number(e.target.value) || 0) as QuoteInputs[typeof key]);

  async function save() {
    setSaving(true);
    const res = editId
      ? await quoteService.update(editId, inputs)
      : await quoteService.create(inputs, { name: customer.name || undefined, email: customer.email || undefined });
    setSaving(false);
    if (res.data) onSaved(res.data.id);
  }

  const labor: Array<[keyof QuoteInputs, string]> = [
    ['hrs_cutting', 'Cutting'], ['hrs_fitting', 'Fitting'], ['hrs_welding', 'Welding'], ['hrs_finishing', 'Finishing'],
  ];

  const lines = totals ? [
    ['Material', money2(totals.line_material)],
    ['Labor', money2(totals.line_labor)],
    ['Burn / machine', money2(totals.line_burn)],
    ['Consumables', money2(totals.line_consumables)],
    ['Outside services', money2(totals.line_outside)],
  ] : [];

  return (
    <div style={{ padding: '26px 34px 48px' }} data-screen="editor">
      <div onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: color.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
        <i className="las la-arrow-left" /> Pipeline
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 410px', gap: 24, alignItems: 'start' }}>
        {/* LEFT: inputs */}
        <div style={{ ...{ background: color.surface, borderRadius: 22, boxShadow: cardShadowLg }, padding: '28px 30px', minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'block' }}><span style={{ ...labelText, fontWeight: 700, fontFamily: heading }}>Customer</span>
              <div style={inputBox}><input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Apex Industrial" style={rawInput} /></div>
            </label>
            <label style={{ display: 'block' }}><span style={{ ...labelText, fontWeight: 700, fontFamily: heading }}>Email</span>
              <div style={inputBox}><input value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} placeholder="purchasing@apex.com" style={rawInput} /></div>
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'block' }}><span style={{ ...labelText, fontWeight: 700, fontFamily: heading }}>Job name</span>
              <div style={inputBox}><input value={inputs.job_name} onChange={(e) => set('job_name', e.target.value)} placeholder="Stair stringers" style={rawInput} data-field="job_name" /></div>
            </label>
          </div>

          <Section title="Specification" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'block' }}><span style={labelText}>Material spec</span>
              <div style={inputBox}><input value={inputs.material_spec} onChange={(e) => set('material_spec', e.target.value)} placeholder="A36 steel" style={rawInput} /></div>
            </label>
            <label style={{ display: 'block' }}><span style={labelText}>Finish spec</span>
              <div style={inputBox}><input value={inputs.finish_spec} onChange={(e) => set('finish_spec', e.target.value)} placeholder="Hot-dip galvanized" style={rawInput} /></div>
            </label>
          </div>

          <Section title="Material" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'block' }}><span style={labelText}>Weight</span>
              <div style={inputBox}><input type="number" value={inputs.material_weight || ''} onChange={num('material_weight')} style={rawInput} data-field="material_weight" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>lb</span></div>
            </label>
            <label style={{ display: 'block' }}><span style={labelText}>Quantity</span>
              <div style={inputBox}><input type="number" value={inputs.quantity || ''} onChange={num('quantity')} style={rawInput} data-field="quantity" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>pcs</span></div>
            </label>
          </div>

          <Section title="Labor (hours)" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            {labor.map(([key, lbl]) => (
              <label key={key} style={{ display: 'block' }}><span style={labelText}>{lbl}</span>
                <div style={inputBox}><input type="number" value={(inputs[key] as number) || ''} onChange={num(key)} style={rawInput} data-field={key} /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>hr</span></div>
              </label>
            ))}
          </div>

          <Section title="Machine & outside" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
            <label style={{ display: 'block' }}><span style={labelText}>Burn time</span>
              <div style={inputBox}><input type="number" value={inputs.burn_minutes || ''} onChange={num('burn_minutes')} style={rawInput} data-field="burn_minutes" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>min</span></div>
            </label>
            <label style={{ display: 'block' }}><span style={labelText}>Outside services</span>
              <div style={inputBox}><span style={{ fontSize: 13, color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span><input type="number" value={inputs.outside_services || ''} onChange={num('outside_services')} style={rawInput} data-field="outside_services" /></div>
            </label>
          </div>

          <Section title="Notes" />
          <label style={{ display: 'block', marginTop: 12 }}>
            <textarea value={inputs.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Special instructions, lead time, delivery…"
              style={{ width: '100%', minHeight: 84, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14.5, color: color.ink, resize: 'vertical' }} />
          </label>
        </div>

        {/* RIGHT: live cost summary (internal view shows margin/overhead) */}
        <div style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, borderRadius: 22, padding: '28px 28px 26px', color: '#fff', position: 'sticky', top: 8, boxShadow: '0 24px 50px -28px rgba(20,20,50,.7)' }} data-testid="cost-panel">
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9EA0C8', textTransform: 'uppercase', letterSpacing: '.6px' }}>Cost breakdown</div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lines.map(([lbl, val]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#C7C8E0' }}><span>{lbl}</span><span style={{ fontFamily: heading, fontWeight: 700, color: '#fff' }}>{val}</span></div>
            ))}
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '18px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#C7C8E0', marginBottom: 9 }}><span>Shop cost</span><span style={{ fontFamily: heading, fontWeight: 700, color: '#fff' }}>{totals ? money2(totals.total_cost) : '—'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#C7C8E0', marginBottom: 9 }}><span>+ Overhead</span><span style={{ fontFamily: heading, fontWeight: 700, color: '#fff' }}>{totals ? money2(totals.total_overhead) : '—'}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#C7C8E0' }}><span>+ Margin</span><span style={{ fontFamily: heading, fontWeight: 700, color: color.panelAccentText }}>{totals ? money2(totals.total_margin) : '—'}</span></div>
          <div style={{ background: 'rgba(94,129,244,.16)', border: '1px solid rgba(94,129,244,.4)', borderRadius: 16, padding: '16px 18px', marginTop: 20 }}>
            <div style={{ fontSize: 13, color: '#AFC0FF', fontWeight: 600 }}>Quoted price</div>
            <div style={{ fontFamily: heading, fontWeight: 900, fontSize: 36, letterSpacing: '-.5px', marginTop: 2 }} data-testid="quoted-price">{totals ? money(totals.quoted_price) : '—'}</div>
            <div style={{ fontSize: 13, color: '#9EA0C8', marginTop: 2 }}>{totals ? money2(totals.per_unit) : '—'} per unit · qty {inputs.quantity || 1}</div>
          </div>
          <button onClick={save} disabled={saving} data-testid="save-quote"
            style={{ marginTop: 18, width: '100%', height: 50, border: 'none', borderRadius: 14, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Save quote'}
          </button>
          <div style={{ fontSize: 12.5, color: '#9EA0C8', textAlign: 'center', marginTop: 12 }}>Margin & overhead stay internal — never on the customer PDF.</div>
        </div>
      </div>
    </div>
  );
}
