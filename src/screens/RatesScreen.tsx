// ============================================================================
// RatesScreen.tsx — the shop rate library, split into 3 sub-tabs:
//   Material : the material library (name + $/lb) with add/remove, + scrap %
//   Labor    : labor + machine + consumables $/hr rates
//   Margin   : overhead % and target margin %
// The amber banner promises "applies to new quotes only" — TRUE in code: quotes
// price from their own frozen snapshot (CLAUDE.md §4.2).
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { rateService } from '../data-access-layer/services/rateService';
import type { ShopRates, Material } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, cardShadowLg } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';
import { ScrollCarousel } from '../app/ScrollCarousel';
import type { ToastData } from '../app/Toast';
import { materialsTemplateCsv, parseMaterialsFile, mergeMaterials, downloadCsv, MATERIALS_TEMPLATE_FILENAME } from '../app/bulkImport';
import { STARTER_CATALOG, MATERIAL_CATEGORIES, TOP_MATERIALS, groupByCategory } from '../data-access-layer/lib/materialCatalog';
import { LABOR_REGIONS, regionalRates } from '../data-access-layer/lib/laborRegions';
import { swatchStyle } from '../app/materialSwatches';

type Tab = 'material' | 'labor' | 'margin';
type NumKey = keyof Omit<ShopRates, 'materials'>;
type Field = { key: NumKey; label: string; prefix?: string; suffix?: string };

const LABOR: Field[] = [
  { key: 'rate_cutting', label: 'Cutting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_fitting', label: 'Fitting labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_welding', label: 'Welding labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_finishing', label: 'Finishing labor', prefix: '$', suffix: '/hr' },
  { key: 'rate_setup', label: 'Setup & programming', prefix: '$', suffix: '/hr' },
  { key: 'rate_burn', label: 'Burn rate (plasma/laser)', prefix: '$', suffix: '/hr' },
  { key: 'rate_consumables', label: 'Consumables', prefix: '$', suffix: '/wh' },
];
const MARGIN: Field[] = [
  { key: 'overhead_pct', label: 'Overhead uplift', suffix: '%' },
  { key: 'margin_pct', label: 'Target margin', suffix: '%' },
];

