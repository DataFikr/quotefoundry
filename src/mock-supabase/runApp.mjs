// ============================================================================
// runApp.mjs — runs the WHOLE app flow through the mock Supabase client
// ----------------------------------------------------------------------------
// This is the closest thing to "the app runs" without a real backend:
//   sign up -> shop provisioned -> build a quote -> save (snapshot) -> list ->
//   clone -> mark won -> change rates -> confirm old quote unchanged ->
//   second shop can't see the first's data.
// Uses the mock client + the real service logic shapes.
// ============================================================================

import { createMockClient } from './mockSupabase.mjs';

const supabase = createMockClient();

// --- engine (real) ---
const round2 = (n) => Math.round(n * 100) / 100;
function computeQuote(i, r) {
  const qty = i.quantity > 0 ? i.quantity : 1;
  const material = i.material_weight * r.price_steel * (1 + r.scrap_pct / 100);
  const labor = i.hrs_cutting*r.rate_cutting + i.hrs_fitting*r.rate_fitting + i.hrs_welding*r.rate_welding + i.hrs_finishing*r.rate_finishing;
  const burn = (i.burn_minutes/60)*r.rate_burn;
  const cons = i.hrs_welding*r.rate_consumables;
  const cost = material+labor+burn+cons+i.outside_services;
  const oh = cost*(r.overhead_pct/100), wo = cost+oh, m = wo*(r.margin_pct/100);
  return { quoted_price: round2(wo+m), total_cost: round2(cost) };
}

// --- minimal real service logic over the mock client ---
const authService = {
  async signUp(email, password, shopName, fullName) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    await supabase.rpc('bootstrap_shop', { p_shop_name: shopName, p_full_name: fullName, p_industry: 'metal_fab' });
    return await this.resolve();
  },
  async logIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return this.resolve();
  },
  async resolve() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'not signed in' };
    const link = await supabase.from('shop_users').select().eq('auth_user_id', user.id).maybeSingle();
    if (!link.data) return { data: { shopId: '', needsBootstrap: true } };
    const shop = await supabase.from('shops').select().eq('id', link.data.shop_id).single();
    return { data: { shopId: link.data.shop_id, shopName: shop.data.name, needsBootstrap: false } };
  },
};
const rateService = {
  async get() { const r = await supabase.from('shop_rates').select('*').single(); return r.data; },
  async update(patch) { return supabase.from('shop_rates').update(patch).select().single(); },
};
const quoteService = {
  async create(inputs, customer) {
    const rates = await rateService.get();
    const totals = computeQuote(inputs, rates);
    // DEEP-COPY the rates before storing them as the snapshot. Storing the
    // reference would let a later rate edit mutate this "frozen" copy. In real
    // Postgres JSONB is copied by value, but the app must still snapshot a copy
    // defensively so nothing upstream can share the reference.
    const rateSnapshot = structuredClone(rates);
    const r = await supabase.from('quotes').insert({
      quote_number: 'Q-2026-' + String([...supabase._store.quotes.values()].length + 1).padStart(3, '0'),
      customer_name: customer?.name ?? null,
      ...inputs,
      rate_snapshot: rateSnapshot,
      quoted_price: totals.quoted_price,
      status: 'draft',
    }).select().single();
    return r.data;
  },
  async list(opts = {}) {
    let qb = supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (opts.status) qb = qb.eq('status', opts.status);
    return (await qb).data;
  },
  async clone(srcId) {
    const src = (await supabase.from('quotes').select('*').eq('id', srcId).single()).data;
    return this.create({
      job_name: src.job_name, material_weight: src.material_weight, quantity: src.quantity,
      burn_minutes: src.burn_minutes, hrs_cutting: src.hrs_cutting, hrs_fitting: src.hrs_fitting,
      hrs_welding: src.hrs_welding, hrs_finishing: src.hrs_finishing, outside_services: src.outside_services,
    }, { name: src.customer_name });
  },
  async markWon(id) { return supabase.from('quotes').update({ status: 'won' }).eq('id', id).select().single(); },
  recompute(row) { return computeQuote(row, row.rate_snapshot); },
};

// ============================================================================
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

const job = { job_name: 'Stair stringers', material_weight: 240, quantity: 1, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5, outside_services: 85 };

console.log('\n1. Sign up -> shop provisioned -> rates seeded:');
const su = await authService.signUp('mike@ironside.com', 'pw', 'Ironside Fabrication', 'Mike Torres');
check('signed up and provisioned', su.data.shopId.startsWith('shop_'));
check('lands ready, not shopless', su.data.needsBootstrap === false);
const rates = await rateService.get();
check('default rates seeded', rates.price_steel === 0.85);

console.log('\n2. Build & save a quote (snapshot taken):');
const q1 = await quoteService.create(job, { name: 'Apex Industrial' });
check('quote saved with a number', q1.quote_number === 'Q-2026-001');
check('snapshot frozen onto quote', q1.rate_snapshot.price_steel === 0.85);
check('price computed and stored', q1.quoted_price === 1913.82);

console.log('\n3. Pipeline list shows it:');
const list1 = await quoteService.list();
check('one quote in pipeline', list1.length === 1);
check('list filter by status works', (await quoteService.list({ status: 'draft' })).length === 1);

console.log('\n4. Clone -> mark won:');
const q2 = await quoteService.clone(q1.id);
check('clone created a second quote', q2.id !== q1.id && (await quoteService.list()).length === 2);
await quoteService.markWon(q1.id);
const wonList = await quoteService.list({ status: 'won' });
check('original now shows as won', wonList.length === 1 && wonList[0].id === q1.id);

console.log('\n5. Change rates -> old quote price UNCHANGED (snapshot holds):');
await rateService.update({ price_steel: 1.20, rate_welding: 110 });
const reloaded = (await supabase.from('quotes').select('*').eq('id', q1.id).single()).data;
check('old quote still computes 1913.82 from its snapshot', quoteService.recompute(reloaded).quoted_price === 1913.82);
const q3 = await quoteService.create(job, { name: 'Apex Industrial' });
check('a NEW quote uses the new steel price', q3.rate_snapshot.price_steel === 1.20);
check('new quote price differs from old', q3.quoted_price !== q1.quoted_price);

console.log('\n6. ISOLATION — a second shop cannot see the first shop\'s quotes:');
await supabase.auth.signOut();
const su2 = await authService.signUp('pat@apex.com', 'pw', 'Apex Steel', 'Pat Vale');
check('second shop provisioned separately', su2.data.shopId !== su.data.shopId);
const apexQuotes = await quoteService.list();
check('Apex sees ZERO quotes (Ironside\'s are invisible)', apexQuotes.length === 0);
// back to Ironside
await supabase.auth.signOut();
await authService.logIn('mike@ironside.com', 'pw');
const ironsideQuotes = await quoteService.list();
check('Ironside still sees its own 3 quotes', ironsideQuotes.length === 3);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
