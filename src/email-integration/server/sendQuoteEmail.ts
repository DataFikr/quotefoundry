// ============================================================================
// sendQuoteEmail.ts — server-side quote email (Supabase Edge Function / API route)
// ----------------------------------------------------------------------------
// MUST run server-side, never from the browser: the provider API key is a
// secret, and send authority can't be exposed to clients.
//
// The hard part of email isn't this code — it's DELIVERABILITY (does it reach
// the inbox?). The decisions that determine that are baked in here:
//   1. Send from YOUR authenticated domain, with the shop as reply-to.
//      (You can't send "as" the shop's domain without their DNS; faking it
//       guarantees spam. So: from quotes@send.quotefoundry.app, reply-to the shop.)
//   2. Plain, quote-shaped content — no spammy markup, real text + the PDF.
//   3. One tracked open pixel, honestly treated as a soft signal.
//   4. Every send recorded to quote_events with the timestamp.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

// HMAC over the quote id, embedded in the tracking-pixel URL and verified by
// the /api/track-open endpoint before it advances sent → opened.
export function signTracking(quoteId: string): string {
  return createHmac('sha256', process.env.TRACKING_SECRET || 'dev-secret')
    .update(quoteId)
    .digest('hex')
    .slice(0, 32);
}

// --- provider abstraction --------------------------------------------------
// Wrap the transactional provider (Resend / Postmark / SendGrid) behind one
// interface so switching providers later is a one-file change. Example uses
// Resend's REST shape; swap the fetch body for another provider as needed.
interface SendArgs {
  to: string;
  replyTo: string;
  fromName: string;     // the shop's name, shown as sender
  subject: string;
  text: string;
  pdfBase64: string;
  pdfFilename: string;
  trackingPixelUrl: string;
  ctaUrl?: string;      // public quote link — rendered as a real anchor in the HTML part
}

// The authenticated sending subdomain (verified in Resend + DNS). Configurable
// so the code doesn't hard-couple to one domain (prod: send.quotefoundry.app).
function sendDomain(): string {
  return process.env.EMAIL_SEND_DOMAIN || 'send.quotefoundry.app';
}

async function providerSend(args: SendArgs): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // From: authenticated sending subdomain (set up once in DNS). The shop's
      // NAME shows as sender; replies route to the shop's real inbox.
      from: `${args.fromName} <quotes@${sendDomain()}>`,
      reply_to: args.replyTo,
      to: [args.to],
      subject: args.subject,
      // Plain text is the body. A minimal HTML part carries only the PDF link
      // context and the 1px open pixel — no images, no heavy markup, which is
      // what trips spam filters.
      text: args.text,
      html: `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a;white-space:pre-line">${escapeHtml(
        args.text
      )}</div>${args.ctaUrl
        ? `<p style="margin:18px 0"><a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;background:#0E7A4C;color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 22px;border-radius:8px">View &amp; accept quote</a></p>`
        : ''}<img src="${args.trackingPixelUrl}" width="1" height="1" alt="" style="display:none">`,
      attachments: [
        { filename: args.pdfFilename, content: args.pdfBase64 },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email provider rejected the send: ${res.status} ${body}`);
  }
  const json = await res.json();
  return { id: json.id };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

