// ============================================================================
// QuoteDetail.tsx — open one quote, act on it
// ----------------------------------------------------------------------------
// Wired to quoteService.get / markSent / markOutcome / clone. Shows the full
// internal breakdown (incl. margin — this is the shop's own view, not the
// customer PDF). Actions delegate to the service and refresh.
// ============================================================================

import { useState, useEffect } from 'react';
import { quoteService } from '../services/quoteService';
import { emailService } from '../services/emailService';
import type { Quote } from '../lib/types';

const money = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuoteDetail({ quoteId, onBack }: { quoteId: string; onBack: () => void }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await quoteService.get(quoteId);
    if (res.error) setError(res.error);
    else setQuote(res.data!);
  }
  useEffect(() => { load(); }, [quoteId]);

  async function markOutcome(outcome: 'won' | 'lost') {
    setBusy(true);
    const res = await quoteService.markOutcome(quoteId, outcome);
    if (!res.error) setQuote(res.data!);
    setBusy(false);
  }

  if (error) return <div className="qd-error">Couldn't load quote: {error}</div>;
  if (!quote) return <div className="qd-loading">Loading…</div>;

  const t = quote.totals;
  return (
    <div className="qd">
      <button className="qd-back" onClick={onBack}>← Pipeline</button>
      <div className="qd-head">
        <h2>{quote.inputs.job_name}</h2>
        <span className={`qd-status qd-status--${quote.status}`}>{quote.status}</span>
      </div>
      <div className="qd-meta">{quote.quote_number} · {quote.customer_name ?? '—'}</div>

      <div className="qd-breakdown">
        <Row label="Material" value={money(t.line_material)} />
        <Row label="Labor" value={money(t.line_labor)} />
        <Row label="Burn / machine" value={money(t.line_burn)} />
        <Row label="Consumables" value={money(t.line_consumables)} />
        <Row label="Outside services" value={money(t.line_outside)} />
        <Row label="Shop cost" value={money(t.total_cost)} strong />
        <Row label="+ Overhead" value={money(t.total_overhead)} />
        <Row label="+ Margin" value={money(t.total_margin)} />
        <Row label="Quoted price" value={money(t.quoted_price)} total />
      </div>
      <p className="qd-internal">Cost, overhead &amp; margin are internal — the customer PDF shows scope and total only.</p>

      <div className="qd-actions">
        <button onClick={() => quoteService.clone(quoteId).then((r) => !r.error && onBack())}>Clone</button>
        <button disabled={busy} onClick={() => markOutcome('won')}>Mark won</button>
        <button disabled={busy} onClick={() => markOutcome('lost')}>Mark lost</button>
      </div>
    </div>
  );
}
function Row({ label, value, strong, total }: { label: string; value: string; strong?: boolean; total?: boolean }) {
  return (
    <div className={`qd-row ${total ? 'qd-row--total' : ''} ${strong ? 'qd-row--strong' : ''}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// ============================================================================
// CustomerList.tsx + CustomerForm.tsx — saved customers
// ----------------------------------------------------------------------------
// Wired to customerService. List supports search; form creates/updates. The
// form is reachable both here and inline from the quote editor (shared record).
// ============================================================================

import { customerService } from '../services/customerService';
import type { Customer } from '../lib/types';

export function CustomerList({
  onAdd, onEdit, onNewQuoteFor,
}: { onAdd: () => void; onEdit: (id: string) => void; onNewQuoteFor: (c: Customer) => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    customerService.list(search.trim() || undefined).then((res) => {
      if (!alive) return;
      if (!res.error) setCustomers(res.data!);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [search]);

  return (
    <div className="cl">
      <div className="cl-top">
        <input placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={onAdd}>Add customer</button>
      </div>
      {loading ? <div>Loading…</div> : customers.length === 0 ? (
        <div className="cl-empty">No customers yet. Add one, or they'll be saved as you quote.</div>
      ) : (
        <div className="cl-list">
          {customers.map((c) => (
            <div key={c.id} className="cl-row">
              <div className="cl-name" onClick={() => onEdit(c.id)}>
                {c.company_name}<small>{c.contact_name ?? ''}</small>
              </div>
              <button onClick={() => onNewQuoteFor(c)}>New quote</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerForm({
  customerId, onSaved, onCancel,
}: { customerId?: string; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<Customer>>({ default_terms: 'Net 30' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    customerService.get(customerId).then((res) => { if (!res.error) setForm(res.data!); });
  }, [customerId]);

  const set = (k: keyof Customer, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.company_name?.trim()) { setError('Company name is required.'); return; }
    setSaving(true);
    const res = customerId
      ? await customerService.update(customerId, form)
      : await customerService.create(form as Omit<Customer, 'id'>);
    setSaving(false);
    if (res.error) setError(res.error);
    else onSaved();
  }

  return (
    <div className="cf">
      <Input label="Company name" value={form.company_name ?? ''} onChange={(v) => set('company_name', v)} />
      <Input label="Contact name" value={form.contact_name ?? ''} onChange={(v) => set('contact_name', v)} />
      <Input label="Email" value={form.email ?? ''} onChange={(v) => set('email', v)} />
      <Input label="Phone" value={form.phone ?? ''} onChange={(v) => set('phone', v)} />
      <Input label="Address" value={form.address ?? ''} onChange={(v) => set('address', v)} />
      <Input label="Payment terms" value={form.default_terms ?? ''} onChange={(v) => set('default_terms', v)} />
      {error && <p className="cf-error">{error}</p>}
      <div className="cf-actions">
        <button onClick={onCancel}>Cancel</button>
        <button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save customer'}</button>
      </div>
    </div>
  );
}
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="cf-field"><span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ============================================================================
// RateSettings.tsx — edit the shop rate library
// ----------------------------------------------------------------------------
// Wired to rateService.get / update. Deliberate save (dirty state), and the
// copy reminds the user changes affect future quotes only — which is TRUE
// because quotes snapshot their rates (proven in the slice test).
// ============================================================================

import { rateService } from '../services/rateService';
import type { ShopRates } from '../lib/types';

const RATE_FIELDS: Array<{ key: keyof ShopRates; label: string; prefix?: string; suffix?: string }> = [
  { key: 'rate_cutting', label: 'Cutting / sawing', prefix: '$', suffix: '/hr' },
  { key: 'rate_fitting', label: 'Fitting / assembly', prefix: '$', suffix: '/hr' },
  { key: 'rate_welding', label: 'Welding', prefix: '$', suffix: '/hr' },
  { key: 'rate_finishing', label: 'Finishing / grinding', prefix: '$', suffix: '/hr' },
  { key: 'rate_burn', label: 'Burn rate', prefix: '$', suffix: '/hr' },
  { key: 'price_steel', label: 'Steel price', prefix: '$', suffix: '/lb' },
  { key: 'scrap_pct', label: 'Drop / scrap allowance', suffix: '%' },
  { key: 'rate_consumables', label: 'Consumables', prefix: '$', suffix: '/wh' },
  { key: 'overhead_pct', label: 'Overhead uplift', suffix: '%' },
  { key: 'margin_pct', label: 'Target margin', suffix: '%' },
];

export function RateSettings() {
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rateService.get().then((res) => { if (res.error) setError(res.error); else setRates(res.data!); });
  }, []);

  function set(key: keyof ShopRates, value: string) {
    setRates((r) => (r ? { ...r, [key]: Number(value) || 0 } : r));
    setDirty(true); setSaved(false);
  }

  async function save() {
    if (!rates) return;
    const res = await rateService.update(rates);
    if (res.error) setError(res.error);
    else { setDirty(false); setSaved(true); }
  }

  if (error) return <div className="rs-error">Couldn't load rates: {error}</div>;
  if (!rates) return <div className="rs-loading">Loading rates…</div>;

  return (
    <div className="rs">
      <p className="rs-note">Changes apply to <b>new quotes only</b>. Quotes you've already created keep the rates they were built with.</p>
      <div className="rs-grid">
        {RATE_FIELDS.map((f) => (
          <label key={f.key} className="rs-field">
            <span>{f.label}</span>
            <div className="rs-input">
              {f.prefix && <i>{f.prefix}</i>}
              <input type="number" value={rates[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              {f.suffix && <em>{f.suffix}</em>}
            </div>
          </label>
        ))}
      </div>
      <div className="rs-bar">
        <span className={dirty ? 'rs-dirty' : 'rs-saved'}>
          {dirty ? 'Unsaved changes' : saved ? 'All changes saved' : 'Up to date'}
        </span>
        <button disabled={!dirty} onClick={save}>Save changes</button>
      </div>
    </div>
  );
}
