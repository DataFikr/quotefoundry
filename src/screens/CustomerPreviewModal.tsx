// ============================================================================
// CustomerPreviewModal.tsx — the customer-facing quote preview (the in-app
// equivalent of the PDF / #qf-print). Shows scope + total ONLY; margin,
// overhead and bare cost never appear here (CLAUDE.md §4.4). "Send" calls
// emailService, which the server re-verifies for ownership.
//
// The estimator picks one of THREE document templates (classic / modern /
// minimal). The choice is persisted on the quote (pdf_style) so the PDF that
// gets downloaded later matches the document that was previewed and sent.
// The shop logo renders top-left, exactly where the PDF generators place it.
// ============================================================================
import { useState } from 'react';
import { emailService, EMAIL_ENDPOINT_MISSING } from '../email-integration/services/emailService';
import { quoteService } from '../data-access-layer/services/quoteService';
import { customerScope } from '../app/customerScope';
import { formatLeadTime } from '../app/leadTime';
import type { Quote, PdfStyle } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money2, heading } from '../app/ui';

// Per-template document palette — keep in sync with clientQuotePdf.ts THEMES
// and the server generateQuotePdf.mjs styles. Exported so the public quote
// page (PublicQuoteScreen) renders the same document the estimator previewed.
export const DOC_THEMES: Record<PdfStyle, {
  label: string; swatch: string;
  bandBg: string; bandText: string; bandSub: string; rule: string;
  tableHead: string; tableHeadText: string; stripBg: string; stripText: string;
  totalBg: string; totalText: string; zebra: string; bandBorder?: string;
}> = {
  classic: {
    label: 'Classic', swatch: '#042C53',
    bandBg: '#042C53', bandText: '#fff', bandSub: '#B5D4F4', rule: '#0F6E56',
    tableHead: '#185FA5', tableHeadText: '#fff', stripBg: '#E6F1FB', stripText: '#042C53',
    totalBg: '#E1F5EE', totalText: '#04342C', zebra: '#F5F8FC',
  },
  modern: {
    label: 'Modern', swatch: '#1B51E5',
    bandBg: '#1B51E5', bandText: '#fff', bandSub: '#C8D6FF', rule: '#4667DB',
    tableHead: '#4667DB', tableHeadText: '#fff', stripBg: '#EEF1FF', stripText: '#1B51E5',
    totalBg: '#EEF1FF', totalText: '#1B51E5', zebra: '#F7F8FF',
  },
  minimal: {
    label: 'Minimal', swatch: '#1A1A1A',
    bandBg: '#fff', bandText: '#1A1A1A', bandSub: '#5F6B7A', rule: '#1A1A1A',
    tableHead: '#fff', tableHeadText: '#1A1A1A', stripBg: '#fff', stripText: '#1A1A1A',
    totalBg: '#fff', totalText: '#1A1A1A', zebra: '#fff', bandBorder: '1px solid #1A1A1A',
  },
};

const STYLES: PdfStyle[] = ['classic', 'modern', 'minimal'];

