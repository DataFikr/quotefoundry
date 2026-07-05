// ============================================================================
// EditorScreen.tsx — the quote editor.
// Layout: row 1 = Customer | Document Assist; row 2 = Material | Labor;
//         then Machine & outside (full width); then Notes (full width).
// Right: the sticky dark cost-summary panel (customer as its header) that
// recomputes live via the SAME computeQuote the save path uses (§4.3). The
// chosen material sets the effective $/lb via resolveRates.
// ============================================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import { rateService, customerService } from '../data-access-layer/services/rateService';
import { computeQuote, ratesForInputs } from '../data-access-layer/lib/quoteEngine';
import type { QuoteInputs, ShopRates, Customer, MaterialLine } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money, money2, heading, cardShadowLg, initials } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';
import { analyzeFile, AnalyzeResult } from '../doc-assist/src/docAssistAnalyzer';
import { Prefill } from '../doc-assist/src/fieldMap';
import type { ToastData } from '../app/Toast';

export interface PresetCustomer { id?: string; name: string; email?: string }

const EMPTY: QuoteInputs = {
  job_name: '', part_number: '', material_spec: '', material_weight: 0, quantity: 1, burn_minutes: 0,
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

// ---------------------------------------------------------------------------
// FilePreviewPane — right-half panel that renders the clicked upload:
// CSV/XLSX as a table, PDFs via the browser's native viewer, images inline;
// anything else (DWG/STP…) gets an honest "no preview" message.
// ---------------------------------------------------------------------------
type PreviewContent =
  | { kind: 'table'; rows: (string | number)[][] }
  | { kind: 'pdf'; url: string }
  | { kind: 'image'; url: string }
  | { kind: 'none' }
  | null;

function FilePreviewPane({ file, mobile, onClose }: { file: File; mobile: boolean; onClose: () => void }) {
  const [content, setContent] = useState<PreviewContent>(null);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    (async () => {
      const name = file.name.toLowerCase();
      if (/\.(csv|xlsx|xls)$/.test(name)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false }) as any[][];
        if (!cancelled) setContent({
          kind: 'table',
          rows: rows.slice(0, 100).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c ?? ''))),
        });
      } else if (/\.pdf$/.test(name)) {
        url = URL.createObjectURL(file);
        if (!cancelled) setContent({ kind: 'pdf', url });
      } else if (/\.(png|jpe?g|gif|webp)$/.test(name)) {
        url = URL.createObjectURL(file);
        if (!cancelled) setContent({ kind: 'image', url });
      } else {
        if (!cancelled) setContent({ kind: 'none' });
      }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [file]);

  return (
    <div data-testid="file-preview" role="dialog" aria-label={`Preview of ${file.name}`}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: mobile ? '100vw' : '50vw', zIndex: 55, background: color.surface, boxShadow: '-24px 0 60px -24px rgba(20,20,50,.45)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${color.border}` }}>
        <i className="las la-file-alt" style={{ fontSize: 19, color: color.accentDeep }} />
        <div style={{ flex: 1, minWidth: 0, fontFamily: heading, fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
        <button onClick={onClose} aria-label="Close preview" data-testid="close-preview"
          style={{ width: 36, height: 36, border: 'none', borderRadius: 10, background: color.appBg, color: color.body, cursor: 'pointer', fontSize: 16 }}>
          <i className="las la-times" />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: content?.kind === 'pdf' ? 0 : 16 }}>
        {!content && <div style={{ padding: 30, textAlign: 'center', color: color.muted, fontSize: 14 }}>Loading preview…</div>}
        {content?.kind === 'table' && (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <tbody>
              {content.rows.map((r, ri) => (
                <tr key={ri} style={{ background: ri === 0 ? '#EEF1FF' : ri % 2 ? '#FBFBFE' : '#fff' }}>
                  {r.map((c, ci) => (
                    <td key={ci} style={{ padding: '7px 10px', border: `1px solid ${color.border}`, fontWeight: ri === 0 ? 700 : 400, fontFamily: ri === 0 ? heading : undefined, whiteSpace: 'nowrap' }}>{String(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {content?.kind === 'pdf' && (
          <iframe src={content.url} title={`Preview of ${file.name}`} style={{ width: '100%', height: '100%', border: 'none' }} />
        )}
        {content?.kind === 'image' && (
          <img src={content.url} alt={file.name} style={{ maxWidth: '100%', borderRadius: 10 }} />
        )}
        {content?.kind === 'none' && (
          <div style={{ padding: 40, textAlign: 'center', color: color.muted }}>
            <i className="las la-cube" style={{ fontSize: 36, color: '#D6D6E6' }} />
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>No preview for this file type (CAD and binary files are stored with the quote and opened in your CAD software).</div>
          </div>
        )}
      </div>
    </div>
  );
}

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

export function EditorScreen({ quoteId, presetCustomer, onSaved, onCancel, notify }: { quoteId?: string; presetCustomer?: PresetCustomer; onSaved: (id: string) => void; onCancel: () => void; notify?: (t: ToastData) => void }) {
  const [inputs, setInputs] = useState<QuoteInputs>(EMPTY);
  const [customer, setCustomer] = useState({ name: presetCustomer?.name ?? '', email: presetCustomer?.email ?? '' });
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [editId, setEditId] = useState<string | undefined>(quoteId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const mobile = useIsMobile();

  // customer picker (only when no preset customer and not editing an existing quote)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custQuery, setCustQuery] = useState('');
  const [custOpen, setCustOpen] = useState(false);
  const [custIdx, setCustIdx] = useState(-1); // keyboard highlight in the option list
  const locked = Boolean(presetCustomer) || Boolean(quoteId);
  const panelRef = useRef<HTMLDivElement>(null); // cost panel (mobile bar scrolls to it)

  // --- Document Assist state ---
  const [docBusy, setDocBusy] = useState(false);
  const [docResult, setDocResult] = useState<AnalyzeResult | null>(null);
  // keep the File blobs so uploaded documents can be previewed in the pane
  const [docFiles, setDocFiles] = useState<Array<{ name: string; tier: string; file: File }>>([]);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
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

  const effectiveRates = useMemo(() => (rates ? ratesForInputs(rates, inputs) : null), [rates, inputs.material_spec, inputs.material_lines]);
  const totals = useMemo(() => (effectiveRates ? computeQuote(inputs, effectiveRates) : null), [inputs, effectiveRates]);

  // --- Material lines (multi-material) --------------------------------------
  // The card edits a LIST of {type, weight, qty}. Legacy quotes (single
  // material_spec/material_weight) are shown as one line. Every edit keeps
  // material_spec/material_weight in sync (first type / total lb) so PDFs,
  // Doc Assist snapping, and older paths keep working.
  const matLines: MaterialLine[] = inputs.material_lines ?? [
    { type: inputs.material_spec ?? '', weight: inputs.material_weight || 0, qty: 1 },
  ];
  function syncLines(next: MaterialLine[]) {
    const totalW = next.reduce((s, l) => s + (l.weight || 0) * (l.qty > 0 ? l.qty : 1), 0);
    setInputs((p) => ({ ...p, material_lines: next, material_spec: next[0]?.type || '', material_weight: totalW }));
  }
  const setLine = (i: number, patch: Partial<MaterialLine>) =>
    syncLines(matLines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => syncLines([...matLines, { type: '', weight: 0, qty: 1 }]);
  const removeLine = (i: number) => syncLines(matLines.filter((_, j) => j !== i));

  function set<K extends keyof QuoteInputs>(key: K, value: QuoteInputs[K]) { setInputs((p) => ({ ...p, [key]: value })); }
  const num = (key: keyof QuoteInputs) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, (Number(e.target.value) || 0) as QuoteInputs[typeof key]);

  function pickCustomer(c: Customer) {
    setCustomer({ name: c.company_name, email: c.email ?? '' });
    setCustOpen(false); setCustQuery(''); setCustIdx(-1);
  }

  // Keyboard support for the customer combobox (a11y P0 2.5): arrows move the
  // highlight, Enter picks, Escape closes — no mouse required.
  function custKeys(e: React.KeyboardEvent<HTMLInputElement>, filtered: Customer[]) {
    if (!custOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setCustOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCustIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCustIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (custIdx >= 0 && filtered[custIdx]) { e.preventDefault(); pickCustomer(filtered[custIdx]); } }
    else if (e.key === 'Escape') { setCustOpen(false); setCustIdx(-1); }
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
          // the material now lives on line 0 of material_lines
          const lines = p.material_lines ?? [{ type: p.material_spec ?? '', weight: p.material_weight || 0, qty: 1 }];
          next.material_lines = [{ ...lines[0], type: String(value) }, ...lines.slice(1)];
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
    const attached: Array<{ name: string; tier: string; file: File }> = [];
    for (const f of list) {
      const res = await analyzeFile(f);
      attached.push({ name: f.name, tier: res.tier, file: f });
      if (!firstParsed && res.parsed) { firstParsed = res; applyPrefill(res.prefill); }
    }
    setDocFiles((prev) => [...prev, ...attached]);
    setDocResult(firstParsed ?? (await analyzeFile(list[0])));
    setDocBusy(false);
  }

  // Remove an uploaded file from the list (prefilled values already applied
  // stay — the estimator reviewed them; this just drops the attachment).
  function removeDocFile(i: number) {
    setDocFiles((prev) => {
      const next = prev.filter((_, j) => j !== i);
      if (next.length === 0) setDocResult(null);
      return next;
    });
    setPreviewIdx((p) => (p === null ? null : p === i ? null : p > i ? p - 1 : p));
  }
  async function loadSample(url: string, name: string, type: string) {
    const blob = await (await fetch(url)).blob();
    await analyze([new File([blob], name, { type })]);
  }

  async function save() {
    // Required: Description (job_name) and a valid customer email — the quote
    // can't be sent without them, so don't let it be saved half-addressed.
    setSaveError(null);
    if (!inputs.job_name.trim()) { setSaveError('Description is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) { setSaveError('A valid customer email is required.'); return; }
    setSaving(true);
    const res = editId
      ? await quoteService.update(editId, inputs)
      : await quoteService.create(inputs, { id: presetCustomer?.id, name: customer.name || undefined, email: customer.email.trim() });
    setSaving(false);
    if (res.error) { setSaveError(res.error); return; }
    if (res.data) {
      notify?.({ message: editId ? 'Changes saved.' : 'Quote saved.' });
      onSaved(res.data.id);
    }
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

  // Extra RFQ metadata surfaced from the parsed document (display-only —
  // drawing number and customer PO aren't quote fields, but the estimator
  // wants them visible while pricing).
  const docMeta = (docResult?.fields ?? [])
    .filter((f) => (f.field === 'drawing_number' || f.field === 'customer_po') && f.value !== '' && f.value != null)
    .map((f) => ({ label: f.field === 'drawing_number' ? 'DWG' : 'PO', value: String(f.value) }));

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '26px 34px 48px' }} data-screen="editor">
      <div onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: color.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
        <i className="las la-arrow-left" /> Pipeline
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 410px', gap: 24, alignItems: 'start' }}>
        {/* LEFT: grouped cards */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 20, minWidth: 0 }}>

          {/* ROW 1 · col 1 — PROJECT (customer + job identity) */}
          <div style={card} data-card="customer">
            <CardTitle>Project</CardTitle>
            {/* RFQ metadata from Doc Assist (drawing / PO) — display-only chips.
                Part number has its own field below. */}
            {docMeta.length > 0 && (
              <div data-testid="quote-metadata" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '-6px 0 14px' }}>
                {docMeta.map((m) => (
                  <span key={m.label} data-meta={m.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F0F0F8', color: color.body, borderRadius: 9, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, fontFamily: heading }}>
                    {m.label} {m.value}
                  </span>
                ))}
              </div>
            )}
            {/* combobox: a plain div (not <label>) so clicking an option doesn't
                re-focus the input and reopen the list; explicit htmlFor/id keeps
                the label associated anyway */}
            <div style={{ position: 'relative' }}>
              <label htmlFor="customer-input" style={labelHead}>Customer</label>
              {locked ? (
                <div style={inputBox}><input id="customer-input" value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} placeholder="Customer name" style={rawInput} data-field="customer_name" /></div>
              ) : (
                <>
                  <div style={inputBox}>
                    <i className="las la-search" style={{ color: '#B6B6CC', marginRight: 8 }} />
                    <input id="customer-input" role="combobox" aria-expanded={custOpen} aria-controls="customer-listbox" aria-autocomplete="list"
                      value={custOpen ? custQuery : customer.name} onFocus={() => setCustOpen(true)}
                      onChange={(e) => { setCustQuery(e.target.value); setCustOpen(true); setCustIdx(-1); }}
                      onKeyDown={(e) => custKeys(e, filtered)}
                      placeholder="Select or search a customer" style={rawInput} data-testid="customer-select" data-field="customer_name" />
                    <i className="las la-angle-down" style={{ color: '#B6B6CC' }} />
                  </div>
                  {custOpen && (
                    <div id="customer-listbox" role="listbox" data-testid="customer-options" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 4, background: '#fff', border: `1px solid ${color.border}`, borderRadius: 12, boxShadow: cardShadowLg, maxHeight: 220, overflowY: 'auto' }}>
                      {filtered.length === 0 && <div style={{ padding: 12, fontSize: 13, color: color.muted }}>No match — type a name above.</div>}
                      {filtered.map((c, i) => (
                        <div key={c.id} role="option" aria-selected={i === custIdx}
                          onMouseDown={(e) => { e.preventDefault(); pickCustomer(c); }} data-customer-option={c.company_name}
                          style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: i === custIdx ? 'rgba(70,103,219,.12)' : 'transparent' }}>
                          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(70,103,219,.12)', color: color.accentDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: heading, fontWeight: 700, fontSize: 12 }}>{initials(c.company_name)}</div>
                          <div><div style={{ fontSize: 14, fontWeight: 600 }}>{c.company_name}</div><div style={{ fontSize: 12, color: color.muted }}>{c.email ?? ''}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Email <span style={{ color: color.danger }}>*</span></span>
              <div style={inputBox}><input type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} placeholder="purchasing@apex.com" style={rawInput} data-field="customer_email" required /></div>
            </label>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Part #</span>
              <div style={inputBox}><input value={inputs.part_number ?? ''} onChange={(e) => set('part_number', e.target.value)} placeholder="STR-2201" style={rawInput} data-field="part_number" /></div>
              <PrefillBadge meta={prefillMeta.part_number} />
            </label>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Description <span style={{ color: color.danger }}>*</span></span>
              <div style={inputBox}><input value={inputs.job_name} onChange={(e) => set('job_name', e.target.value)} placeholder="Stair stringers" style={rawInput} data-field="job_name" required /></div>
              <PrefillBadge meta={prefillMeta.job_name} />
            </label>
            <label style={{ display: 'block', marginTop: 14 }}><span style={labelHead}>Due date</span>
              <div style={inputBox}><input value={inputs.lead_time ?? ''} onChange={(e) => set('lead_time', e.target.value)} placeholder="2026-08-01 or 2 weeks" style={rawInput} data-field="lead_time" /></div>
              <PrefillBadge meta={prefillMeta.lead_time} />
            </label>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 12 }}>*Required field</div>
          </div>

          {/* ROW 1 · col 2 — DOCUMENT ASSIST */}
          <div style={card} data-testid="doc-assist">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, flex: 'none', borderRadius: 13, background: 'rgba(70,103,219,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 20 }}><i className="las la-file-import" /></div>
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
                    /* click to preview (hand cursor); trash removes the file */
                    <div key={i} data-doc-file role="button" tabIndex={0} aria-label={`Preview ${f.name}`}
                      onClick={() => setPreviewIdx(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreviewIdx(i); } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 11, background: previewIdx === i ? '#EEF1FF' : '#F7F8FF', border: previewIdx === i ? `1px solid rgba(70,103,219,.4)` : '1px solid transparent', borderRadius: 12, padding: '9px 12px', cursor: 'pointer' }}>
                      <i className="las la-file" style={{ color: badge.c, fontSize: 19 }} />
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: heading, padding: '4px 10px', borderRadius: 8, background: '#EEF1FF', color: badge.c }}>{badge.label}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeDocFile(i); }} title="Remove file" aria-label={`Remove ${f.name}`} data-remove-file={i}
                        style={{ width: 30, height: 30, flex: 'none', border: 'none', borderRadius: 9, background: '#FFEFF1', color: color.danger, cursor: 'pointer', fontSize: 13 }}>
                        <i className="las la-trash" />
                      </button>
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

          {/* ROW 2 · col 1 — MATERIAL (one or more typed lines) */}
          <div style={card} data-card="material">
            <CardTitle>Material</CardTitle>
            {matLines.map((line, i) => {
              const known = (rates?.materials ?? []).some((m) => m.name.toLowerCase() === line.type.toLowerCase());
              return (
                <div key={i} data-material-line={i} style={{ marginTop: i === 0 ? 0 : 14, paddingTop: i === 0 ? 0 : 14, borderTop: i === 0 ? 'none' : '1px solid #F2F2F8' }}>
                  <label style={{ display: 'block' }}><span style={labelText}>Type</span>
                    <div style={inputBox}>
                      <select value={line.type} onChange={(e) => setLine(i, { type: e.target.value })} data-field={i === 0 ? 'material_spec' : `material_spec_${i}`}
                        style={{ ...rawInput, appearance: 'none', cursor: 'pointer' }}>
                        <option value="">Select a material type…</option>
                        {(rates?.materials ?? []).map((m) => <option key={m.name} value={m.name}>{m.name} — ${m.price.toFixed(2)}/lb</option>)}
                        {line.type && !known && <option value={line.type}>{line.type} (custom)</option>}
                      </select>
                      <i className="las la-angle-down" style={{ color: '#B6B6CC' }} />
                    </div>
                    {i === 0 && <PrefillBadge meta={prefillMeta.material_spec} />}
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: matLines.length > 1 ? '1fr 1fr 40px' : '1fr 1fr', gap: 14, marginTop: 12, alignItems: 'end' }}>
                    <label style={{ display: 'block' }}><span style={labelText}>Weight</span>
                      <div style={inputBox}><input type="number" value={line.weight || ''} onChange={(e) => setLine(i, { weight: Number(e.target.value) || 0 })} style={rawInput} data-field={i === 0 ? 'material_weight' : `material_weight_${i}`} /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>lb</span></div>
                    </label>
                    <label style={{ display: 'block' }}><span style={labelText}>Qty</span>
                      <div style={inputBox}><input type="number" value={line.qty || ''} onChange={(e) => setLine(i, { qty: Number(e.target.value) || 0 })} style={rawInput} data-field={`material_qty_${i}`} /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>pcs</span></div>
                    </label>
                    {matLines.length > 1 && (
                      <button onClick={() => removeLine(i)} title="Remove this material" aria-label={`Remove material line ${i + 1}`} data-remove-line={i}
                        style={{ width: 40, height: 40, border: 'none', borderRadius: 11, background: '#FFEFF1', color: color.danger, cursor: 'pointer', fontSize: 15, marginBottom: 3 }}>
                        <i className="las la-trash" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button onClick={addLine} data-testid="add-material-line"
              style={{ marginTop: 14, height: 40, padding: '0 16px', border: `1.5px dashed ${color.border}`, borderRadius: 11, background: '#FBFBFE', color: color.accentDeep, fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className="las la-plus" />Add material type
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, paddingTop: 14, borderTop: '1px solid #F2F2F8' }}>
              <label style={{ display: 'block' }}><span style={labelText}>Job quantity</span>
                <div style={inputBox}><input type="number" value={inputs.quantity || ''} onChange={num('quantity')} style={rawInput} data-field="quantity" /><span style={{ fontSize: 13, color: color.faint, fontWeight: 600 }}>pcs</span></div>
                <PrefillBadge meta={prefillMeta.quantity} />
              </label>
              <label style={{ display: 'block' }}><span style={labelText}>Finish spec</span>
                <div style={inputBox}><input value={inputs.finish_spec} onChange={(e) => set('finish_spec', e.target.value)} placeholder="Hot-dip galvanized" style={rawInput} data-field="finish_spec" /></div>
                <PrefillBadge meta={prefillMeta.finish_spec} />
              </label>
            </div>
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
        <div ref={panelRef} style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, borderRadius: 22, padding: '24px 28px 26px', color: '#fff', position: mobile ? 'static' : 'sticky', top: 8, boxShadow: '0 24px 50px -28px rgba(20,20,50,.7)' }} data-testid="cost-panel">
          <div data-testid="cost-customer" style={{ paddingBottom: 16, marginBottom: 18, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#4667DB,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: heading, fontWeight: 700, fontSize: 14 }}>{initials(customer.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.name || 'No customer yet'}</div>
                <div style={{ fontSize: 12.5, color: '#9EA0C8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.email || 'add an email to send'}</div>
              </div>
            </div>
            {(inputs.part_number || inputs.job_name) && (
              <div data-testid="cost-project" style={{ marginTop: 12, fontSize: 13, color: '#C7C8E0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {inputs.part_number && <span style={{ fontFamily: heading, fontWeight: 700, color: '#AFC0FF' }}>Part # {inputs.part_number}</span>}
                {inputs.part_number && inputs.job_name && ' · '}
                {inputs.job_name}
              </div>
            )}
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
          <div style={{ background: 'rgba(70,103,219,.16)', border: '1px solid rgba(70,103,219,.4)', borderRadius: 16, padding: '16px 18px', marginTop: 20 }}>
            <div style={{ fontSize: 13, color: '#AFC0FF', fontWeight: 600 }}>Quoted price</div>
            <div style={{ fontFamily: heading, fontWeight: 900, fontSize: 36, letterSpacing: '-.5px', marginTop: 2 }} data-testid="quoted-price">{totals ? money(totals.quoted_price) : '—'}</div>
            <div style={{ fontSize: 13, color: '#9EA0C8', marginTop: 2 }}>{totals ? money2(totals.per_unit) : '—'} per unit · qty {inputs.quantity || 1}</div>
          </div>
          {saveError && (
            <div data-testid="save-error" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(201,42,66,.18)', border: '1px solid rgba(201,42,66,.45)', borderRadius: 12, padding: '10px 13px', fontSize: 13, fontWeight: 600, color: '#FFB4BE' }}>
              <i className="las la-exclamation-circle" style={{ fontSize: 16 }} />{saveError}
            </div>
          )}
          <button onClick={save} disabled={saving} data-testid="save-quote"
            style={{ marginTop: 18, width: '100%', height: 50, border: 'none', borderRadius: 14, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : editId ? 'Save changes' : 'Save quote'}
          </button>
          <div style={{ fontSize: 12.5, color: '#9EA0C8', textAlign: 'center', marginTop: 12 }}>Margin &amp; overhead stay internal — never on the customer PDF.</div>
        </div>
      </div>

      {/* uploaded-file preview pane (right half of the screen) */}
      {previewIdx !== null && docFiles[previewIdx] && (
        <FilePreviewPane file={docFiles[previewIdx].file} mobile={mobile} onClose={() => setPreviewIdx(null)} />
      )}

      {/* MOBILE: persistent mini-total (design P0 2.4) — the live quoted price
          must never be off-screen while the estimator types. Stacked layout
          puts the cost panel below the whole form, so this fixed bar keeps the
          number visible; tapping it brings the full breakdown into view. */}
      {mobile && (
        <>
          <div style={{ height: 66 }} aria-hidden="true" /> {/* keep the form's tail clear of the bar */}
          <div role="button" tabIndex={0} data-testid="mobile-total-bar"
            onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            aria-label="Show full cost breakdown"
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, minHeight: 58, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 18px', background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, color: '#fff', boxShadow: '0 -14px 34px -14px rgba(20,20,50,.55)', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 11, color: '#9EA0C8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Quoted price</div>
              <div data-testid="mobile-total" style={{ fontFamily: heading, fontWeight: 900, fontSize: 21, letterSpacing: '-.3px' }}>{totals ? money(totals.quoted_price) : '—'}</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, fontFamily: heading, color: '#AFC0FF' }}>
              Breakdown <i className="las la-angle-up" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
