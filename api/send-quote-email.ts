// ============================================================================
// POST /api/send-quote-email — authenticated. Generates the customer PDF
// SERVER-SIDE from the quote's frozen snapshot + stored pdf_style (so the
// attachment is guaranteed to match what was previewed, and the margin-hiding
// rule can't be bypassed by a tampered client payload), then hands off to
// sendQuoteEmail() which re-verifies ownership and sends via Resend.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCaller, loadQuoteForPdf } from './_lib.js';
import { sendQuoteEmail } from '../src/email-integration/server/sendQuoteEmail.js';
// @ts-expect-error — plain .mjs module, no type declarations
import { generateQuotePdf } from '../src/pdf-generation/src/generateQuotePdf.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  try {
    // Fail fast with a legible message if the sending config is incomplete —
    // otherwise a missing secret surfaces as an opaque low-level throw / 500.
    const missingEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']
      .filter((k) => !process.env[k]);
    if (missingEnv.length) {
      return res.status(500).json({ ok: false, error: `Email is not configured on the server (missing: ${missingEnv.join(', ')}).` });
    }

    const { caller, error } = await getCaller(req);
    if (!caller) return res.status(401).json({ ok: false, error });

    const { quoteId, recipient, subject, message } = req.body ?? {};
    if (!quoteId || !recipient || !subject || !message) {
      return res.status(400).json({ ok: false, error: 'quoteId, recipient, subject and message are required.' });
    }

    const loaded = await loadQuoteForPdf(caller, String(quoteId));
    if (!loaded.quote) return res.status(404).json({ ok: false, error: loaded.error });

    const pdfBuffer: Buffer = await generateQuotePdf(loaded.quote, loaded.shop);

    const result = await sendQuoteEmail({
      quoteId: String(quoteId),
      callerShopId: caller.shopId,
      recipient: String(recipient),
      subject: String(subject),
      message: String(message),
      pdfBase64: pdfBuffer.toString('base64'),
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[send-quote-email] unhandled error:', msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}
