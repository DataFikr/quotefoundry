// ============================================================================
// EditorScreen.tsx — the quote editor.
// Layout: row 1 = Customer | Document Assist; row 2 = Material | Labor;
//         then Machine & outside (full width); then Notes (full width).
// Right: the sticky dark cost-summary panel (customer as its header) that
// recomputes live via the SAME computeQuote the save path uses (§4.3). The
// chosen material sets the effective $/lb via resolveRates.
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import { rateService, customerService } from '../data-access-layer/services/rateService';
import { computeQuote, resolveRates } from '../data-access-layer/lib/quoteEngine';
import type { QuoteInputs, ShopRates, Customer } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money, money2, heading, cardShadowLg, initials } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';
import { analyzeFile, AnalyzeResult } from '../doc-assist/src/docAssistAnalyzer';
import { Prefill } from '../doc-assist/src/fieldMap';

export interface PresetCustomer { id?: string; name: string; email?: string }

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
const labelHead: React.CSSProperties = { ...labelText, fontWeight: 700, fontFamily: heading };
const rawInput: React.CSSProperties = { border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%', minWidth: 0, color: color.ink };
const card: React.CSSProperties = { background: color.surface, borderRadius: 22, boxShadow: cardShadowLg, padding: '24px 26px', minWidth: 0 };

function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>{children}</div>;
}

const sampleChip: React.CSSProperties = {
  padding: '7px 13px', border: `1px solid ${color.border}`, borderRadius: 10, background: '#fff',
  color: color.body, fontSize: 12.5, fontWeight: 700, fontFamily: heading, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
};

function PrefillBadge({ meta }: { meta?: { confidence: string; source: string } }) {
  if (!meta) return null;
  const high = meta.confidence === 'high';
  return (
    <div data-prefill-badge style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 11.5, fontWeight: 700, fontFamily: heading, color: high ? color.success : '#B8860B' }}>
      <i className={high ? 'las la-check-circle' : 'las la-exclamation-circle'} style={{ fontSize: 13 }} />
      {high ? 'from ' + meta.source : 'review — ' + meta.source}
    </div>
  );
}

