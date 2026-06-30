-- ============================================================================
-- QuoteForge — Phase 1 Database Schema (Supabase / Postgres)
-- ============================================================================
-- Foundation for the fab-shop quoting SaaS. Two non-negotiables are baked in:
--   1. RATE SNAPSHOTTING — every quote stores its own copy of the rates it was
--      built with, so editing the shop rate library NEVER rewrites a past quote.
--   2. ROW-LEVEL SECURITY — every table is isolated by shop_id at the database
--      level, so one shop can never read another shop's data, even with a bug
--      in application code.
--
-- Run order matters: extensions -> tables -> indexes -> RLS -> policies -> triggers.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";      -- uuid generation
create extension if not exists "pgcrypto";        -- gen_random_uuid()

-- ============================================================================
-- 1. SHOPS  (the tenant — everything isolates against this)
-- ============================================================================
create table shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  industry        text not null default 'metal_fab',   -- future: cnc, wood, etc.
  -- billing (Stripe) -- populated when they subscribe
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan            text not null default 'trial',        -- trial | solo | shop | shop_plus
  trial_ends_at   timestamptz default (now() + interval '14 days'),
  status          text not null default 'active',       -- active | past_due | cancelled
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================================
-- 2. USERS  (maps Supabase auth users to a shop)
-- ----------------------------------------------------------------------------
-- Supabase manages auth.users (login, passwords). This table links each auth
-- user to ONE shop and is the bridge RLS uses to know "which shop is this user".
-- The shop_id here is what every policy checks against.
-- ============================================================================
create table shop_users (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid not null references auth.users(id) on delete cascade,
  shop_id         uuid not null references shops(id) on delete cascade,
  full_name       text,
  role            text not null default 'owner',        -- owner | member (post-MVP)
  created_at      timestamptz not null default now(),
  unique (auth_user_id)                                  -- one user -> one shop (MVP)
);

create index idx_shop_users_auth on shop_users(auth_user_id);
create index idx_shop_users_shop on shop_users(shop_id);

-- ----------------------------------------------------------------------------
-- Helper: resolve the current request's shop_id from the JWT.
-- Every RLS policy calls this. SECURITY DEFINER lets it read shop_users
-- regardless of the caller's own policies (avoids recursion).
-- ----------------------------------------------------------------------------
create or replace function current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select shop_id from shop_users where auth_user_id = auth.uid() limit 1;
$$;

