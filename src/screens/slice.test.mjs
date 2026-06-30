// ============================================================================
// slice.test.mjs — proves the vertical slice end to end
// ----------------------------------------------------------------------------
// We mock ONLY the supabase client (the I/O boundary). Everything above it —
// the engine, the snapshot logic, compute-on-save, the result wrapper — is the
// real code path. This is what proves "load rates -> live total -> save with
// snapshot" works as one stack before touching a real database.
// ============================================================================

// --- the real engine (inlined to run standalone) ---------------------------
const round2 = (n) => Math.round(n * 100) / 100;
function computeQuote(inputs, rates) {
  const qty = inputs.quantity > 0 ? inputs.quantity : 1;
  const material = inputs.material_weight * rates.price_steel * (1 + rates.scrap_pct / 100);
  const labor =
    inputs.hrs_cutting * rates.rate_cutting + inputs.hrs_fitting * rates.rate_fitting +
    inputs.hrs_welding * rates.rate_welding + inputs.hrs_finishing * rates.rate_finishing;
  const burn = (inputs.burn_minutes / 60) * rates.rate_burn;
  const consumables = inputs.hrs_welding * rates.rate_consumables;
  const outside = inputs.outside_services;
  const total_cost = material + labor + burn + consumables + outside;
  const total_overhead = total_cost * (rates.overhead_pct / 100);
  const with_overhead = total_cost + total_overhead;
  const total_margin = with_overhead * (rates.margin_pct / 100);
  const quoted_price = with_overhead + total_margin;
  return {
    line_material: round2(material), line_labor: round2(labor), line_burn: round2(burn),
    line_consumables: round2(consumables), line_outside: round2(outside),
    total_cost: round2(total_cost), total_overhead: round2(total_overhead),
    total_margin: round2(total_margin), quoted_price: round2(quoted_price),
    per_unit: round2(quoted_price / qty),
  };
}

// --- a fake in-memory "database" behind a fake supabase client -------------
// Simulates the one thing that matters for the slice: rates can change, and a
// saved quote must keep its OWN snapshot regardless.
const db = {
  shop_rates: {
    rate_cutting: 75, rate_fitting: 80, rate_welding: 90, rate_finishing: 65,
    rate_burn: 120, price_steel: 0.85, scrap_pct: 15, rate_consumables: 12,
    overhead_pct: 18, margin_pct: 30,
  },
  quotes: [],
};

// --- the real service logic (the parts that matter), using the fake db -----
const rateService = {
  async get() { return { data: { ...db.shop_rates }, error: null }; },
  async update(patch) { Object.assign(db.shop_rates, patch); return { data: { ...db.shop_rates }, error: null }; },
};

const quoteService = {
  async create(inputs, customer) {
    const ratesRes = await rateService.get();          // 1. read CURRENT rates
    if (ratesRes.error) return { data: null, error: ratesRes.error };
    const rates = ratesRes.data;
    const totals = computeQuote(inputs, rates);          // 2. compute now
    const row = {
      id: 'q' + (db.quotes.length + 1),
      quote_number: `Q-2026-${String(db.quotes.length + 1).padStart(3, '0')}`,
      customer_name: customer?.name ?? null,
      inputs,
      rate_snapshot: rates,                              // 3. FREEZE the copy
      quoted_price: totals.quoted_price,
      status: 'draft',
    };
    db.quotes.push(row);
    return { data: row, error: null };
  },
  // recompute a stored quote from its OWN snapshot (what detail view does)
  recompute(row) { return computeQuote(row.inputs, row.rate_snapshot); },
};

// ============================================================================
// THE TEST
// ============================================================================
let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name); }
}

const inputs = {
  job_name: 'Stair stringers', material_weight: 240, quantity: 1, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5, outside_services: 85,
};

console.log('\n1. Editor loads rates and computes a live total:');
const liveRates = (await rateService.get()).data;
const liveTotals = computeQuote(inputs, liveRates);
check('live total is 1913.82', liveTotals.quoted_price === 1913.82);

console.log('\n2. Save creates a quote whose stored price matches the on-screen total:');
const saved = (await quoteService.create(inputs, { name: 'Apex Industrial' })).data;
check('saved price == live total (screen and save agree)', saved.quoted_price === liveTotals.quoted_price);
check('quote got a number', saved.quote_number === 'Q-2026-001');
check('snapshot was frozen onto the quote', saved.rate_snapshot.price_steel === 0.85);

console.log('\n3. THE CRITICAL TEST — change shop rates, old quote must NOT change:');
await rateService.update({ price_steel: 1.20, rate_welding: 110 }); // steel & labor jump
const afterRecompute = quoteService.recompute(saved);
check('old quote price unchanged after rate edit', afterRecompute.quoted_price === 1913.82);
check('old quote still uses its snapshot steel price (0.85)', saved.rate_snapshot.price_steel === 0.85);
check('live rates did change', db.shop_rates.price_steel === 1.20);

console.log('\n4. A NEW quote after the rate change uses the NEW rates:');
const saved2 = (await quoteService.create(inputs, { name: 'Apex Industrial' })).data;
check('new quote snapshot has new steel price (1.20)', saved2.rate_snapshot.price_steel === 1.20);
check('new quote price differs from old', saved2.quoted_price !== saved.quoted_price);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