export function EditorScreen({ quoteId, presetCustomer, onSaved, onCancel }: { quoteId?: string; presetCustomer?: PresetCustomer; onSaved: (id: string) => void; onCancel: () => void }) {
  const [inputs, setInputs] = useState<QuoteInputs>(EMPTY);
  const [customer, setCustomer] = useState({ name: presetCustomer?.name ?? '', email: presetCustomer?.email ?? '' });
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [editId, setEditId] = useState<string | undefined>(quoteId);
  const [saving, setSaving] = useState(false);
  const mobile = useIsMobile();

  // customer picker (only when no preset customer and not editing an existing quote)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const locked = Boolean(presetCustomer) || Boolean(quoteId);

  // --- Document Assist state ---
  const [docBusy, setDocBusy] = useState(false);
  const [docResult, setDocResult] = useState<AnalyzeResult | null>(null);
  const [docFiles, setDocFiles] = useState<Array<{ name: string; tier: string }>>([]);
  const [prefillMeta, setPrefillMeta] = useState<Prefill>({});

  useEffect(() => {
    (async () => {
      if (quoteId) {
        const res = await quoteService.get(quoteId);
        if (res.data) {
          setInputs({ ...EMPTY, ...res.data.inputs });
          setCustomer({ name: res.data.customer_name ?? '', email: res.data.customer_email ?? '' });
          setRates(res.data.rate_snapshot);
          setEditId(res.data.id);
          return;
        }
      }
      const r = await rateService.get();
      if (r.data) setRates(r.data);
    })();
    customerService.list().then((r) => r.data && setCustomers(r.data));
  }, [quoteId]);

  const effectiveRates = useMemo(() => (rates ? resolveRates(rates, inputs.material_spec) : null), [rates, inputs.material_spec]);
  const totals = useMemo(() => (effectiveRates ? computeQuote(inputs, effectiveRates) : null), [inputs, effectiveRates]);

  function set<K extends keyof QuoteInputs>(key: K, value: QuoteInputs[K]) { setInputs((p) => ({ ...p, [key]: value })); }
  const num = (key: keyof QuoteInputs) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, (Number(e.target.value) || 0) as QuoteInputs[typeof key]);

  function pickCustomer(c: Customer) {
    setCustomer({ name: c.company_name, email: c.email ?? '' });
    setCustOpen(false); setCustQuery('');
  }

  function applyPrefill(prefill: Prefill) {
    if (Object.keys(prefill).length === 0) return;
    const mats = rates?.materials ?? [];
    setInputs((p) => {
      const next = { ...p };
      for (const [field, meta] of Object.entries(prefill)) {
        let value: string | number = meta.value;
        if (field === 'quantity') value = Number(meta.value) || p.quantity;
        // snap a matched material to the shop's canonical name so the dropdown shows it
        if (field === 'material_spec') {
          const hit = mats.find((m) => m.name.toLowerCase() === String(meta.value).toLowerCase());
          if (hit) value = hit.name;
        }
        next[field as keyof QuoteInputs] = value as never;
      }
      return next;
    });
    setPrefillMeta((m) => ({ ...m, ...prefill }));
  }

  async function analyze(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setDocBusy(true);
    let firstParsed: AnalyzeResult | null = null;
    const attached: Array<{ name: string; tier: string }> = [];
    for (const f of list) {
      const res = await analyzeFile(f);
      attached.push({ name: f.name, tier: res.tier });
      if (!firstParsed && res.parsed) { firstParsed = res; applyPrefill(res.prefill); }
    }
    setDocFiles((prev) => [...prev, ...attached]);
    setDocResult(firstParsed ?? (await analyzeFile(list[0])));
    setDocBusy(false);
  }
  async function loadSample(url: string, name: string, type: string) {
    const blob = await (await fetch(url)).blob();
    await analyze([new File([blob], name, { type })]);
  }

  async function save() {
    setSaving(true);
    const res = editId
      ? await quoteService.update(editId, inputs)
      : await quoteService.create(inputs, { id: presetCustomer?.id, name: customer.name || undefined, email: customer.email || undefined });
    setSaving(false);
    if (res.data) onSaved(res.data.id);
  }

  const labor: Array<[keyof QuoteInputs, string]> = [
    ['hrs_cutting', 'Cutting'], ['hrs_fitting', 'Fitting'], ['hrs_welding', 'Welding'], ['hrs_finishing', 'Finishing'],
  ];
  const lines = totals ? [
    ['Material', money2(totals.line_material)], ['Labor', money2(totals.line_labor)],
    ['Burn / machine', money2(totals.line_burn)], ['Consumables', money2(totals.line_consumables)],
    ['Outside services', money2(totals.line_outside)],
  ] : [];
  const filtered = customers.filter((c) => c.company_name.toLowerCase().includes(custQuery.toLowerCase()));

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '26px 34px 48px' }} data-screen="editor">
      <div onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: color.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
        <i className="las la-arrow-left" /> Pipeline
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 410px', gap: 24, alignItems: 'start' }}>
        {/* LEFT: grouped cards */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 20, minWidth: 0 }}>

          {/* ROW 1 · col 1 — CUSTOMER */}
          <div style={card} data-card="customer">
            <CardTitle>Customer</CardTitle>
            {/* combobox: a plain div (not <label>) so clicking an option doesn't
                re-focus the input and reopen the list */}
            <div style={{ position: 'relative' }}>
              <span style={labelHead}>Customer</span>
              {locked ? (
                <div style={inputBox}><input value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Customer name" style={rawInput} data-field="customer_name" /></div>
              ) : (
                <>
                  <div style={inputBox}>
                    <i className="las la-search" style={{ color: '#B6B6CC', marginRight: 8 }} />
                    <input value={custOpen ? custQuery : customer.name} onFocus={() => setCustOpen(true)} onChange={(e) => { setCustQuery(e.target.value); setCustOpen(true); }}
                      placeholder="Select or search a customer" style={rawInput} data-testid="customer-select" data-field="customer_name" />
                    <i className="las la-angle-down" style={{ color: '#B6B6CC' }} />
                  </div>
                  {custOpen && (
                    <div data-testid="customer-options" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 4, background: '#fff', border: `1px solid ${color.border}`, borderRadius: 12, boxShadow: cardShadowLg, maxHeight: 220, overflowY: 'auto' }}>
                      {filtered.length === 0 && <div style={{ padding: 12, fontSize: 13, color: color.muted }}>No match — type a name above.</div>}
                      {filtered.map((c) => (
                        <div key={c.id} onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }} data-customer-option={c.company_name}
                          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(94,129,244,.12)', color: color.accentDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: heading, fontWeight: 700, fontSize: 12 }}>{initials(c.company_name)}</div>
                          <div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.company_name}</div><div style={{ fontSize: 12, color: color.muted }}>{c.email ?? ''}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Email</span>
              <div style={inputBox}><input value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} placeholder="purchasing@apex.com" style={rawInput} data-field="customer_email" /></div>
            </label>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Job name</span>
              <div style={inputBox}><input value={inputs.job_name} onChange={(e) => set('job_name', e.target.value)} placeholder="Stair stringers" style={rawInput} data-field="job_name" /></div>
              <PrefillBadge meta={prefillMeta.job_name} />
            </label>
          </div>

          {/* ROW 1 · col 2 — DOCUMENT ASSIST */}
          <div style={card} data-testid="doc-assist">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, flex: 'none', borderRadius: 13, background: 'rgba(94,129,244,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 20 }}><i className="las la-file-import" /></div>
              <div>
                <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 16 }}>Document Assist</div>
                <div style={{ fontSize: 13, color: color.muted }}>Optional — drop an RFQ to pre-fill. You review every value.</div>
              </div>
            </div>
            {docBusy && (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#71728F', fontSize: 13.5, fontWeight: 600 }}>
                <i className="las la-spinner" style={{ animation: 'qfSpin 1s linear infinite', fontSize: 18, color: color.accentDeep }} />Reading document…
              </div>
            )}
            {docResult && !docBusy && (
              <div data-testid="doc-banner" style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 11, background: docResult.parsed ? '#EEF4FF' : color.warnBg, border: `1px solid ${docResult.parsed ? '#D6E2FF' : color.warnBorder}`, borderRadius: 14, padding: '13px 15px' }}>
                <i className={docResult.parsed ? 'las la-check-circle' : 'las la-info-circle'} style={{ color: docResult.parsed ? color.accentDeep : '#D99A2B', fontSize: 19, marginTop: 1, flex: 'none' }} />
                <div style={{ fontSize: 13.5, color: color.body, lineHeight: 1.45 }}>{docResult.message}</div>
              </div>
            )}
            <div onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) analyze(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()}
              style={{ marginTop: 16, border: `1.6px dashed ${color.border}`, borderRadius: 14, padding: 20, textAlign: 'center', background: '#FBFBFE' }}>
              <i className="las la-cloud-upload-alt" style={{ fontSize: 26, color: '#B6B6CC' }} />
              <div style={{ fontSize: 13.5, color: '#71728F', marginTop: 6 }}>Drag an RFQ file here, or <label htmlFor="rfq-file" style={{ color: color.accentDeep, fontWeight: 700, cursor: 'pointer' }}>browse</label></div>
              <div style={{ fontSize: 11.5, color: color.faint, marginTop: 3 }}>XLSX · CSV · PDF · DWG · multiple files OK</div>
              <input type="file" id="rfq-file" data-testid="rfq-input" multiple onChange={(e) => e.target.files && analyze(e.target.files)} style={{ display: 'none' }} />
            </div>
            {docFiles.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {docFiles.map((f, i) => {
                  const badge = f.tier === 'tier1_spreadsheet' ? { label: 'Spreadsheet', c: color.success } : f.tier === 'tier2_text_pdf' ? { label: 'Text PDF', c: color.accentDeep } : { label: 'Stored', c: color.muted };
                  return (
                    <div key={i} data-doc-file style={{ display: 'flex', alignItems: 'center', gap: 11, background: '#F7F8FF', borderRadius: 12, padding: '9px 12px' }}>
                      <i className="las la-file" style={{ color: badge.c, fontSize: 19 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: heading, padding: '4px 10px', borderRadius: 8, background: '#EEF1FF', color: badge.c }}>{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {docResult && docResult.additionalRows > 0 && (
              <div data-testid="additional-rows" style={{ marginTop: 12, fontSize: 12.5, color: color.muted }}>+{docResult.additionalRows} more line item{docResult.additionalRows > 1 ? 's' : ''} in this file — each is its own quote.</div>
            )}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: color.muted, fontWeight: 600 }}>Try a sample:</span>
              <button onClick={() => loadSample('/samples/rfq.csv', 'rfq.csv', 'text/csv')} data-testid="sample-csv" style={sampleChip}><i className="las la-file-excel" style={{ color: color.success }} /> Spreadsheet</button>
              <button onClick={() => loadSample('/samples/rfq.pdf', 'rfq.pdf', 'application/pdf')} data-testid="sample-pdf" style={sampleChip}><i className="las la-file-pdf" style={{ color: color.accentDeep }} /> Text PDF</button>
              <button onClick={() => loadSample('/samples/model.dwg', 'model.dwg', 'application/acad')} data-testid="sample-dwg" style={sampleChip}><i className="las la-cube" style={{ color: color.muted }} /> CAD file</button>
            </div>
          </div>

          {/* ROW 2 · col 1 — MATERIAL */}
          <div style={card} data-card="material">
            <CardTitle>Material</CardTitle>
            <label style={{ display: 'block' }}><span style={labelText}>Material</span>
              <div style={inputBox}>
                <select value={inputs.material_spec} onChange={(e) => set('material_spec', e.target.value)} data-field="material_spec"
                  style={{ ...rawInput, appearance: 'none', cursor: 'pointer' }}>
                  <option value="">Select a material…</option>
                  {(rates?.materials ?? []).map((m) => <option key={m.name} value={m.name}>{m.name} — ${m.price.toFixed(2)}/lb</option>)}
                  {inputs.material_spec && !(rates?.materials ?? []).some((m) => m.name.toLowerCase() === inputs.material_spec!.toLowerCase()) && (
                    <option value={inputs.material_spec}>{inputs.material_spec} (custom)</option>
                  )}
                </select>
                <i className="las la-angle-down" style={{ color: '#B6B6CC' }} />
              </div>
              <PrefillBadge meta={prefillMeta.material_spec} />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <label style={{ display: 'block' }}><span style={labelText}>Weight</span>
                <div style={inputBox}><input type="number" value={inputs.material_weight || ''} onChange={num('material_weight')} style={rawInput} data-field="material_weight" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>lb</span></div>
              </label>
              <label style={{ display: 'block' }}><span style={labelText}>Quantity</span>
                <div style={inputBox}><input type="number" value={inputs.quantity || ''} onChange={num('quantity')} style={rawInput} data-field="quantity" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>pcs</span></div>
                <PrefillBadge meta={prefillMeta.quantity} />
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelText}>Finish spec</span>
              <div style={inputBox}><input value={inputs.finish_spec} onChange={(e) => set('finish_spec', e.target.value)} placeholder="Hot-dip galvanized" style={rawInput} data-field="finish_spec" /></div>
              <PrefillBadge meta={prefillMeta.finish_spec} />
            </label>
          </div>

          {/* ROW 2 · col 2 — LABOR */}
          <div style={card} data-card="labor">
            <CardTitle>Labor (hours)</CardTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {labor.map(([key, lbl]) => (
                <label key={key} style={{ display: 'block' }}><span style={labelText}>{lbl}</span>
                  <div style={inputBox}><input type="number" value={(inputs[key] as number) || ''} onChange={num(key)} style={rawInput} data-field={key} /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>hr</span></div>
                </label>
              ))}
            </div>
          </div>

          {/* BOTTOM — MACHINE & OUTSIDE (full width) */}
          <div style={{ ...card, gridColumn: mobile ? 'auto' : '1 / -1' }} data-card="machine">
            <CardTitle>Machine &amp; outside</CardTitle>
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <label style={{ display: 'block' }}><span style={labelText}>Burn time</span>
                <div style={inputBox}><input type="number" value={inputs.burn_minutes || ''} onChange={num('burn_minutes')} style={rawInput} data-field="burn_minutes" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>min</span></div>
              </label>
              <label style={{ display: 'block' }}><span style={labelText}>Outside services</span>
                <div style={inputBox}><span style={{ fontSize: 13, color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span><input type="number" value={inputs.outside_services || ''} onChange={num('outside_services')} style={rawInput} data-field="outside_services" /></div>
              </label>
            </div>
          </div>

          {/* VERY BOTTOM — NOTES (full width) */}
          <div style={{ ...card, gridColumn: mobile ? 'auto' : '1 / -1' }} data-card="notes">
            <CardTitle>Notes</CardTitle>
            <textarea value={inputs.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Special instructions, lead time, delivery…"
              style={{ width: '100%', minHeight: 84, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 14.5, color: color.ink, resize: 'vertical' }} />
          </div>
        </div>

        {/* RIGHT: live cost summary — customer as header */}
        <div style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, borderRadius: 22, padding: '24px 28px 26px', color: '#fff', position: mobile ? 'static' : 'sticky', top: 8, boxShadow: '0 24px 50px -28px rgba(20,20,50,.7)' }} data-testid="cost-panel">
          <div data-testid="cost-customer" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 18, marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#5E81F4,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: heading, fontWeight: 700, fontSize: 14 }}>{initials(customer.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.name || 'No customer yet'}</div>
              <div style={{ fontSize: 12.5, color: '#9EA0C8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.email || 'add an email to send'}</div>
            </div>
          </div>

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
          <div style={{ fontSize: 12.5, color: '#9EA0C8', textAlign: 'center', marginTop: 12 }}>Margin &amp; overhead stay internal — never on the customer PDF.</div>
        </div>
      </div>
    </div>
  );
}
