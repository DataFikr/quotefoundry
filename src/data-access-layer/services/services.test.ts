// ============================================================================
// services.test.ts — Stage 2 functional gate. Exercises the REAL quoteService /
// rateService / customerService against the injected in-memory mock client,
// proving the rate-snapshot and RLS-isolation invariants in actual service code
// (not just the runApp harness).
// ============================================================================
import { describe, it, expect, beforeEach } from 'vitest';
// @ts-expect-error — .mjs mock has no types
import { createMockClient } from '../../mock-supabase/mockSupabase.mjs';
import { setSupabaseClient, supabase } from '../lib/supabase';
import { quoteService } from './quoteService';
import { rateService, customerService } from './rateService';
import type { QuoteInputs } from '../lib/types';

const job: QuoteInputs = {
  job_name: 'Stair stringers', material_weight: 240, quantity: 1, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5,
  outside_services: 85,
};

let client: any;
async function signUpShop(email: string, shopName: string) {
  await client.auth.signUp({ email, password: 'pw' });
  await client.rpc('bootstrap_shop', { p_shop_name: shopName, p_full_name: 'Owner', p_industry: 'metal_fab' });
}

beforeEach(() => {
  client = createMockClient();
  setSupabaseClient(client);
});

describe('rateService', () => {
  it('reads the seeded default rate library', async () => {
    await signUpShop('mike@ironside.com', 'Ironside Fabrication');
    const res = await rateService.get();
    expect(res.error).toBeNull();
    expect(res.data!.price_steel).toBe(0.85);
    expect(res.data!.margin_pct).toBe(30);
  });
});

describe('quoteService — snapshot + compute on save (CLAUDE.md §4.2/§4.3)', () => {
  beforeEach(() => signUpShop('mike@ironside.com', 'Ironside Fabrication'));

  it('create freezes a snapshot and stores the canonical price', async () => {
    const res = await quoteService.create(job, { name: 'Apex Industrial' });
    expect(res.error).toBeNull();
    const q = res.data!;
    expect(q.quote_number).toBe('Q-2026-001');
    expect(q.rate_snapshot.price_steel).toBe(0.85);
    expect(q.quoted_price).toBe(1913.82);
    expect(q.totals.quoted_price).toBe(1913.82);
  });

  it('editing shop rates NEVER changes an existing quote', async () => {
    const created = (await quoteService.create(job, { name: 'Apex' })).data!;
    await rateService.update({ price_steel: 1.2, rate_welding: 110 });
    const reloaded = (await quoteService.get(created.id)).data!;
    expect(reloaded.quoted_price).toBe(1913.82);
    expect(reloaded.totals.quoted_price).toBe(1913.82);
    // a NEW quote picks up the new rates
    const fresh = (await quoteService.create(job, { name: 'Apex' })).data!;
    expect(fresh.rate_snapshot.price_steel).toBe(1.2);
    expect(fresh.quoted_price).not.toBe(1913.82);
  });

  it('update() recomputes a draft from its EXISTING snapshot, not live rates', async () => {
    const created = (await quoteService.create(job, { name: 'Apex' })).data!;
    await rateService.update({ price_steel: 5.0 }); // wild live change
    const updated = (await quoteService.update(created.id, { ...job, quantity: 2 })).data!;
    // still priced from the original 0.85 snapshot, just qty changed
    expect(updated.rate_snapshot.price_steel).toBe(0.85);
    expect(updated.quoted_price).toBe(1913.82);
    expect(updated.totals.per_unit).toBe(Math.round((1913.82 / 2) * 100) / 100);
  });

  it('clone() re-snapshots at CURRENT rates (today\'s cost)', async () => {
    const created = (await quoteService.create(job, { name: 'Apex' })).data!;
    await rateService.update({ price_steel: 1.2 });
    const clone = (await quoteService.clone(created.id)).data!;
    expect(clone.id).not.toBe(created.id);
    expect(clone.quote_number).toBe('Q-2026-002');
    expect(clone.rate_snapshot.price_steel).toBe(1.2);
  });

  it('markOpened only advances from sent, never downgrades won/lost (§4.5)', async () => {
    const q = (await quoteService.create(job, { name: 'Apex' })).data!;
    await quoteService.markOutcome(q.id, 'won');
    const tryOpen = await quoteService.markOpened(q.id); // should not apply (status != sent)
    expect(tryOpen.error).toBeTruthy(); // no matching 'sent' row to update
    expect((await quoteService.get(q.id)).data!.status).toBe('won');
  });
});

describe('per-shop isolation — RLS enforced by the client, not app code (§4.1)', () => {
  it('shop B cannot see shop A\'s quotes; A still sees its own', async () => {
    await signUpShop('mike@ironside.com', 'Ironside Fabrication');
    const a = (await quoteService.create(job, { name: 'Apex' })).data!;

    await client.auth.signOut();
    await signUpShop('pat@apex.com', 'Apex Steel');
    const bList = (await quoteService.list()).data!;
    expect(bList.length).toBe(0);
    // adversarial: fetch A's quote by id while logged in as B → not found
    const stolen = await quoteService.get(a.id);
    expect(stolen.error).toBeTruthy();

    await client.auth.signOut();
    await client.auth.signInWithPassword({ email: 'mike@ironside.com', password: 'pw' });
    expect((await quoteService.list()).data!.length).toBe(1);
  });
});

describe('customerService', () => {
  beforeEach(() => signUpShop('mike@ironside.com', 'Ironside Fabrication'));
  it('creates and searches customers within the shop', async () => {
    await customerService.create({ company_name: 'Apex Industrial', contact_name: 'Dana Reyes' });
    await customerService.create({ company_name: 'Bolt & Beam', contact_name: 'Sam Lee' });
    expect((await customerService.list()).data!.length).toBe(2);
    expect((await customerService.list('apex')).data!.length).toBe(1);
    // void unused import lint
    expect(supabase).toBeTruthy();
  });
});
