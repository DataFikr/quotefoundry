-- ============================================================================
-- Migration: multi-material quotes (2026-07-04).
-- Each quote can carry multiple material lines [{type, weight, qty}]; the
-- engine sums them when present and falls back to the legacy single
-- material_spec/material_weight pair otherwise. Idempotent.
-- ============================================================================

alter table quotes add column if not exists material_lines jsonb;
