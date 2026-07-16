// ============================================================================
// POST /api/quote-respond {t: <public_token>, action: 'accept'|'decline'}
// ----------------------------------------------------------------------------
// The customer's Accept/Decline. Same trust model as quote-view: the uuid
// token is the only credential, the lookup runs service-role, and the status
// rules mirror the open-tracking invariant (§4.5):
//   * accept: sent|opened → won      * decline: sent|opened → lost
//   * an existing won/lost (set by the shop OR an earlier response) is FINAL —
//     we report it back, we never override or downgrade it
//   * drafts and bad tokens are the same 404 (no oracle)
// The UPDATE itself is conditional on the status still being sent/opened, so a
// race (shop marks won while the customer clicks decline) can't flip an
// outcome — the losing writer sees 0 rows and re-reads the winner's state.
// Every applied response is recorded to quote_events (the activity timeline).
// ============================================================================
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isValidToken, respondTransition } from '../src/public-quote/server/publicQuote.js';

const NOT_FOUND = { ok: false as const, error: 'Quote not found.' };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const { t: token, action } = req.body ?? {};
  if (!isValidToken(token) || (action !== 'accept' && action !== 'decline')) {
    return res.status(404).json(NOT_FOUND);
  }

  try {
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: row } = await admin
      .from('quotes')
      .select('id, shop_id, status, decided_at')
      .eq('public_token', token)
      .maybeSingle();
    if (!row) return res.status(404).json(NOT_FOUND);

    const decision = respondTransition(row.status, action);
    if (decision.kind === 'notFound') return res.status(404).json(NOT_FOUND);
    if (decision.kind === 'already') {
      return res.status(200).json({ ok: true, state: decision.state, responded_at: row.decided_at ?? undefined });
    }

    // conditional update — the .in() guard makes the transition race-safe
    const now = new Date().toISOString();
    const { data: updated } = await admin
      .from('quotes')
      .update({ status: decision.next, decided_at: now })
      .eq('id', row.id)
      .in('status', ['sent', 'opened'])
      .select('status, decided_at');

    if (!updated?.length) {
      // lost the race — someone (shop or another click) decided first; report theirs
      const { data: current } = await admin
        .from('quotes').select('status, decided_at').eq('id', row.id).maybeSingle();
      const state = current?.status === 'won' ? 'accepted' : current?.status === 'lost' ? 'declined' : 'open';
      return res.status(200).json({ ok: true, state, responded_at: current?.decided_at ?? undefined });
    }

    // timeline event — shop_id passed explicitly (service role bypasses the
    // current_shop_id() insert default, which resolves null with no JWT)
    await admin.from('quote_events').insert({
      shop_id: row.shop_id,
      quote_id: row.id,
      event_type: decision.event,
      detail: decision.detail,
    });

    return res.status(200).json({
      ok: true,
      state: decision.next === 'won' ? 'accepted' : 'declined',
      responded_at: now,
    });
  } catch (e) {
    console.error('[quote-respond] unhandled error:', e instanceof Error ? e.message : e);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}
