// ============================================================================
// DetailScreen.tsx — the internal quote-detail view. Shows the FULL breakdown
// (margin/overhead) labeled internal-only, plus customer + activity. Wired to
// quoteService. Styled to design/QuoteForge.dc.html.
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import type { Quote } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money2, statusPill, heading, cardShadowLg, initials } from '../app/ui';
import { CustomerPreviewModal } from './CustomerPreviewModal';
import { useIsMobile } from '../app/useIsMobile';

export function DetailScreen({ quoteId, onBack, onEdit, onChanged }: { quoteId: string; onBack: () => void; onEdit: (id: string) => void; onChanged: () => void }) {
  const [q, setQ] = useState<Quote | null>(null);
  const [preview, setPreview] = useState(false);
  const mobile = useIsMobile();

  const load = useCallback(async () => {
    const res = await quoteService.get(quoteId);
    if (res.data) setQ(res.data);
  }, [quoteId]);
  useEffect(() => { load(); }, [load]);

  async function outcome(o: 'won' | 'lost') {
    await quoteService.markOutcome(quoteId, o);
    onChanged();
    load();
  }
  async function clone() {
    const res = await quoteService.clone(quoteId);
    onChanged();
    if (res.data) onEdit(res.data.id);
  }

  if (!q) return <div style={{ padding: 40, color: color.muted }}>Loading…</div>;
  const pill = statusPill(q.status);
  const t = q.totals;

  const lines: Array<[string, string, boolean]> = [
    ['Material', money2(t.line_material), false],
    ['Fabrication labor', money2(t.line_labor), false],
    ['Machine / burn time', money2(t.line_burn), false],
    ['Consumables', money2(t.line_consumables), false],
    ['Outside services', money2(t.line_outside), false],
    ['Shop cost', money2(t.total_cost), true],
    ['Overhead', money2(t.total_overhead), true],
    ['Margin', money2(t.total_margin), true],
  ];

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '26px 34px 48px' }} data-screen="detail">
      <div onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: color.muted, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 18 }}>
        <i className="las la-arrow-left" /> Pipeline
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 360px', gap: 24, alignItems: 'start' }}>
        <div data-testid="detail-card" style={{ background: color.surface, borderRadius: 22, boxShadow: cardShadowLg, padding: '30px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h2 style={{ margin: 0, fontFamily: heading, fontWeight: 700, fontSize: 26, letterSpacing: '-.3px' }}>{q.inputs.job_name}</h2>
            <span style={{ display: 'inline-block', padding: '6px 15px', borderRadius: 9, fontSize: 13, fontWeight: 700, fontFamily: heading, background: pill.bg, color: pill.color }}>{pill.label}</span>
          </div>
          <div style={{ fontSize: 14, color: color.muted, marginTop: 7 }}>{q.quote_number} · {q.customer_name ?? '—'}</div>

          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lines.map(([label, value, internal]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', borderBottom: `1px solid #F2F2F8`, fontSize: internal ? 14 : 14, color: internal ? color.body : color.ink, fontWeight: internal ? 700 : 400 }}>
                <span>{label}</span><span style={{ fontFamily: heading }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, padding: '20px 22px', background: '#F7F8FF', borderRadius: 16 }}>
            <span style={{ fontFamily: heading, fontWeight: 700, fontSize: 16 }}>Quoted price</span>
            <span style={{ fontFamily: heading, fontWeight: 900, fontSize: 30, color: color.accentDeep }} data-testid="detail-price">{money2(t.quoted_price)}</span>
          </div>
          <p style={{ fontSize: 13, color: color.muted, marginTop: 16, lineHeight: 1.5 }}>
            <i className="las la-lock" style={{ marginRight: 5 }} />Cost, overhead &amp; margin are internal. The customer PDF shows scope and total only.
          </p>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button onClick={() => setPreview(true)} data-testid="preview-send" style={{ height: 46, padding: '0 22px', border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><i className="las la-file-invoice-dollar" />Preview &amp; send</button>
            <button onClick={() => onEdit(q.id)} style={{ height: 46, padding: '0 20px', border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><i className="las la-pen" />Edit quote</button>
            <button onClick={() => outcome('won')} data-testid="mark-won" style={{ height: 46, padding: '0 20px', border: '1.5px solid #C9EFD9', borderRadius: 13, background: color.successBg, color: color.success, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Mark won</button>
            <button onClick={() => outcome('lost')} data-testid="mark-lost" style={{ height: 46, padding: '0 20px', border: '1.5px solid #FAD7DD', borderRadius: 13, background: '#FFEFF1', color: color.danger, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Mark lost</button>
            <button onClick={clone} style={{ height: 46, padding: '0 20px', border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><i className="las la-copy" />Clone</button>
          </div>
        </div>

        {/* side: customer + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: color.surface, borderRadius: 22, boxShadow: cardShadowLg, padding: '24px 26px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px' }}>Customer</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginTop: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#5E81F4,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 16 }}>{initials(q.customer_name)}</div>
              <div><div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15.5 }}>{q.customer_name ?? '—'}</div><div style={{ fontSize: 13, color: color.muted }}>{q.customer_email ?? ''}</div></div>
            </div>
          </div>
          <div style={{ background: color.surface, borderRadius: 22, boxShadow: cardShadowLg, padding: '24px 26px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Activity</div>
            {[['Created', q.created_at], q.sent_at ? ['Sent', q.sent_at] : null]
              .filter(Boolean)
              .map((ev) => (
                <div key={(ev as string[])[0]} style={{ display: 'flex', gap: 13, padding: '11px 0' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(94,129,244,.12)', color: color.accentDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}><i className="las la-circle" /></div>
                  <div><div style={{ fontFamily: heading, fontWeight: 700, fontSize: 14 }}>{(ev as string[])[0]}</div><div style={{ fontSize: 12.5, color: color.muted, marginTop: 1 }} data-mask>{new Date((ev as string[])[1]).toLocaleDateString()}</div></div>
                </div>
              ))}
          </div>
        </div>
      </div>
      {preview && (
        <CustomerPreviewModal quote={q} shopName="Ironside Fabrication" onClose={() => setPreview(false)} onSent={() => { onChanged(); load(); }} />
      )}
    </div>
  );
}
