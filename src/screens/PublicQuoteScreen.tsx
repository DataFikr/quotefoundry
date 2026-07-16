// ============================================================================
// PublicQuoteScreen.tsx — the customer's view of a quote (#/q/<token>).
// ----------------------------------------------------------------------------
// Rendered OUTSIDE the auth gate: the visitor is the shop's customer, holding
// only the unguessable link from the quote email. Everything shown here comes
// from /api/quote-view's customer-safe allowlist (scope + total, §4.4) — this
// screen never touches the data layer, RLS, or any internal number.
//
// Mobile-first on purpose: the buyer opens this from email on a phone, reads
// the scope, and taps Accept (44px+ targets). Accept/Decline confirm first,
// then POST /api/quote-respond, which only ever advances sent/opened → won/lost
// (an outcome that already exists is reported back, never overridden).
// The document mirrors CustomerPreviewModal (same DOC_THEMES palette), so what
// the customer sees online is what the estimator previewed and the PDF shows.
// ============================================================================
import { useEffect, useState } from 'react';
import { DOC_THEMES } from './CustomerPreviewModal';
import { formatLeadTime } from '../app/leadTime';
import { trackPageView } from '../app/analytics';
import { color } from '../design/tokens';
import { money2, heading } from '../app/ui';
import type { PdfStyle } from '../data-access-layer/lib/types';

// mirrors PublicQuotePayload (src/public-quote/server/publicQuote.ts)
interface PublicQuote {
  state: 'open' | 'accepted' | 'declined';
  responded_at?: string;
  quote_number: string;
  job_name: string;
  part_number?: string;
  customer_name?: string;
  created_at: string;
  quantity: number;
  lead_time?: string;
  pdf_style: string;
  lines: { label: string; detail: string; amount: number }[];
  subtotal: number;
  fees: number;
  total: number;
  per_unit: number;
  shop: { name: string; logo_url?: string };
}

type Phase =
  | { name: 'loading' }
  | { name: 'notFound' }
  | { name: 'ready'; quote: PublicQuote };

