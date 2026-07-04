-- ============================================================================
-- Migration: stamp shop_id automatically on insert (2026-07-03).
-- ----------------------------------------------------------------------------
-- WHY: the RLS policies use `with check (shop_id = current_shop_id())`, and the
-- app services deliberately never pass shop_id (CLAUDE.md §4.1) — but the
-- original schema had no default to stamp it, so every insert into a
-- shop-scoped table failed with "new row violates row-level security policy".
-- The in-memory mock auto-stamped shop_id, which is why this only surfaced
-- against the real database (caught by `npm run verify:live`).
--
-- Run in the Supabase SQL editor. Idempotent — safe to run twice.
-- ============================================================================

alter table customers    alter column shop_id set default current_shop_id();
alter table quotes       alter column shop_id set default current_shop_id();
alter table quote_events alter column shop_id set default current_shop_id();