export function RatesScreen({ notify }: { notify?: (t: ToastData) => void }) {
  const mobile = useIsMobile();
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [tab, setTab] = useState<Tab>('material');
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', price: '', category: '' });
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [laborMsg, setLaborMsg] = useState<string | null>(null);
  const [region, setRegion] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Pre-migration rows (and the mock) have no rate_setup — surface the engine's
  // UI default (75) here so the field is editable, not a blank uncontrolled input.
  useEffect(() => { rateService.get().then((r) => r.data && setRates({ ...r.data, rate_setup: r.data.rate_setup ?? 75 })); }, []);

  function patch(p: Partial<ShopRates>) { setRates((prev) => (prev ? { ...prev, ...p } : prev)); setStatus('dirty'); }
  function setNum(key: NumKey, v: number) { patch({ [key]: v } as Partial<ShopRates>); }

  function addMaterial() {
    const name = draft.name.trim();
    const price = Number(draft.price);
    if (!name || !(price > 0) || !rates) return;
    patch({ materials: [...(rates.materials ?? []), { name, price, category: draft.category || undefined }] });
    setDraft({ name: '', price: '', category: '' });
  }

  // One-tap add from a reference card. Same merge path as everything else, so
  // the change lands as a normal dirty edit the owner reviews and Saves.
  function addOneFromCatalog(name: string) {
    if (!rates) return;
    const entry = STARTER_CATALOG.find((m) => m.name === name);
    if (!entry) return;
    const { materials, added } = mergeMaterials(rates.materials ?? [], [entry]);
    patch({ materials });
    setImportMsg({ text: added ? `${name} added at the reference price — review and Save.` : `${name} updated to the reference price — review and Save.`, ok: true });
  }

  // Prefill the five labor rates from a regional reference preset. A prefill,
  // not persisted state — the normal review-and-Save path applies it.
  function applyRegion(key: string) {
    const region = LABOR_REGIONS.find((r) => r.key === key);
    if (!region || !rates) return;
    patch(regionalRates(region.multiplier));
    setLaborMsg(`Applied ${region.label} reference rates — review, adjust to your shop, then Save.`);
  }

  // Merge the starter catalog (SendCutSend-inspired reference list) into the
  // library. Same mergeMaterials path as file import: existing names keep their
  // shop-set price only if it already matches; review-and-Save applies as usual.
  function addFromCatalog() {
    if (!rates) return;
    const { materials, added, updated } = mergeMaterials(rates.materials ?? [], STARTER_CATALOG);
    patch({ materials });
    setImportMsg({
      text: added || updated
        ? `Starter catalog merged — ${added} added, ${updated} price${updated === 1 ? '' : 's'} updated. Prices are references: adjust to your supplier, then Save.`
        : 'Your library already covers the starter catalog.',
      ok: true,
    });
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

  // Bulk upload: merge into the library (same name updates price, new names
  // append), mark dirty — the user reviews and hits Save like any other edit,
  // so imported prices only reach NEW quotes via the normal snapshot path.
  async function importFile(file: File) {
    if (!rates) return;
    setImportMsg(null);
    const parsed = parseMaterialsFile(await file.arrayBuffer());
    if (parsed.error || parsed.materials.length === 0) {
      setImportMsg({ text: parsed.error ?? 'No materials found in that file.', ok: false });
      return;
    }
    const { materials, added, updated } = mergeMaterials(rates.materials ?? [], parsed.materials);
    patch({ materials });
    const parts = [];
    if (added) parts.push(`${added} material${added === 1 ? '' : 's'} added`);
    if (updated) parts.push(`${updated} price${updated === 1 ? '' : 's'} updated`);
    if (!added && !updated) parts.push('No changes — library already matches the file');
    if (parsed.skipped) parts.push(`${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} skipped`);
    setImportMsg({ text: parts.join(' · ') + (added || updated ? ' — review and Save' : ''), ok: true });
  }

  async function save() {
    if (!rates) return;
    setStatus('saving');
    setSaveError(null);
    const res = await rateService.update(rates);
    if (res.error) {
      // never claim "Saved" on a failed write — that's how data silently vanishes
      setStatus('error');
      setSaveError(res.error);
      return;
    }
    setRates(res.data); // reflect exactly what the DB now holds
    setStatus('saved');
    notify?.({ message: 'Rates saved — applies to new quotes only.' });
  }

  if (!rates) return <div style={{ padding: 40, color: color.muted }}>Loading rates…</div>;

  const statusText = { clean: 'All changes saved', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: `Save failed — ${saveError ?? 'try again'}` }[status];
  const statusColor = status === 'dirty' || status === 'error' ? color.danger : status === 'saved' ? color.success : color.muted;

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
    <div style={{ padding: mobile ? '18px 16px 40px' : '30px 34px 48px', maxWidth: 920 }} data-screen="rates">
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

      <div style={{ background: color.surface, borderRadius: 22, padding: mobile ? '18px 16px' : '28px 30px', boxShadow: cardShadowLg }}>
        {tab === 'material' && (
          <div data-panel="material">
            {/* MARKET REFERENCE CARDS — SendCutSend-style visual catalog. Tap +
                to drop the reference into the library; ✓ = already there. */}
            <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
              Market reference — common materials
            </div>
            {(() => {
              const cards = TOP_MATERIALS.map((name) => {
                const entry = STARTER_CATALOG.find((m) => m.name === name)!;
                const inLibrary = (rates.materials ?? []).some((m) => m.name.toLowerCase() === name.toLowerCase());
                return (
                  <div key={name} data-catalog-card={name}
                    style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${color.borderSoft}`, background: color.surface, ...(mobile ? { minWidth: 150, scrollSnapAlign: 'start', flex: 'none' } : {}) }}>
                    <div style={{ height: 84, ...swatchStyle(entry) }} />
                    {/* price chip over the swatch */}
                    <span style={{ position: 'absolute', top: 58, left: 10, background: 'rgba(255,255,255,.94)', borderRadius: 8, padding: '3px 9px', fontFamily: heading, fontWeight: 700, fontSize: 12.5, color: color.ink, boxShadow: '0 4px 10px -4px rgba(0,0,0,.4)' }}>
                      ${entry.price.toFixed(2)}/lb
                    </span>
                    {/* one-tap add */}
                    <button onClick={() => addOneFromCatalog(name)} disabled={inLibrary} data-catalog-add={name}
                      title={inLibrary ? 'Already in your library' : `Add ${name} at the reference price`}
                      aria-label={inLibrary ? `${name} already in library` : `Add ${name}`}
                      style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, border: 'none', borderRadius: 10, cursor: inLibrary ? 'default' : 'pointer', fontSize: 15, background: inLibrary ? color.successBg : 'rgba(255,255,255,.94)', color: inLibrary ? color.success : color.accentDeep, boxShadow: '0 4px 10px -4px rgba(0,0,0,.4)' }}>
                      <i className={inLibrary ? 'las la-check' : 'las la-plus'} />
                    </button>
                    <div style={{ padding: '9px 12px 11px', fontFamily: heading, fontWeight: 700, fontSize: 13, color: color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                      <div style={{ fontSize: 11, fontWeight: 600, color: color.faint, fontFamily: 'inherit', marginTop: 1 }}>{entry.category}</div>
                    </div>
                  </div>
                );
              });
              // Desktop: 5-up grid. Mobile: swipeable row with side arrows (no
              // visible scrollbar), matching the pipeline charts pattern.
              return mobile
                ? <div style={{ marginBottom: 10 }}><ScrollCarousel gap={12} bleed={16} testId="material-scroller">{cards}</ScrollCarousel></div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 10 }}>{cards}</div>;
            })()}
            <div style={{ fontSize: 12, color: color.muted, lineHeight: 1.6, marginBottom: 18 }}>
              Reference prices, not live market data — verify against your supplier's quote sheet and current market:{' '}
              <a href="https://agmetalminer.com/metal-prices/carbon-steel/" target="_blank" rel="noopener" style={{ color: color.accentDeep, fontWeight: 700 }}>MetalMiner steel prices</a>{' · '}
              <a href="https://www.materialpricebook.com/prices" target="_blank" rel="noopener" style={{ color: color.accentDeep, fontWeight: 700 }}>Material Price Book</a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', flexBasis: mobile ? '100%' : undefined }}>Material library ($/lb)</div>
              <button onClick={addFromCatalog} data-testid="material-catalog" title="Add common fab/machining materials with reference prices"
                style={{ marginLeft: mobile ? 0 : 'auto', height: 38, padding: '0 14px', border: `1.5px solid ${color.border}`, borderRadius: 11, background: '#fff', color: color.accentDeep, fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="las la-book" />Add from catalog
              </button>
              <button onClick={() => downloadCsv(MATERIALS_TEMPLATE_FILENAME, materialsTemplateCsv())} data-testid="material-template" title="Download a CSV template for bulk upload"
                style={{ height: 38, padding: '0 14px', border: `1.5px solid ${color.border}`, borderRadius: 11, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="las la-download" />Template
              </button>
              <button onClick={() => fileRef.current?.click()} data-testid="material-import"
                style={{ height: 38, padding: '0 14px', border: `1.5px solid ${color.border}`, borderRadius: 11, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                <i className="las la-file-upload" />Import list
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" data-testid="material-import-input" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
            </div>
            {importMsg && (
              <div data-testid="material-import-result" style={{ display: 'flex', alignItems: 'center', gap: 9, background: importMsg.ok ? color.successBg : '#FFEFF1', border: `1px solid ${importMsg.ok ? '#C9EFD9' : '#FAD7DD'}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: importMsg.ok ? color.success : color.danger, fontWeight: 600 }}>
                <i className={importMsg.ok ? 'las la-check-circle' : 'las la-exclamation-circle'} style={{ fontSize: 16 }} />{importMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* grouped by category (catalog order, shop categories, then uncategorized);
                  rows carry their original index so edits target the right entry */}
              {groupByCategory((rates.materials ?? []).map((m, i) => ({ ...m, idx: i }))).map((group) => (
                <div key={group.category}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.6px', margin: '8px 0 8px 2px' }} data-material-group={group.category}>
                    {group.category}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.items.map((m) => (
                      <div key={m.idx} data-material={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
                        <input value={m.name} onChange={(e) => editMaterial(m.idx, { name: e.target.value })}
                          style={{ flex: mobile ? '1 1 100%' : 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5, minWidth: 0 }} />
                        <select value={m.category ?? ''} onChange={(e) => editMaterial(m.idx, { category: e.target.value || undefined })} data-material-category={m.name}
                          style={{ width: mobile ? 'auto' : 150, flex: mobile ? '1 1 auto' : 'none', height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 10px', fontSize: 13.5, color: m.category ? color.ink : color.faint, background: '#fff', minWidth: 0 }}>
                          <option value="">No category</option>
                          {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          {m.category && !(MATERIAL_CATEGORIES as readonly string[]).includes(m.category) && (
                            <option value={m.category}>{m.category}</option>
                          )}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', width: mobile ? 'auto' : 160, flex: mobile ? '1 1 auto' : 'none', border: `1.5px solid ${color.border}`, borderRadius: 12, height: 46, padding: '0 14px', minWidth: 0 }}>
                          <span style={{ color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span>
                          <input type="number" step="0.01" value={m.price} onChange={(e) => editMaterial(m.idx, { price: Number(e.target.value) || 0 })} data-material-price={m.name}
                            style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%', minWidth: 0 }} />
                          <span style={{ color: color.faint, fontWeight: 600 }}>/lb</span>
                        </div>
                        <button onClick={() => removeMaterial(m.idx)} title="Remove" data-remove-material={m.name}
                          style={{ width: mobile ? 44 : 40, height: mobile ? 44 : 40, flex: 'none', border: 'none', borderRadius: 11, background: '#FFEFF1', color: color.danger, cursor: 'pointer', fontSize: 16 }}><i className="las la-trash" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* add material */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid #F2F2F8`, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="New material (e.g. Galvanized Sheet)" data-testid="new-material-name"
                style={{ flex: mobile ? '1 1 100%' : 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5, minWidth: 0 }} />
              <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} data-testid="new-material-category"
                style={{ width: mobile ? 'auto' : 150, flex: mobile ? '1 1 auto' : 'none', height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 10px', fontSize: 13.5, color: draft.category ? color.ink : color.faint, background: '#fff', minWidth: 0 }}>
                <option value="">No category</option>
                {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', width: mobile ? 'auto' : 160, flex: mobile ? '1 1 auto' : 'none', border: `1.5px solid ${color.border}`, borderRadius: 12, height: 46, padding: '0 14px', minWidth: 0 }}>
                <span style={{ color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span>
                <input type="number" step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="0.00" data-testid="new-material-price"
                  style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%', minWidth: 0 }} />
                <span style={{ color: color.faint, fontWeight: 600 }}>/lb</span>
              </div>
              <button onClick={addMaterial} data-testid="add-material"
                style={{ height: 46, padding: '0 18px', flex: 'none', border: 'none', borderRadius: 12, background: color.accentDeep, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <i className="las la-plus" /> Add
              </button>
            </div>

            <div style={{ marginTop: 22, maxWidth: 260 }}>{numField({ key: 'scrap_pct', label: 'Drop / scrap allowance', suffix: '%' })}</div>
          </div>
        )}

        {tab === 'labor' && (
          <div data-panel="labor">
            {/* REGION PREFILL — reference starting points, applied as a normal
                dirty edit (review-and-Save). Burn/consumables stay untouched:
                machine cost isn't regional the way labor is. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: color.body, fontFamily: heading }}>Prefill from your region</span>
              <select value={region} data-testid="labor-region"
                onChange={(e) => { setRegion(e.target.value); applyRegion(e.target.value); }}
                style={{ height: 44, minWidth: 260, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 12px', fontSize: 14, color: region ? color.ink : color.faint, background: '#fff' }}>
                <option value="">— choose region —</option>
                {LABOR_REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label} ({r.hint})</option>)}
              </select>
            </div>
            {laborMsg && (
              <div data-testid="labor-region-msg" style={{ display: 'flex', alignItems: 'center', gap: 9, background: color.successBg, border: '1px solid #C9EFD9', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: color.success, fontWeight: 600 }}>
                <i className="las la-check-circle" style={{ fontSize: 16 }} />{laborMsg}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 14 : 18, marginTop: laborMsg ? 0 : 10 }}>{LABOR.map(numField)}</div>
            <div style={{ fontSize: 12, color: color.muted, lineHeight: 1.6, marginTop: 16 }}>
              Regional presets are reference points from public wage data — your billed rate is wages × overhead burden × utilization. Check your area:{' '}
              <a href="https://www.bls.gov/oes/current/oes514121.htm" target="_blank" rel="noopener" style={{ color: color.accentDeep, fontWeight: 700 }}>BLS wages — Welders</a>{' · '}
              <a href="https://www.bls.gov/oes/current/oes514041.htm" target="_blank" rel="noopener" style={{ color: color.accentDeep, fontWeight: 700 }}>BLS wages — Machinists</a>
            </div>
          </div>
        )}

        {tab === 'margin' && (
          <div data-panel="margin" style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 14 : 18 }}>{MARGIN.map(numField)}</div>
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
