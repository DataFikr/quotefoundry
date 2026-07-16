// ============================================================================
// emailService.ts — what the send screen calls (client side)
// ----------------------------------------------------------------------------
// Thin: it gathers the message + PDF and calls the server function. It never
// touches the email provider directly (that key is server-only). The server
// re-verifies shop ownership, so the client can't email another shop's quote
// even if it tried.
// ============================================================================

import { supabase, run, ok, fail, Result } from '../../data-access-layer/lib/supabase';
import { normalizeLeadTime } from '../../app/leadTime';

export interface SendQuoteRequest {
  quoteId: string;
  recipient: string;
  subject: string;
  message: string;
  pdfBase64: string;   // generated client- or server-side from the quote
}

// Live deployments send through the Vercel API route (same origin as the app);
// the mock keeps the functions.invoke path so all existing tests/dev flows hold.
function isLiveEnv(): boolean {
  try { return Boolean(import.meta.env?.VITE_SUPABASE_URL); } catch { return false; }
}

// Sentinel error: the /api routes only exist on the deployed app (Vercel).
// A 404 in live mode means "running locally against live data" — the UI offers
// to mark the quote sent without emailing, instead of failing silently.
export const EMAIL_ENDPOINT_MISSING = 'EMAIL_ENDPOINT_MISSING';

export const emailService = {
  // Calls the deployed API route. The caller's session token rides along so
  // the server can resolve their shop and verify ownership; the PDF itself is
  // generated server-side from the quote's frozen snapshot.
  async sendQuote(req: SendQuoteRequest): Promise<Result<{ emailId: string }>> {
    if (isLiveEnv()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return fail('Not signed in.');
        const r = await fetch('/api/send-quote-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ quoteId: req.quoteId, recipient: req.recipient, subject: req.subject, message: req.message }),
        });
        if (r.status === 404) return fail(EMAIL_ENDPOINT_MISSING);
        const json = await r.json().catch(() => null);
        if (!r.ok || !json?.ok) return fail(json?.error ?? `Send failed (${r.status}).`);
        return ok({ emailId: json.emailId });
      } catch (e) {
        return fail(e instanceof Error ? e.message : 'Send failed.');
      }
    }
    const res = await run<any>(() =>
      supabase.functions.invoke('send-quote-email', { body: req })
    );
    if (res.error) return fail(res.error);
    if (!res.data?.ok) return fail(res.data?.error ?? 'Send failed.');
    return ok({ emailId: res.data.emailId });
  },

  // Pre-fills the send form from the quote — recipient from the customer,
  // a sensible default subject and message the estimator can edit.
  buildDefaults(quote: {
    quote_number: string;
    job_name: string;
    customer_name?: string;
    customer_email?: string;
    quoted_price: number;
    lead_time?: string;
  }): { recipient: string; subject: string; message: string } {
    const price = '$' + quote.quoted_price.toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    // lead_time is overloaded (a due date OR a duration) — phrase each correctly
    // and drop the clause entirely when the value isn't usable (e.g. a stray
    // spreadsheet date serial), so nothing raw ever reaches the customer.
    const lt = normalizeLeadTime(quote.lead_time);
    const leadClause =
      lt.kind === 'date' ? `, for delivery by ${lt.text}`
      : lt.kind === 'duration' ? `, with a ${lt.text} lead time from approval`
      : '';
    return {
      recipient: quote.customer_email ?? '',
      subject: `Quote ${quote.quote_number} — ${quote.job_name}`,
      message:
        `Hi,\n\n` +
        `Thank you for the opportunity to quote your ${quote.job_name.toLowerCase()}. ` +
        `Our price is ${price}${leadClause}.\n\n` +
        `The full quote is attached as a PDF. It's valid for 30 days. ` +
        `To proceed, accept it online with the link below, or just reply to this email.\n\n` +
        `Happy to answer any questions.`,
    };
  },
};