// --- the handler -----------------------------------------------------------
// Called by the app with a quote id and recipient. Loads the quote, builds the
// message, sends, and records the event — all server-side with the service-role
// client (RLS is bypassed here, so we MUST re-check the quote belongs to the
// caller's shop ourselves).
export async function sendQuoteEmail(req: {
  quoteId: string;
  callerShopId: string;     // resolved from the caller's verified session
  recipient: string;
  message: string;
  subject: string;
  pdfBase64: string;
}): Promise<{ ok: true; emailId: string } | { ok: false; error: string }> {
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!   // server-only secret
  );

  // 1. Load the quote AND verify it belongs to the caller's shop. Because the
  //    service-role key bypasses RLS, this ownership check is on us — skipping
  //    it would let a caller email another shop's quote.
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('id, shop_id, quote_number, job_name, customer_name, public_token, shops(name)')
    .eq('id', req.quoteId)
    .single();
  if (qErr || !quote) return { ok: false, error: 'Quote not found.' };
  if (quote.shop_id !== req.callerShopId) {
    return { ok: false, error: 'That quote belongs to another shop.' };
  }

  // 2. Build the shop's reply-to from their profile.
  const { data: shopUser } = await admin
    .from('shop_users')
    .select('full_name, auth_user_id')
    .eq('shop_id', quote.shop_id)
    .limit(1)
    .single();

  // Reply-to should be the shop's real email. Pull from their auth record.
  const { data: authUser } = await admin.auth.admin.getUserById(
    shopUser?.auth_user_id ?? ''
  );
  const replyTo = authUser?.user?.email ?? `no-reply@${sendDomain()}`;

  // 3. Tracking pixel URL — a tiny endpoint that marks the quote opened. The
  //    HMAC signature stops anyone who guesses a quote id from flipping its
  //    status by hitting the (necessarily unauthenticated) pixel endpoint.
  const trackingPixelUrl =
    `${process.env.PUBLIC_URL}/api/track-open?q=${quote.id}&s=${signTracking(quote.id)}`;

  // 3b. Public quote link — appended SERVER-SIDE (never trusted from the
  //     client) so every sent email carries the customer's accept/decline page.
  //     The token is the quote's own public_token; the estimator previews the
  //     message knowing this block is added automatically.
  const quoteLink = quote.public_token
    ? `${process.env.PUBLIC_URL}/#/q/${quote.public_token}`
    : '';
  const text = quoteLink
    ? `${req.message}\n\nView, accept, or decline this quote online:\n${quoteLink}`
    : req.message;

  // 4. Send.
  let emailId: string;
  try {
    const sent = await providerSend({
      to: req.recipient,
      replyTo,
      fromName: (quote as any).shops?.name ?? 'Quote',
      subject: req.subject,
      text,
      pdfBase64: req.pdfBase64,
      pdfFilename: `Quote_${quote.quote_number}.pdf`,
      trackingPixelUrl,
      ctaUrl: quoteLink || undefined,
    });
    emailId = sent.id;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed.' };
  }

  // 5. Mark sent + record the timestamped event (the activity timeline).
  const now = new Date().toISOString();
  await admin.from('quotes')
    .update({ status: 'sent', sent_at: now })
    .eq('id', quote.id);
  await admin.from('quote_events').insert({
    shop_id: quote.shop_id,
    quote_id: quote.id,
    event_type: 'sent',
    detail: req.recipient,
  });

  return { ok: true, emailId };
}

// ============================================================================
// trackOpen.ts — the 1x1 pixel endpoint
// ----------------------------------------------------------------------------
// Returns a transparent pixel and records an 'opened' event ONCE. Honest about
// limits: blocked images and email-preview panes make this a soft signal, so we
// only ever ADVANCE sent -> opened, never downgrade a won/lost quote, and never
// claim certainty in the UI ("viewed", not "definitely read").
// ============================================================================
export async function trackOpen(quoteId: string): Promise<Uint8Array> {
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Only advance from 'sent'; never overwrite a later state.
  const { data: quote } = await admin
    .from('quotes')
    .select('id, shop_id, status, opened_at')
    .eq('id', quoteId)
    .single();

  if (quote && quote.status === 'sent' && !quote.opened_at) {
    const now = new Date().toISOString();
    await admin.from('quotes')
      .update({ status: 'opened', opened_at: now })
      .eq('id', quote.id)
      .eq('status', 'sent');          // guard against races
    await admin.from('quote_events').insert({
      shop_id: quote.shop_id,
      quote_id: quote.id,
      event_type: 'opened',
    });
  }

  // 1x1 transparent GIF
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
  ]);
}