-- ============================================================================
-- 3. RATE LIBRARY  (the shop's current rates — the "live" set)
-- ----------------------------------------------------------------------------
-- One row per shop. This is what the rate-settings screen edits and what a NEW
-- quote copies from. Editing this does NOT touch existing quotes (see snapshot).
-- ============================================================================
create table shop_rates (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,

  -- labor ($/hr, fully loaded)
  rate_cutting    numeric(10,2) not null default 75,
  rate_fitting    numeric(10,2) not null default 80,
  rate_welding    numeric(10,2) not null default 90,
  rate_finishing  numeric(10,2) not null default 65,

  -- machine & material
  rate_burn       numeric(10,2) not null default 120,    -- $/hr plasma/laser
  price_steel     numeric(10,4) not null default 0.85,   -- $/lb (4dp: volatile)
  scrap_pct       numeric(5,2)  not null default 15,     -- drop allowance %
  rate_consumables numeric(10,2) not null default 12,    -- $/weld-hr

  -- business
  overhead_pct    numeric(5,2)  not null default 18,
  margin_pct      numeric(5,2)  not null default 30,

  -- per-field "last changed" tracking for the stale-rate nudge (jsonb keeps it
  -- flexible without 11 extra timestamp columns)
  changed_at      jsonb not null default '{}'::jsonb,

  updated_at      timestamptz not null default now(),
  unique (shop_id)                                        -- one rate set per shop
);

create index idx_shop_rates_shop on shop_rates(shop_id);

-- ============================================================================
-- 4. CUSTOMERS  (saved customers — feeds the quote editor & clone flow)
-- ============================================================================
create table customers (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  company_name    text not null,
  contact_name    text,
  contact_role    text,
  email           text,
  phone           text,
  address         text,
  default_terms   text default 'Net 30',
  po_reference    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_customers_shop on customers(shop_id);
-- search by company or contact name
create index idx_customers_search on customers
  using gin (to_tsvector('english', company_name || ' ' || coalesce(contact_name,'')));

-- ============================================================================
-- 5. QUOTES  (the heart — with rate snapshotting baked in)
-- ----------------------------------------------------------------------------
-- CRITICAL: rate_snapshot stores a copy of shop_rates AT CREATION TIME. The
-- quote's totals are computed from this snapshot, NOT from the live shop_rates.
-- This is why editing rates later never changes a quote that's already been
-- built or sent. Do not "optimize" this away by referencing shop_rates live.
-- ============================================================================
create table quotes (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  quote_number    text not null,                         -- e.g. Q-2026-051
  customer_id     uuid references customers(id) on delete set null,

  -- denormalised customer snapshot (so a quote PDF is stable even if the
  -- customer record is later edited or deleted)
  customer_name   text,
  customer_email  text,
  po_reference    text,

  -- job inputs (what the estimator enters)
  job_name        text not null,
  material_spec   text,
  material_weight numeric(10,2),                          -- lb
  quantity        integer not null default 1,
  burn_minutes    numeric(10,2) default 0,
  hrs_cutting     numeric(10,2) default 0,
  hrs_fitting     numeric(10,2) default 0,
  hrs_welding     numeric(10,2) default 0,
  hrs_finishing   numeric(10,2) default 0,
  outside_services numeric(10,2) default 0,               -- vendor pass-through $
  finish_spec     text,
  lead_time       text,
  notes           text,

  -- THE SNAPSHOT — frozen copy of shop_rates used for this quote's math
  rate_snapshot   jsonb not null,

  -- computed totals (stored so list/detail views don't recompute every read)
  total_cost      numeric(12,2),                          -- shop cost
  total_overhead  numeric(12,2),
  total_margin    numeric(12,2),
  quoted_price    numeric(12,2),

  -- lifecycle
  status          text not null default 'draft',          -- draft|sent|opened|won|lost
  sent_at         timestamptz,
  opened_at       timestamptz,
  decided_at      timestamptz,                            -- won/lost timestamp

  created_by      uuid references shop_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (shop_id, quote_number)                          -- numbers unique per shop
);

create index idx_quotes_shop on quotes(shop_id);
create index idx_quotes_status on quotes(shop_id, status);
create index idx_quotes_customer on quotes(customer_id);
create index idx_quotes_created on quotes(shop_id, created_at desc);

-- ============================================================================
-- 6. QUOTE ACTIVITY  (the timeline: created, sent, opened, won/lost)
-- ============================================================================
create table quote_events (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  quote_id        uuid not null references quotes(id) on delete cascade,
  event_type      text not null,                          -- created|sent|opened|won|lost|followup
  detail          text,                                   -- e.g. recipient email
  created_at      timestamptz not null default now()
);

create index idx_quote_events_quote on quote_events(quote_id, created_at);
create index idx_quote_events_shop on quote_events(shop_id);

-- ============================================================================
-- 7. ROW-LEVEL SECURITY  — the isolation guarantee
-- ----------------------------------------------------------------------------
-- Enable RLS on every tenant table, then add policies. The pattern is identical
-- for each: a row is visible/writable ONLY if its shop_id matches the caller's
-- shop (resolved from their JWT via current_shop_id()).
-- ============================================================================
alter table shops          enable row level security;
alter table shop_users     enable row level security;
alter table shop_rates     enable row level security;
alter table customers      enable row level security;
alter table quotes         enable row level security;
alter table quote_events   enable row level security;

-- SHOPS: a user sees only their own shop
create policy shop_isolation on shops
  for all
  using (id = current_shop_id())
  with check (id = current_shop_id());

-- SHOP_USERS: a user sees only members of their own shop
create policy shop_users_isolation on shop_users
  for all
  using (shop_id = current_shop_id())
  with check (shop_id = current_shop_id());

-- The remaining tables all follow one pattern: shop_id must match.
create policy rates_isolation on shop_rates
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy customers_isolation on customers
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy quotes_isolation on quotes
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

create policy quote_events_isolation on quote_events
  for all using (shop_id = current_shop_id()) with check (shop_id = current_shop_id());

-- ============================================================================
-- 8. TRIGGERS  — keep updated_at fresh
-- ============================================================================
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_shops_touch    before update on shops      for each row execute function touch_updated_at();
create trigger trg_rates_touch    before update on shop_rates for each row execute function touch_updated_at();
create trigger trg_customers_touch before update on customers for each row execute function touch_updated_at();
create trigger trg_quotes_touch   before update on quotes     for each row execute function touch_updated_at();

-- ============================================================================
-- 9. SIGN-UP BOOTSTRAP  — create shop + link user on first sign-up
-- ----------------------------------------------------------------------------
-- Call this once from the app right after Supabase auth sign-up. It creates the
-- shop, links the user, and seeds a default rate library in one transaction.
-- Runs as SECURITY DEFINER because at call time the user has no shop yet (so
-- RLS would otherwise block the inserts).
-- ============================================================================
create or replace function bootstrap_shop(
  p_shop_name text,
  p_full_name text,
  p_industry  text default 'metal_fab'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  insert into shops (name, industry) values (p_shop_name, p_industry)
    returning id into v_shop_id;

  insert into shop_users (auth_user_id, shop_id, full_name, role)
    values (auth.uid(), v_shop_id, p_full_name, 'owner');

  insert into shop_rates (shop_id) values (v_shop_id);   -- defaults from column defs

  return v_shop_id;
end;
$$;

-- ============================================================================
-- END SCHEMA
-- ============================================================================