export function CustomerPreviewModal({ quote, shopName, shopLogoUrl, onClose, onSent }: {
  quote: Quote; shopName: string; shopLogoUrl?: string; onClose: () => void; onSent: () => void;
}) {
  const { lines, subtotal, fees, total } = customerScope(quote);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // confirm-before-send: the estimator verifies (and can correct) the
  // recipient address before anything leaves the shop.
  const [confirming, setConfirming] = useState(false);
  const [recipient, setRecipient] = useState(quote.customer_email ?? '');
  const [style, setStyle] = useState<PdfStyle>(quote.pdf_style ?? 'classic');
  const [copied, setCopied] = useState(false);
  const t = DOC_THEMES[style];

  // The customer's accept/decline page for this quote. Present on live data
  // (DB-minted token); absent on the mock backend — the button hides itself.
  const publicLink = quote.public_token
    ? `${window.location.origin}/#/q/${quote.public_token}`
    : null;

  async function copyLink() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable (http/permissions) — button just doesn't confirm */ }
  }

  // Persist the template choice immediately so a later "Download PDF" (or a
  // send from another session) reproduces exactly what was previewed.
  function pickStyle(s: PdfStyle) {
    setStyle(s);
    quoteService.setPdfStyle(quote.id, s); // fire-and-forget; UI state is source of truth here
  }

  async function send() {
    const to = recipient.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setError('Enter a valid recipient email address.'); return; }
    setSending(true);
    setError(null);
    await quoteService.setPdfStyle(quote.id, style); // frozen before the send is recorded
    const defaults = emailService.buildDefaults({ ...quote.inputs, ...quote, quoted_price: quote.quoted_price });
    const res = await emailService.sendQuote({
      quoteId: quote.id, recipient: to,
      subject: defaults.subject, message: defaults.message, pdfBase64: '',
    });
    if (res.error === EMAIL_ENDPOINT_MISSING) {
      // Local dev against live data: the email API only exists on the deployed
      // app. Mark the quote sent (honestly labeled) so the workflow continues.
      const marked = await quoteService.markSent(quote.id, to);
      setSending(false);
      if (marked.error) { setError(marked.error); return; }
      setSent(true);
      setSentNote('Marked sent — email delivery activates once the app is deployed. No email was sent.');
      onSent();
      return;
    }
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setSent(true);
    setSentNote(`Sent to ${to} — status moved to “sent”.`);
    onSent();
  }

  return (
    <div onClick={onClose} data-testid="preview-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20,20,45,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 700, maxWidth: '94vw', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 8, boxShadow: '0 30px 80px -20px rgba(0,0,0,.6)' }}>

        {/* template picker (app chrome, not part of the document) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 34px', background: color.appBg, borderBottom: `1px solid ${color.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: color.muted, fontFamily: heading, marginRight: 4 }}>Template</span>
          {STYLES.map((s) => {
            const on = s === style;
            return (
              <button key={s} onClick={() => pickStyle(s)} data-testid={`pdf-style-${s}`}
                style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 10, cursor: 'pointer', fontFamily: heading, fontWeight: 700, fontSize: 13, border: on ? `1.5px solid ${color.accentDeep}` : `1.5px solid ${color.border}`, background: on ? 'rgba(70,103,219,.12)' : '#fff', color: on ? color.accentDeep : color.body }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: DOC_THEMES[s].swatch, border: s === 'minimal' ? '1px solid #999' : 'none' }} />
                {DOC_THEMES[s].label}
              </button>
            );
          })}
        </div>

        {/* the document */}
        <div data-testid="qf-print" style={{ fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", color: '#1A1A1A' }}>
          {/* header band — logo top-left */}
          <div style={{ background: t.bandBg, color: t.bandText, padding: '22px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: t.bandBorder }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {shopLogoUrl && (
                <img src={shopLogoUrl} alt={`${shopName} logo`} data-testid="pdf-logo"
                  style={{ width: 48, height: 48, objectFit: 'contain', background: '#fff', borderRadius: 6, flex: 'none' }} />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: '.5px' }}>{shopName.toUpperCase()}</div>
                <div style={{ fontSize: 9, color: t.bandSub, marginTop: 3 }}>Custom steel fabrication</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: 19 }}>QUOTE</div>
              <div style={{ fontSize: 9, color: t.bandSub, marginTop: 3 }}>No. {quote.quote_number}</div>
            </div>
          </div>
          <div style={{ height: 3, background: t.rule }} />

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
                {formatLeadTime(quote.inputs.lead_time) && (
                  <div>Lead time: {formatLeadTime(quote.inputs.lead_time)}</div>
                )}
                <div>Qty: {quote.inputs.quantity} ea</div>
              </div>
            </div>

            {/* job strip — includes part number when present */}
            <div style={{ background: t.stripBg, border: style === 'minimal' ? '1px solid #1A1A1A' : 'none', borderRadius: 4, padding: '10px 14px', marginBottom: 18 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#5F6B7A' }}>JOB</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: t.stripText }}>
                {quote.inputs.job_name}{quote.inputs.part_number ? ` · Part # ${quote.inputs.part_number}` : ''}
              </div>
            </div>

            {/* scope table */}
            <div style={{ fontWeight: 700, fontSize: 11, color: style === 'minimal' ? '#1A1A1A' : t.tableHead, marginBottom: 8 }}>Scope of work</div>
            <div style={{ background: t.tableHead, color: t.tableHeadText, display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 9, fontWeight: 700, borderBottom: style === 'minimal' ? '1.5px solid #1A1A1A' : 'none' }}>
              <span>Description</span><span>Amount</span>
            </div>
            {lines.map((l, i) => (
              <div key={l.label} data-scope-line style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: i % 2 ? t.zebra : '#fff', borderBottom: '0.5px solid #D8DEE4' }}>
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
              <div style={{ background: t.totalBg, border: style === 'minimal' ? '1.5px solid #1A1A1A' : 'none', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', marginTop: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: t.totalText }}>Total</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: t.totalText }} data-testid="preview-total">{money2(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* action bar (not part of the document) */}
        <div style={{ borderTop: `1px solid ${color.border}`, padding: '14px 34px 16px', background: color.appBg }}>
          {error && (
            <div data-testid="send-error" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 600, color: color.danger }}>
              <i className="las la-exclamation-circle" />{error}
            </div>
          )}
          {sent ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div data-testid="send-success" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, color: color.success }}>
                <i className="las la-check-circle" style={{ fontSize: 17 }} />{sentNote}
              </div>
              <button onClick={onClose} style={{ marginLeft: 'auto', height: 42, padding: '0 22px', border: 'none', borderRadius: 12, background: color.success, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Done</button>
            </div>
          ) : confirming ? (
            /* confirm-recipient step: verify the address before it leaves the shop */
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label htmlFor="send-recipient" style={{ fontSize: 13.5, fontWeight: 700, color: color.body, fontFamily: heading }}>Send to</label>
              <input id="send-recipient" type="email" value={recipient} onChange={(e) => { setRecipient(e.target.value); setError(null); }} data-testid="send-recipient"
                placeholder="recipient@customer.com"
                style={{ flex: 1, minWidth: 220, height: 42, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14 }} />
              <button onClick={() => { setConfirming(false); setError(null); }} style={{ height: 42, padding: '0 16px', border: `1.5px solid ${color.border}`, borderRadius: 12, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Back</button>
              <button onClick={send} disabled={sending} data-testid="confirm-send"
                style={{ height: 42, padding: '0 22px', border: 'none', borderRadius: 12, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Sending…' : 'Yes, send it'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: color.muted }}>
                Sends from your shop subdomain — you'll confirm the address first.
                {publicLink && ' A secure accept link is added to the email automatically.'}
              </div>
              {publicLink && (
                <button onClick={copyLink} data-testid="copy-quote-link" title="Copy the customer's view-and-accept link (e.g. to text it)"
                  style={{ marginLeft: 'auto', height: 42, padding: '0 16px', border: `1.5px solid ${copied ? color.success : color.border}`, borderRadius: 12, background: '#fff', color: copied ? color.success : color.body, fontFamily: heading, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className={`las ${copied ? 'la-check' : 'la-link'}`} style={{ fontSize: 16 }} />{copied ? 'Copied' : 'Copy link'}
                </button>
              )}
              <button onClick={onClose} style={{ marginLeft: publicLink ? undefined : 'auto', height: 42, padding: '0 18px', border: `1.5px solid ${color.border}`, borderRadius: 12, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>Close</button>
              <button onClick={() => { setConfirming(true); setError(null); }} data-testid="send-quote"
                style={{ height: 42, padding: '0 22px', border: 'none', borderRadius: 12, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, cursor: 'pointer' }}>
                Send quote
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
