-- ============================================================================
-- Migration: columns added by the pre-launch feature batch (2026-07-02).
-- Run this ONLY if your Supabase project was created from a quotefoundry_schema.sql
-- older than 2026-07-02. Fresh loads of the current schema already include
-- these. Idempotent — safe to run twice.
-- ============================================================================

alter table shops     add column if not exists logo_url    text;
alter table customers add column if not exists website     text;
alter table quotes    add column if not exists part_number text;
alter table quotes    add column if not exists pdf_style   text not null default 'classic';
