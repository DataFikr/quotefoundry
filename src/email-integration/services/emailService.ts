// ============================================================================
// emailService.ts — what the send screen calls (client side)
// ----------------------------------------------------------------------------
// Thin: it gathers the message + PDF and calls the server function. It never
// touches the email provider directly (that key is server-only). The server
// re-verifies shop ownership, so the client can't email another shop's quote
// even if it tried.
// ============================================================================

import { supabase, run, ok, fail, Result } from '../../data-access-layer/lib/supabase';

export interface SendQuoteRequest {
  quoteId: string;
  recipient: string;
  subject: string;
  message: string;
  pdfBase64: string;   // generated client- or server-side from the quote
}

export const emailService = {
  // Calls the deployed edge function / API route. The caller's session token
  // rides along so the server can resolve their shop and verify ownership.
  async sendQuote(req: SendQuoteRequest): Promise<Result<{ emailId: string }>> {
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
    return {
      recipient: quote.customer_email ?? '',
      subject: `Quote ${quote.quote_number} — ${quote.job_name}`,
      message:
        `Hi,\n\n` +
        `Thank you for the opportunity to quote your ${quote.job_name.toLowerCase()}. ` +
        `Our price is ${price}${quote.lead_time ? `, with a ${quote.lead_time} lead time from approval` : ''}.\n\n` +
        `The full quote is attached as a PDF. It's valid for 30 days. ` +
        `To proceed, just sign and return it, or reply to this email.\n\n` +
        `Happy to answer any questions.`,
    };
  },
};
