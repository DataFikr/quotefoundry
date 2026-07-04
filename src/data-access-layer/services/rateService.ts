// ============================================================================
// rateService.ts — read and update the shop's rate library
// ----------------------------------------------------------------------------
// Editing rates here affects FUTURE quotes only. Existing quotes hold their own
// snapshot (see quoteService), so this update never touches them.
// ============================================================================

import { supabase, run, ok, Result } from '../lib/supabase';
import type { ShopRates } from '../lib/types';

export const rateService = {
  // The shop has exactly one rate row (enforced by unique(shop_id) + RLS scope).
  async get(): Promise<Result<ShopRates>> {
    const res = await run<any>(() =>
      supabase.from('shop_rates').select('*').single()
    );
    if (res.error) return res;
    const r = res.data;
    return ok({
      rate_cutting: Number(r.rate_cutting),
      rate_fitting: Number(r.rate_fitting),
      rate_welding: Number(r.rate_welding),
      rate_finishing: Number(r.rate_finishing),
      rate_burn: Number(r.rate_burn),
      price_steel: Number(r.price_steel),
      scrap_pct: Number(r.scrap_pct),
      rate_consumables: Number(r.rate_consumables),
      overhead_pct: Number(r.overhead_pct),
      margin_pct: Number(r.margin_pct),
      materials: Array.isArray(r.materials) ? r.materials : [],
    });
  },

  // Partial update — only changed fields. Also stamps changed_at per field for
  // the stale-rate nudge on the settings screen.
  // NOTE: PostgREST (Supabase default) rejects UPDATE without a WHERE clause
  // (error 21000), so we target the shop's single row by id — RLS already
  // guarantees that id can only be the caller's own row.
  async update(patch: Partial<ShopRates>): Promise<Result<ShopRates>> {
    const cur = await run<any>(() => supabase.from('shop_rates').select('id').single());
    if (cur.error) return cur;

    const now = new Date().toISOString();
    const changed: Record<string, string> = {};
    for (const key of Object.keys(patch)) changed[key] = now;

    const res = await run<any>(() =>
      supabase
        .from('shop_rates')
        .update({ ...patch, changed_at: changed })
        .eq('id', cur.data.id)
        .select()
        .single()
    );
    return res.error ? res : this.get();
  },
};

// ============================================================================
// customerService.ts — saved customers (feeds editor + clone)
// ============================================================================

import type { Customer } from '../lib/types';

export const customerService = {
  async list(search?: string): Promise<Result<Customer[]>> {
    let q = supabase.from('customers').select('*').order('company_name');
    if (search) {
      const s = `%${search}%`;
      q = q.or(`company_name.ilike.${s},contact_name.ilike.${s}`);
    }
    return run<Customer[]>(() => q);
  },

  async get(id: string): Promise<Result<Customer>> {
    return run<Customer>(() =>
      supabase.from('customers').select('*').eq('id', id).single()
    );
  },

  async create(c: Omit<Customer, 'id'>): Promise<Result<Customer>> {
    return run<Customer>(() =>
      supabase.from('customers').insert(c).select().single()
    );
  },

  async update(id: string, patch: Partial<Customer>): Promise<Result<Customer>> {
    return run<Customer>(() =>
      supabase.from('customers').update(patch).eq('id', id).select().single()
    );
  },

  // Existing quotes keep their snapshotted customer name/email, so deleting a
  // customer never breaks a sent quote (quotes.customer_id is ON DELETE SET NULL).
  async remove(id: string): Promise<Result<Customer[]>> {
    return run<Customer[]>(() =>
      supabase.from('customers').delete().eq('id', id).select()
    );
  },
};

// ============================================================================
// shopService.ts — sign-up bootstrap
// ----------------------------------------------------------------------------
// Calls the bootstrap_shop() Postgres function (SECURITY DEFINER) right after
// Supabase auth sign-up: creates the shop, links the user, seeds default rates.
// Must run before any other service call, because until it does the user has
// no shop and RLS will (correctly) block everything.
// ============================================================================

import type { ShopInfo } from '../lib/types';

export const shopService = {
  async bootstrap(shopName: string, fullName: string): Promise<Result<string>> {
    return run<string>(() =>
      supabase.rpc('bootstrap_shop', {
        p_shop_name: shopName,
        p_full_name: fullName,
        p_industry: 'metal_fab',
      }).then((r: any) => ({ data: r.data, error: r.error }))
    );
  },

  // The caller's own shop (RLS scopes the read — no shop_id passed).
  async get(): Promise<Result<ShopInfo>> {
    const res = await run<any>(() => supabase.from('shops').select('*').single());
    if (res.error) return res;
    return ok({
      id: res.data.id,
      name: res.data.name,
      logo_url: res.data.logo_url ?? undefined,
      plan: res.data.plan ?? undefined,
      created_at: res.data.created_at ?? undefined,
    });
  },

  // Store the shop logo (data-URL for now; a storage URL once files move to
  // Supabase Storage). RLS restricts the update to the caller's own shop row;
  // the explicit id satisfies PostgREST's no-WHERE-no-UPDATE rule.
  async setLogo(logoDataUrl: string): Promise<Result<ShopInfo>> {
    const cur = await this.get();
    if (cur.error) return cur as Result<ShopInfo>;
    const res = await run<any>(() =>
      supabase.from('shops').update({ logo_url: logoDataUrl }).eq('id', cur.data!.id).select().single()
    );
    if (res.error) return res;
    return ok({ id: res.data.id, name: res.data.name, logo_url: res.data.logo_url ?? undefined });
  },
};
