// ============================================================================
// CustomersScreen.tsx — saved-customer card grid + search + add. Wired to
// customerService. Styled to design/QuoteFoundry.dc.html.
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { customerService } from '../data-access-layer/services/rateService';
import type { Customer } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, cardShadow, initials } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';
import { customersTemplateCsv, parseCustomersFile, downloadCsv, formatUsPhone, CUSTOMERS_TEMPLATE_FILENAME } from '../app/bulkImport';

const AVATARS = ['linear-gradient(135deg,#4667DB,#7C5CFC)', 'linear-gradient(135deg,#2BB6A8,#178F84)', 'linear-gradient(135deg,#F4806A,#E0533B)'];

export function CustomersScreen({ onNewQuote }: { onNewQuote: (c: { id?: string; name: string; email?: string }) => void }) {
  const [list, setList] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ company_name: '', contact_name: '', email: '', phone: '', website: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [importing, setImporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // customer id armed for delete
  const fileRef = useRef<HTMLInputElement>(null);
  const mobile = useIsMobile();

  const load = useCallback(async () => {
    const res = await customerService.list(search.trim() || undefined);
    if (res.data) setList(res.data);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  // Company and email are required (email is where quotes get sent); phone is
  // optional and auto-formats to +1 (xxx) xxx-xxxx as the user types.
  async function add() {
    setFormError(null);
    if (!draft.company_name.trim()) { setFormError('Company name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) { setFormError('A valid email is required — quotes are sent to it.'); return; }
    const res = await customerService.create({ ...draft, email: draft.email.trim(), phone: draft.phone || undefined, website: draft.website || undefined, default_terms: 'Net 30' });
    if (res.error) { setFormError(res.error); return; }
    setDraft({ company_name: '', contact_name: '', email: '', phone: '', website: '' });
    setAdding(false);
    load();
  }

  // Two-step delete: first tap arms the button, second tap deletes. Existing
  // quotes keep their snapshotted customer info, so this never breaks a quote.
  async function removeCustomer(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((v) => (v === id ? null : v)), 3500);
      return;
    }
    setConfirmDelete(null);
    await customerService.remove(id);
    load();
  }

  // Bulk upload: parse the CSV/XLSX, create one row per parsed customer.
  // Rows the parser skipped (no company name) are reported, never guessed.
  async function importFile(file: File) {
    setImporting(true);
    setImportMsg(null);
    const parsed = parseCustomersFile(await file.arrayBuffer());
    if (parsed.error || parsed.customers.length === 0) {
      setImportMsg({ text: parsed.error ?? 'No customers found in that file.', ok: false });
      setImporting(false);
      return;
    }
    let created = 0, failed = 0;
    for (const c of parsed.customers) {
      const res = await customerService.create(c);
      res.error ? failed++ : created++;
    }
    const parts = [`${created} customer${created === 1 ? '' : 's'} imported`];
    if (parsed.skipped) parts.push(`${parsed.skipped} row${parsed.skipped === 1 ? '' : 's'} skipped (no company name)`);
    if (failed) parts.push(`${failed} failed to save`);
    setImportMsg({ text: parts.join(' · '), ok: failed === 0 });
    setImporting(false);
    load();
  }

  const field: React.CSSProperties = { height: 42, border: `1.5px solid ${color.border}`, borderRadius: 11, padding: '0 12px', fontSize: 14, flex: 1, minWidth: 0 };

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '30px 34px 48px' }} data-screen="customers">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: 13, padding: '0 16px', height: 46, width: 320, maxWidth: '40vw' }}>
          <i className="las la-search" style={{ color: '#B6B6CC', fontSize: 17 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" data-testid="customer-search"
            style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14 }} />
        </div>
        <button onClick={() => downloadCsv(CUSTOMERS_TEMPLATE_FILENAME, customersTemplateCsv())} data-testid="customer-template" title="Download a CSV template for bulk upload"
          style={{ marginLeft: 'auto', height: 46, padding: '0 18px', border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="las la-download" />Template
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing} data-testid="customer-import"
          style={{ height: 46, padding: '0 18px', border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: importing ? 0.7 : 1 }}>
          <i className={importing ? 'las la-spinner' : 'las la-file-upload'} style={importing ? { animation: 'qfSpin 1s linear infinite' } : undefined} />{importing ? 'Importing…' : 'Import list'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" data-testid="customer-import-input" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
        <button onClick={() => setAdding((v) => !v)} data-testid="add-customer"
          style={{ height: 46, padding: '0 22px', border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="las la-user-plus" />Add customer
        </button>
      </div>

      {importMsg && (
        <div data-testid="import-result" style={{ display: 'flex', alignItems: 'center', gap: 10, background: importMsg.ok ? color.successBg : '#FFEFF1', border: `1px solid ${importMsg.ok ? '#C9EFD9' : '#FAD7DD'}`, borderRadius: 14, padding: '12px 16px', marginBottom: 18, fontSize: 13.5, color: importMsg.ok ? color.success : color.danger, fontWeight: 600 }}>
          <i className={importMsg.ok ? 'las la-check-circle' : 'las la-exclamation-circle'} style={{ fontSize: 17 }} />{importMsg.text}
        </div>
      )}

      {adding && (
        <div style={{ background: color.surface, borderRadius: 18, padding: 18, marginBottom: 20, boxShadow: cardShadow }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input style={field} placeholder="Company *" value={draft.company_name} onChange={(e) => setDraft((d) => ({ ...d, company_name: e.target.value }))} data-testid="new-company" aria-label="Company (required)" />
            <input style={field} placeholder="Contact" value={draft.contact_name} onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))} aria-label="Contact name" />
            <input style={field} type="email" placeholder="Email *" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} data-testid="new-email" aria-label="Email (required)" />
            <input style={field} type="tel" placeholder="Phone — +1 (713) 555-0142" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: formatUsPhone(e.target.value) }))} data-testid="new-phone" aria-label="Phone (optional)" />
            <input style={field} placeholder="Website" value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} aria-label="Website (optional)" />
            <button onClick={add} data-testid="save-customer" style={{ height: 42, padding: '0 18px', border: 'none', borderRadius: 11, background: color.accentDeep, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Save</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 12.5, color: color.muted }}>*Required field</span>
            {formError && <span data-testid="customer-form-error" style={{ fontSize: 13, fontWeight: 600, color: color.danger }}><i className="las la-exclamation-circle" /> {formError}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: 20 }}>
        {list.map((c, i) => (
          <div key={c.id} data-customer={c.company_name} style={{ background: color.surface, borderRadius: 20, padding: 24, boxShadow: cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 50, height: 50, borderRadius: 15, background: AVATARS[i % AVATARS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 18 }}>{initials(c.company_name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.company_name}</div>
                <div style={{ fontSize: 13, color: color.muted }}>{c.contact_name ?? '—'}</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, color: color.body }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><i className="las la-envelope" style={{ color: '#C2C2D6', width: 17 }} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email ?? '—'}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><i className="las la-phone" style={{ color: '#C2C2D6', width: 17 }} />{c.phone ?? '—'}</div>
              {c.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><i className="las la-globe" style={{ color: '#C2C2D6', width: 17 }} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.website}</span></div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <span style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 11, background: color.appBg, color: color.body, fontSize: 12.5, fontWeight: 700, fontFamily: heading }}>{c.default_terms ?? 'Net 30'}</span>
              <button onClick={() => onNewQuote({ id: c.id, name: c.company_name, email: c.email })} data-testid="cust-new-quote" style={{ flex: 1, padding: 9, border: 'none', borderRadius: 11, background: 'rgba(70,103,219,.12)', color: color.accentDeep, fontSize: 12.5, fontWeight: 700, fontFamily: heading, cursor: 'pointer' }}>New quote</button>
              <button onClick={() => removeCustomer(c.id)} data-testid="delete-customer" title={confirmDelete === c.id ? 'Click again to delete' : 'Delete customer'}
                aria-label={confirmDelete === c.id ? `Confirm delete ${c.company_name}` : `Delete ${c.company_name}`}
                style={{ width: 40, padding: 9, border: 'none', borderRadius: 11, background: confirmDelete === c.id ? color.danger : '#FFEFF1', color: confirmDelete === c.id ? '#fff' : color.danger, fontSize: 14, cursor: 'pointer' }}>
                <i className={confirmDelete === c.id ? 'las la-exclamation' : 'las la-trash'} />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px 20px', color: color.muted }}>No customers yet.</div>
        )}
      </div>
    </div>
  );
}
