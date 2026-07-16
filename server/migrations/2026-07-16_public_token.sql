-- ============================================================================
-- Migration: public quote link + Accept/Decline (2026-07-16).
-- ----------------------------------------------------------------------------
-- Adds quotes.public_token — the unguessable bearer credential for the
-- customer-facing quote page (#/q/<token>). SECURITY MODEL:
--   * The token is the ONLY public credential. RLS is untouched; the token
--     lookup happens server-side (service role) in api/quote-view.ts /
--     api/quote-respond.ts, which return an explicit customer-safe allowlist
--     (scope + total — NEVER margin/overhead/cost/rate_snapshot, §4.4).
--   * uuid v4 = 122 random bits — not enumerable. One token per quote, minted
--     at insert; a shop's own RLS-scoped reads may see it (it's their link).
--
-- Run in the Supabase SQL editor. Idempotent — safe to run twice.
-- Fresh loads of quotefoundry_schema.sql (2026-07-16+) already include this.
-- ============================================================================

alter table quotes add column if not exists public_token uuid not null default gen_random_uuid();

-- unique + fast lookup for the public endpoints' .eq('public_token', …)
create unique index if not exists idx_quotes_public_token on quotes(public_token);
