// ============================================================================
// POST /api/generate-pdf — authenticated. Returns the customer-facing quote
// PDF built server-side from the quote's frozen snapshot + stored pdf_style.
// RLS (via the caller-scoped client in loadQuoteForPdf) means a foreign quote
// id is indistinguishable from a missing one.
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCaller, loadQuoteForPdf } from './_lib.js';
// @ts-expect-error — plain .mjs module, no type declarations
import { generateQuotePdf } from '../src/pdf-generation/src/generateQuotePdf.mjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  try {
    const { caller, error } = await getCaller(req);
    if (!caller) return res.status(401).json({ ok: false, error });

    const quoteId = req.body?.quoteId;
    if (!quoteId) return res.status(400).json({ ok: false, error: 'quoteId is required.' });

    const loaded = await loadQuoteForPdf(caller, String(quoteId));
    if (!loaded.quote) return res.status(404).json({ ok: false, error: loaded.error });

    const pdf: Buffer = await generateQuotePdf(loaded.quote, loaded.shop);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${loaded.quote.quote_number}.pdf"`);
    return res.status(200).send(pdf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generate-pdf] unhandled error:', msg);
    return res.status(500).json({ ok: false, error: msg });
  }
}
