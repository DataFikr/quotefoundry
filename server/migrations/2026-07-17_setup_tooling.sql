-- ============================================================================
-- Migration: machining-accuracy upgrade — setup & tooling (2026-07-17).
-- ----------------------------------------------------------------------------
-- Adds the ONE-TIME job cost fields the machining-estimating research
-- (docs/consulting/12) identified as the accuracy gap:
--   quotes.hrs_setup     — setup + programming hours (amortized across qty by
--                          the editor's price-break table; engine adds it to cost)
--   quotes.tooling_cost  — $ perishable tooling for the job (endmills, inserts)
--   shop_rates.rate_setup — $/hr for setup & programming (default 75)
-- All default to 0/75, so existing quotes and snapshots compute unchanged.
-- Pre-upgrade rate_snapshots lack rate_setup: the engine falls back to
-- rate_cutting, keeping every frozen snapshot deterministic forever.
--
-- Run in the Supabase SQL editor. Idempotent — safe to run twice.
-- Fresh loads of quotefoundry_schema.sql (2026-07-17+) already include this.
-- ============================================================================

alter table quotes     add column if not exists hrs_setup    numeric(10,2) default 0;
alter table quotes     add column if not exists tooling_cost numeric(10,2) default 0;
alter table shop_rates add column if not exists rate_setup   numeric(10,2) not null default 75;
