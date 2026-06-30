// ============================================================================
// QuoteEditor.tsx — the vertical slice
// ----------------------------------------------------------------------------
// Wires the editor screen end to end:
//   load shop rates (rateService) -> live compute on keystroke (quoteEngine)
//   -> save (quoteService.create, which snapshots rates) -> show saved state.
//
// This is the proof the whole stack works as one: the SAME computeQuote that
// drives the on-screen total is the one quoteService runs at save, so the
// number the estimator sees is provably the number that gets stored.
// ============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { computeQuote } from '../lib/quoteEngine';
import { quoteService } from '../services/quoteService';
import { rateService } from '../services/rateService';
import type { QuoteInputs, ShopRates } from '../lib/types';

const EMPTY_INPUTS: QuoteInputs = {
  job_name: '',
  material_spec: '',
  material_weight: 0,
  quantity: 1,
  burn_minutes: 0,
  hrs_cutting: 0,
  hrs_fitting: 0,
  hrs_welding: 0,
  hrs_finishing: 0,
  outside_services: 0,
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const money = (n: number) =>
  '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function QuoteEditor({ onSaved }: { onSaved?: (quoteId: string) => void }) {
  // --- state ---------------------------------------------------------------
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<QuoteInputs>(EMPTY_INPUTS);
  const [customer, setCustomer] = useState({ name: '', email: '' });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- load the shop's rates once on mount --------------------------------
  // The editor cannot compute anything until it has the rate library. If this
  // fails (e.g. shop not bootstrapped), we say so plainly rather than render a
  // broken form.
  useEffect(() => {
    let alive = true;
    rateService.get().then((res) => {
      if (!alive) return;
      if (res.error) setLoadError(res.error);
      else setRates(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  // --- live compute: re-runs on every input change ------------------------
  // useMemo so it only recomputes when inputs or rates actually change. This is
  // the exact same function quoteService runs at save time.
  const totals = useMemo(
    () => (rates ? computeQuote(inputs, rates) : null),
    [inputs, rates]
  );

  const setField = useCallback(
    (key: keyof QuoteInputs, value: string) => {
      setInputs((prev) => ({
        ...prev,
        [key]: key === 'job_name' || key === 'material_spec' ? value : Number(value) || 0,
      }));
      // editing after a save returns us to 'idle' (unsaved changes)
      setSaveState((s) => (s === 'saved' ? 'idle' : s));
    },
    []
  );

  // --- save: delegates to quoteService, which snapshots + computes ---------
  const handleSave = useCallback(async () => {
    if (!inputs.job_name.trim()) {
      setSaveError('Add a job name before saving.');
      setSaveState('error');
      return;
    }
    setSaveState('saving');
    setSaveError(null);
    const res = await quoteService.create(inputs, {
      name: customer.name || undefined,
      email: customer.email || undefined,
    });
    if (res.error) {
      setSaveError(res.error);
      setSaveState('error');
      return;
    }
    setSaveState('saved');
    onSaved?.(res.data!.id);
  }, [inputs, customer, onSaved]);

  // --- render states -------------------------------------------------------
  if (loadError) {
    return (
      <div className="qe-state qe-state--error">
        <p>Couldn't load your shop rates: {loadError}</p>
        <p className="qe-hint">Finish onboarding to set your rates, then come back to quote.</p>
      </div>
    );
  }
  if (!rates || !totals) {
    return <div className="qe-state">Loading your rates…</div>;
  }

  // --- the editor ----------------------------------------------------------
  return (
    <div className="qe">
      <div className="qe-grid">
        {/* LEFT: job inputs */}
        <div className="qe-inputs">
          <div className="qe-two">
            <Field label="Customer" value={customer.name}
              onChange={(v) => setCustomer((c) => ({ ...c, name: v }))} placeholder="Apex Industrial" />
            <Field label="Email" value={customer.email}
              onChange={(v) => setCustomer((c) => ({ ...c, email: v }))} placeholder="purchasing@apex.com" />
          </div>

          <Field label="Job name" value={inputs.job_name}
            onChange={(v) => setField('job_name', v)} placeholder="Stair stringers (pair)" />

          <Group title="Material">
            <NumField label="Weight" suffix="lb" value={inputs.material_weight}
              onChange={(v) => setField('material_weight', v)} />
            <NumField label="Quantity" suffix="ea" value={inputs.quantity}
              onChange={(v) => setField('quantity', v)} />
          </Group>

          <Group title="Labor (hours)">
            <NumField label="Cutting" suffix="hr" value={inputs.hrs_cutting}
              onChange={(v) => setField('hrs_cutting', v)} />
            <NumField label="Fitting" suffix="hr" value={inputs.hrs_fitting}
              onChange={(v) => setField('hrs_fitting', v)} />
            <NumField label="Welding" suffix="hr" value={inputs.hrs_welding}
              onChange={(v) => setField('hrs_welding', v)} />
            <NumField label="Finishing" suffix="hr" value={inputs.hrs_finishing}
              onChange={(v) => setField('hrs_finishing', v)} />
          </Group>

          <Group title="Machine & outside">
            <NumField label="Burn time" suffix="min" value={inputs.burn_minutes}
              onChange={(v) => setField('burn_minutes', v)} />
            <NumField label="Outside services" prefix="$" value={inputs.outside_services}
              onChange={(v) => setField('outside_services', v)} />
          </Group>
        </div>

        {/* RIGHT: live breakdown */}
        <div className="qe-summary">
          <div className="qe-stitle">Cost breakdown</div>
          <Line label="Material" value={money(totals.line_material)} />
          <Line label="Labor" value={money(totals.line_labor)} />
          <Line label="Burn / machine" value={money(totals.line_burn)} />
          <Line label="Consumables" value={money(totals.line_consumables)} />
          <Line label="Outside services" value={money(totals.line_outside)} />

          <div className="qe-sub"><span>Shop cost</span><span>{money(totals.total_cost)}</span></div>
          <div className="qe-sub"><span>+ Overhead</span><span>{money(totals.total_overhead)}</span></div>
          <div className="qe-sub"><span>+ Margin</span><span>{money(totals.total_margin)}</span></div>

          <div className="qe-total">
            <span>Quoted price</span>
            <strong>{money(totals.quoted_price)}</strong>
          </div>
          <div className="qe-unit">{money(totals.per_unit)} per unit · qty {inputs.quantity}</div>

          <button className="qe-save" onClick={handleSave} disabled={saveState === 'saving'}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save quote'}
          </button>
          {saveState === 'error' && <p className="qe-saveerr">{saveError}</p>}
          {saveState === 'saved' && (
            <p className="qe-savedmsg">Quote saved with today's rates locked in.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- small presentational helpers (kept local to the slice) ----------------
function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="qe-field">
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function NumField({ label, value, onChange, suffix, prefix }: {
  label: string; value: number; onChange: (v: string) => void; suffix?: string; prefix?: string;
}) {
  return (
    <label className="qe-numfield">
      <span>{label}</span>
      <div className="qe-numwrap">
        {prefix && <i className="qe-pre">{prefix}</i>}
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <i className="qe-suf">{suffix}</i>}
      </div>
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="qe-group">
      <div className="qe-glabel">{title}</div>
      {children}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="qe-line">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