export function PublicQuoteScreen({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [confirming, setConfirming] = useState<null | 'accept' | 'decline'>(null);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    trackPageView('#/q'); // sanitized — the token never reaches analytics
    (async () => {
      try {
        const r = await fetch(`/api/quote-view?t=${encodeURIComponent(token)}`);
        const json = await r.json().catch(() => null);
        if (!r.ok || !json?.ok) { setPhase({ name: 'notFound' }); return; }
        setPhase({ name: 'ready', quote: json.quote });
      } catch {
        setPhase({ name: 'notFound' });
      }
    })();
  }, [token]);

  async function respond(action: 'accept' | 'decline') {
    if (phase.name !== 'ready') return;
    setResponding(true);
    setError(null);
    try {
      const r = await fetch('/api/quote-respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, action }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) {
        setError('Something went wrong — please try again, or reply to the quote email.');
        setResponding(false);
        return;
      }
      // server is the source of truth (it may report an outcome that already existed)
      setPhase({ name: 'ready', quote: { ...phase.quote, state: json.state, responded_at: json.responded_at } });
      setConfirming(null);
      setResponding(false);
    } catch {
      setError('Something went wrong — please try again, or reply to the quote email.');
      setResponding(false);
    }
  }

  const page = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: color.appBg, padding: '28px 14px 40px', fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>{children}</div>
      <div style={{ maxWidth: 680, margin: '18px auto 0', textAlign: 'center', fontSize: 12, color: color.muted }}>
        Powered by <a href="https://quotefoundry.app" style={{ color: color.accentDeep, fontWeight: 700, textDecoration: 'none' }}>QuoteFoundry</a>
      </div>
    </div>
  );

  if (phase.name === 'loading') {
    return page(<div style={{ textAlign: 'center', color: color.muted, padding: '80px 0' }}>Loading quote…</div>);
  }

  if (phase.name === 'notFound') {
    return page(
      <div data-testid="public-not-found" style={{ background: '#fff', borderRadius: 14, padding: '44px 28px', textAlign: 'center', boxShadow: '0 14px 40px -18px rgba(20,20,60,.25)' }}>
        <i className="las la-unlink" style={{ fontSize: 40, color: color.muted }} />
        <h2 style={{ margin: '12px 0 8px', color: color.ink, fontFamily: heading }}>This quote link isn't available</h2>
        <p style={{ fontSize: 14, color: color.muted, margin: 0 }}>
          The link may be incomplete or out of date. Reply to the email you received and the shop will send a fresh one.
        </p>
      </div>
    );
  }

  const q = phase.quote;
  const t = DOC_THEMES[(q.pdf_style as PdfStyle)] ?? DOC_THEMES.classic;
  const lead = formatLeadTime(q.lead_time);
  const decidedDate = q.responded_at ? new Date(q.responded_at).toLocaleDateString() : null;

  return page(
    <>
      {/* outcome banner */}
      {q.state === 'accepted' && (
        <div data-testid="public-accepted" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#E1F5EE', color: '#04342C', borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontWeight: 700, fontSize: 14.5, fontFamily: heading }}>
          <i className="las la-check-circle" style={{ fontSize: 22 }} />
          Quote accepted{decidedDate ? ` on ${decidedDate}` : ''} — {q.shop.name} has been notified and will be in touch.
        </div>
      )}
      {q.state === 'declined' && (
        <div data-testid="public-declined" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F2F3F7', color: color.body, borderRadius: 12, padding: '14px 18px', marginBottom: 14, fontWeight: 700, fontSize: 14.5, fontFamily: heading }}>
          <i className="las la-times-circle" style={{ fontSize: 22 }} />
          Quote declined{decidedDate ? ` on ${decidedDate}` : ''}. If anything changes, just reply to the quote email.
        </div>
      )}

      {/* the document — same layout/palette as the preview + PDF */}
      <div data-testid="public-quote-doc" style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 14px 40px -18px rgba(20,20,60,.25)', color: '#1A1A1A' }}>
        <div style={{ background: t.bandBg, color: t.bandText, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: t.bandBorder }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {q.shop.logo_url && (
              <img src={q.shop.logo_url} alt={`${q.shop.name} logo`} style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff', borderRadius: 6, flex: 'none' }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.shop.name.toUpperCase()}</div>
              <div style={{ fontSize: 9, color: t.bandSub, marginTop: 3 }}>Custom steel fabrication</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>QUOTE</div>
            <div style={{ fontSize: 9, color: t.bandSub, marginTop: 3 }}>No. {q.quote_number}</div>
          </div>
        </div>
        <div style={{ height: 3, background: t.rule }} />

        <div style={{ padding: '20px 22px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#5F6B7A' }}>QUOTE FOR</div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>{q.customer_name ?? '—'}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#5F6B7A' }}>
              <div>Date: {new Date(q.created_at).toLocaleDateString()}</div>
              <div>Valid: 30 days</div>
              {lead && <div>Lead time: {lead}</div>}
              <div>Qty: {q.quantity} ea</div>
            </div>
          </div>

          <div style={{ background: t.stripBg, border: q.pdf_style === 'minimal' ? '1px solid #1A1A1A' : 'none', borderRadius: 4, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#5F6B7A' }}>JOB</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: t.stripText }}>
              {q.job_name}{q.part_number ? ` · Part # ${q.part_number}` : ''}
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 11, color: q.pdf_style === 'minimal' ? '#1A1A1A' : t.tableHead, marginBottom: 8 }}>Scope of work</div>
          <div style={{ background: t.tableHead, color: t.tableHeadText, display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 9, fontWeight: 700, borderBottom: q.pdf_style === 'minimal' ? '1.5px solid #1A1A1A' : 'none' }}>
            <span>Description</span><span>Amount</span>
          </div>
          {q.lines.map((l, i) => (
            <div key={l.label} data-scope-line style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 12px', background: i % 2 ? t.zebra : '#fff', borderBottom: '0.5px solid #D8DEE4' }}>
              <div><div style={{ fontSize: 11.5 }}>{l.label}</div><div style={{ fontSize: 9, color: '#5F6B7A' }}>{l.detail}</div></div>
              <div style={{ fontSize: 11.5, flex: 'none' }}>{money2(l.amount)}</div>
            </div>
          ))}

          <div style={{ marginTop: 14, marginLeft: 'auto', maxWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5F6B7A', padding: '3px 0' }}><span>Subtotal</span><span>{money2(q.subtotal)}</span></div>
            {q.fees > 0.005 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5F6B7A', padding: '3px 0' }}><span>Shop fees &amp; handling</span><span>{money2(q.fees)}</span></div>
            )}
            <div style={{ background: t.totalBg, border: q.pdf_style === 'minimal' ? '1.5px solid #1A1A1A' : 'none', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', marginTop: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: t.totalText }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: t.totalText }} data-testid="public-total">{money2(q.total)}</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10.5, color: '#5F6B7A', marginTop: 6 }}>
              {money2(q.per_unit)} per unit · qty {q.quantity}
            </div>
          </div>
        </div>
      </div>

      {/* respond actions (open quotes only) */}
      {q.state === 'open' && (
        <div style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', marginTop: 14, boxShadow: '0 14px 40px -18px rgba(20,20,60,.25)' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 600, color: color.danger }}>
              <i className="las la-exclamation-circle" />{error}
            </div>
          )}
          {confirming ? (
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: color.ink, fontFamily: heading, marginBottom: 12 }}>
                {confirming === 'accept'
                  ? <>Accept quote {q.quote_number} for {money2(q.total)}?</>
                  : <>Decline quote {q.quote_number}?</>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => respond(confirming)} disabled={responding}
                  data-testid={`public-confirm-${confirming}`}
                  style={{ flex: '1 1 200px', height: 52, border: 'none', borderRadius: 13, background: confirming === 'accept' ? color.success : color.danger, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: responding ? 0.7 : 1 }}>
                  {responding ? 'Sending…' : confirming === 'accept' ? 'Yes, accept this quote' : 'Yes, decline'}
                </button>
                <button onClick={() => { setConfirming(null); setError(null); }} disabled={responding}
                  style={{ flex: '1 1 120px', height: 52, border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Back
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: color.muted, marginBottom: 12 }}>
                Ready to move ahead? Accepting notifies {q.shop.name} to get your job scheduled. Questions first? Just reply to the quote email.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setConfirming('accept')} data-testid="public-accept"
                  style={{ flex: '1 1 200px', height: 54, border: 'none', borderRadius: 13, background: color.success, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 15.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <i className="las la-check" style={{ fontSize: 19 }} />Accept quote
                </button>
                <button onClick={() => setConfirming('decline')} data-testid="public-decline"
                  style={{ flex: '1 1 130px', height: 54, border: `1.5px solid ${color.border}`, borderRadius: 13, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Parse a public-quote token from the location hash: #/q/<uuid>.
// Exported for App.tsx (mount decision) and tests.
export function publicQuoteToken(hash: string): string | null {
  const m = /^#\/q\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(hash.trim());
  return m ? m[1] : null;
}
