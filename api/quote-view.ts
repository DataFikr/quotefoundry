// ============================================================================
// GET /api/quote-view?t=<public_token> — the customer-facing quote payload.
// ----------------------------------------------------------------------------
// Unauthenticated BY DESIGN: the customer holds no session, only the
// unguessable uuid token from their quote email. Because the lookup can't go
// through RLS, it runs on the service-role client — so what leaves this
// endpoint is exactly buildPublicPayload()'s allowlist (scope + total, §4.4):
// margin, overhead, bare cost and rate_snapshot are structurally absent, and
// the margin-leak test locks that.
//
// No oracle: bad token, unknown token and draft quote all return the same 404.
// A successful view advances sent → opened via trackOpen() — the same soft
// "viewed" signal as the email pixel, same never-downgrade guard (§4.5).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidToken, buildPublicPayload } from '../src/public-quote/server/publicQuote.js';
import { trackOpen } from '../src/email-integration/server/sendQuoteEmail.js';

const NOT_FOUND = { ok: false as const, error: 'Quote not found.' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  res.setHeader('Cache-Control', 'no-store');           // live status, never cached

  const token = typeof req.query.t === 'string' ? req.query.t : '';
  if (!isValidToken(token)) return res.status(404).json(NOT_FOUND);

  try {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: row } = await admin
      .from('quotes')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    const { data: shop } = row
      ? await admin.from('shops').select('name, logo_url').eq('id', row.shop_id).maybeSingle()
      : { data: null };

    const payload = buildPublicPayload(row, shop);      // null for draft/missing
    if (!payload) return res.status(404).json(NOT_FOUND);

    // soft "viewed" signal — only ever advances sent → opened, never downgrades
    try { await trackOpen(row.id); } catch { /* viewing must never fail on this */ }

    return res.status(200).json({ ok: true, quote: payload });
  } catch (e) {
    console.error('[quote-view] unhandled error:', e instanceof Error ? e.message : e);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}
