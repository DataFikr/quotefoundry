// ============================================================================
// CustomerPreviewModal.tsx — the customer-facing quote preview (the in-app
// equivalent of the PDF / #qf-print). Shows scope + total ONLY; margin,
// overhead and bare cost never appear here (CLAUDE.md §4.4). "Send" calls
// emailService, which the server re-verifies for ownership.
// ============================================================================
import { useState } from 'react';
import { emailService } from '../email-integration/services/emailService';
import { customerScope } from '../app/customerScope';
import type { Quote } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money2, heading } from '../app/ui';

const BLUE_DK = '#042C53';
const BLUE = '#185FA5';
const GREEN_DK = '#04342C';
const GREEN_LT = '#E1F5EE';

export function CustomerPreviewModal({ quote, shopName, onClose, onSent }: { quote: Quote; shopName: string; onClose: () => void; onSent: () => void }) {
  const { lines, subtotal, fees, total } = customerScope(quote);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setSending(true);
    const defaults = emailService.buildDefaults({ ...quote.inputs, ...quote, quoted_price: quote.quoted_price });
    const res = await emailService.sendQuote({
      quoteId: quote.id, recipient: quote.customer_email ?? defaults.recipient,
      subject: defaults.subject, message: defaults.message, pdfBase64: '',
    });
    setSending(false);
    if (res.data) { setSent(true); onSent(); }
  }

  return (
    <div onClick={onClose} data-testid="preview-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,20,45,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} data-testid="qf-print"
        style={{ width: 700, maxWidth: '94vw', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", color: '#1A1A1A' }}>
        {/* header band */}
        <div style={{ background: BLUE_DK, color: '#fff', padding: '22px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.5px' }}>{shopName.toUpperCase()}</div>
            <div style={{ fontSize: 9, color: '#B5D4F4', marginTop: 3 }}>Custom steel fabrication</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 19 }}>QUOTE</div>
            <div style={{ fontSize: 9, color: '#B5D4F4', marginTop: 3 }}>No. {quote.quote_number}</div>
          </div>
        </div>
        <div style={{ height: 3, background: '#0F6E56' }} />

        <div style={{ padding: '24px 34px 30px' }}>
          {/* quote-for / details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#5F6B7A' }}>QUOTE FOR</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{quote.customer_name ?? '—'}</div>
              <div style={{ fontSize: 11, color: '#5F6B7A' }}>{quote.customer_email ?? ''}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#5F6B7A' }}>
              <div>Date: <span data-mask>{new Date(quote.created_at).toLocaleDateString()}</span></div>
              <div>Valid: 30 days</div>
              <div>Qty: {quote.inputs.quantity} ea</div>
            </div>
          </div>

          {/* job strip */}
          <div style={{ background: '#E6F1FB', borderRadius: 4, padding: '10px 14px', marginBottom: 18 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#5F6B7A' }}>JOB</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: BLUE_DK }}>{quote.inputs.job_name}</div>
          </div>

          {/* scope table */}
          <div style={{ fontWeight: 700, fontSize: 11, color: BLUE, marginBottom: 8 }}>Scope of work</div>
          <div style={{ background: BLUE, color: '#fff', display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 9, fontWeight: 700 }}>
            <span>Description</span><span>Amount</span>
          </div>
          {lines.map((l, i) => (
            <div key={l.label} data-scope-line style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: i % 2 ? '#F5F8FC' : '#fff', borderBottom: '0.5px solid #D8DEE4' }}>
              <div><div style={{ fontSize: 11 }}>{l.label}</div><div style={{ fontSize: 9, color: '#5F6B7A' }}>{l.detail}</div></div>
              <div style={{ fontSize: 11 }}>{money2(l.amount)}</div>
            </div>
          ))}

          {/* totals — scope + total only */}
          <div style={{ marginTop: 14, marginLeft: 'auto', width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5F6B7A', padding: '3px 0' }}><span>Subtotal</span><span>{money2(subtotal)}</span></div>
            {fees > 0.005 && (
              <div data-testid="shop-fees" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5F6B7A', padding: '3px 0' }}><span>Shop fees &amp; handling</span><span>{money2(fees)}</span></div>
            )}
            <div style={{ background: GREEN_LT, borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginTop: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: GREEN_DK }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: GREEN_DK }} data-testid="preview-total">{money2(total)}</span>
            </div>
          </div>
        </div>

        {/* action bar (not part of the document) */}
        <div style={{ borderTop: `1px solid ${color.border}`, padding: '16px 34px', display: 'flex', alignItems: 'center', gap: 12, background: color.appBg }}>
          <div style={{ fontSize: 12.5, color: color.muted }}>{sent ? 'Sent — status moved to “sent”.' : `Sends to ${quote.customer_email ?? 'the customer'} from your shop subdomain.`}</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', height: 42, padding: '0 18px', border: `1.5px solid ${color.border}`, borderRadius: 12, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Close</button>
          <button onClick={send} disabled={sending || sent} data-testid="send-quote"
            style={{ height: 42, padding: '0 22px', border: 'none', borderRadius: 12, background: sent ? color.success : color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sent ? '✓ Sent' : sending ? 'Sending…' : 'Send quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
