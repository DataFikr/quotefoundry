// ============================================================================
// GET /api/track-open?q=<quoteId>&s=<sig> — the 1x1 open pixel.
// Unauthenticated by nature (loaded from the customer's email client), so the
// HMAC signature is the only thing standing between a guessed quote id and a
// spoofed "opened" status — verify it before touching the database. Always
// returns the pixel (no oracle about whether ids/signatures are valid), and
// trackOpen() itself only ever advances sent → opened (CLAUDE.md §4.5).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { trackOpen, signTracking } from '../src/email-integration/server/sendQuoteEmail';

// 1x1 transparent GIF (also returned on invalid input)
const PIXEL = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const quoteId = typeof req.query.q === 'string' ? req.query.q : '';
  const sig = typeof req.query.s === 'string' ? req.query.s : '';

  if (quoteId && sig && sig === signTracking(quoteId)) {
    try { await trackOpen(quoteId); } catch { /* pixel must never error out */ }
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).send(PIXEL);
}
