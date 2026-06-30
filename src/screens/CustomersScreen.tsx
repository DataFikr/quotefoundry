// ============================================================================
// CustomersScreen.tsx — saved-customer card grid + search + add. Wired to
// customerService. Styled to design/QuoteForge.dc.html.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../data-access-layer/services/rateService';
import type { Customer } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, cardShadow, initials } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';

const AVATARS = ['linear-gradient(135deg,#5E81F4,#7C5CFC)', 'linear-gradient(135deg,#2BB6A8,#178F84)', 'linear-gradient(135deg,#F4806A,#E0533B)'];

export function CustomersScreen({ onNewQuote }: { onNewQuote: () => void }) {
  const [list, setList] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ company_name: '', contact_name: '', email: '', phone: '' });
  const mobile = useIsMobile();

  const load = useCallback(async () => {
    const res = await customerService.list(search.trim() || undefined);
    if (res.data) setList(res.data);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!draft.company_name.trim()) return;
    await customerService.create({ ...draft, default_terms: 'Net 30' });
    setDraft({ company_name: '', contact_name: '', email: '', phone: '' });
    setAdding(false);
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
        <button onClick={() => setAdding((v) => !v)} data-testid="add-customer"
          style={{ marginLeft: 'auto', height: 46, padding: '0 22px', border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="las la-user-plus" />Add customer
        </button>
      </div>

      {adding && (
        <div style={{ background: color.surface, borderRadius: 18, padding: 18, marginBottom: 20, boxShadow: cardShadow, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input style={field} placeholder="Company *" value={draft.company_name} onChange={(e) => setDraft((d) => ({ ...d, company_name: e.target.value }))} data-testid="new-company" />
          <input style={field} placeholder="Contact" value={draft.contact_name} onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))} />
          <input style={field} placeholder="Email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
          <button onClick={add} data-testid="save-customer" style={{ height: 42, padding: '0 18px', border: 'none', borderRadius: 11, background: color.accentDeep, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Save</button>
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
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <span style={{ flex: 1, textAlign: 'center', padding: 9, borderRadius: 11, background: color.appBg, color: color.body, fontSize: 12.5, fontWeight: 700, fontFamily: heading }}>{c.default_terms ?? 'Net 30'}</span>
              <button onClick={onNewQuote} style={{ flex: 1, padding: 9, border: 'none', borderRadius: 11, background: 'rgba(94,129,244,.12)', color: color.accentDeep, fontSize: 12.5, fontWeight: 700, fontFamily: heading, cursor: 'pointer' }}>New quote</button>
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
