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
import type { ToastData } from '../app/Toast';
import { materialsTemplateCsv, parseMaterialsFile, mergeMaterials, downloadCsv, MATERIALS_TEMPLATE_FILENAME } from '../app/bulkImport';

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

export function RatesScreen({ notify }: { notify?: (t: ToastData) => void }) {
  const mobile = useIsMobile();
  const [rates, setRates] = useState<ShopRates | null>(null);
  const [tab, setTab] = useState<Tab>('material');
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', price: '' });
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', flexBasis: mobile ? '100%' : undefined }}>Material library ($/lb)</div>
              <button onClick={() => downloadCsv(MATERIALS_TEMPLATE_FILENAME, materialsTemplateCsv())} data-testid="material-template" title="Download a CSV template for bulk upload"
                style={{ marginLeft: mobile ? 0 : 'auto', height: 38, padding: '0 14px', border: `1.5px solid ${color.border}`, borderRadius: 11, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
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
              {(rates.materials ?? []).map((m, i) => (
                <div key={i} data-material={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
                  <input value={m.name} onChange={(e) => editMaterial(i, { name: e.target.value })}
                    style={{ flex: mobile ? '1 1 100%' : 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5, minWidth: 0 }} />
                  <div style={{ display: 'flex', alignItems: 'center', width: mobile ? 'auto' : 160, flex: mobile ? '1 1 auto' : 'none', border: `1.5px solid ${color.border}`, borderRadius: 12, height: 46, padding: '0 14px', minWidth: 0 }}>
                    <span style={{ color: color.faint, fontWeight: 600, marginRight: 4 }}>$</span>
                    <input type="number" step="0.01" value={m.price} onChange={(e) => editMaterial(i, { price: Number(e.target.value) || 0 })} data-material-price={m.name}
                      style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14.5, width: '100%', minWidth: 0 }} />
                    <span style={{ color: color.faint, fontWeight: 600 }}>/lb</span>
                  </div>
                  <button onClick={() => removeMaterial(i)} title="Remove" data-remove-material={m.name}
                    style={{ width: mobile ? 44 : 40, height: mobile ? 44 : 40, flex: 'none', border: 'none', borderRadius: 11, background: '#FFEFF1', color: color.danger, cursor: 'pointer', fontSize: 16 }}><i className="las la-trash" /></button>
                </div>
              ))}
            </div>

            {/* add material */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid #F2F2F8`, flexWrap: mobile ? 'wrap' : 'nowrap' }}>
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="New material (e.g. Galvanized Sheet)" data-testid="new-material-name"
                style={{ flex: mobile ? '1 1 100%' : 1, height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5, minWidth: 0 }} />
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
          <div data-panel="labor" style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: mobile ? 14 : 18 }}>{LABOR.map(numField)}</div>
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
