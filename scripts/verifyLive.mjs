// ============================================================================
// verifyLive.mjs — the Stage-8 gate, run against the REAL Supabase project.
//   npm run verify:live
// Reads .env.production (or env vars). Exercises, with the ANON key only
// (exactly what the browser gets):
//   1. sign-up → bootstrap_shop() → provisioned shop with seeded rates
//   2. save a quote with a frozen rate snapshot (canonical $1,913.82 job)
//   3. ADVERSARIAL ISOLATION: a second shop tries to read the first shop's
//      quote by id, and to list quotes — both must come back empty (RLS).
// Uses throwaway accounts (verify+<ts>@quotefoundry.app). If Supabase email
// confirmation is ON, sign-up returns no session — the script tells you to
// turn it off (Auth → Providers → Email → "Confirm email") or use the
// service-role admin API to confirm; it does not silently pass.
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// --- minimal .env.production loader (no dotenv dependency) -------------------
for (const file of ['.env.production', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('FAIL  missing SUPABASE_URL / ANON key (fill .env.production)');
  process.exit(1);
}
if (/\/rest\/v1\/?$/.test(URL)) {
  console.error('FAIL  SUPABASE_URL must be the bare project URL — remove the /rest/v1/ suffix');
  process.exit(1);
}

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

const ts = Date.now();
const PASSWORD = 'verify-' + ts;

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function provisionShop(label, shopName) {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  // plain-form address — Supabase's validator rejects some plus-addressed/new-TLD forms
  const email = `qfverify.${label}${ts}@gmail.com`;

  if (SERVICE_KEY) {
    // Admin-create a pre-confirmed test user, then log in with the anon client —
    // works regardless of the project's "Confirm email" setting. Everything
    // AFTER login still runs with the anon key only (what the browser gets).
    const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { error: createErr } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
    });
    if (createErr) throw new Error(`admin createUser failed for ${email}: ${createErr.message}`);
    const { error: loginErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (loginErr) throw new Error(`login failed for ${email}: ${loginErr.message}`);
  } else {
    const { data, error } = await client.auth.signUp({ email, password: PASSWORD });
    if (error) throw new Error(`sign-up failed for ${email}: ${error.message}`);
    if (!data.session) {
      console.error(
        '\nFAIL  sign-up returned no session — email confirmation is ON.\n' +
        '      Either set SUPABASE_SERVICE_ROLE_KEY in .env.production (this script will\n' +
        '      admin-confirm its throwaway users), or disable Authentication → Providers\n' +
        '      → Email → "Confirm email" in the Supabase dashboard, then re-run.'
      );
      process.exit(1);
    }
  }

  const { error: rpcErr, data: shopId } = await client.rpc('bootstrap_shop', {
    p_shop_name: shopName, p_full_name: 'Verify Bot', p_industry: 'metal_fab',
  });
  if (rpcErr) throw new Error(`bootstrap_shop failed: ${rpcErr.message}`);
  return { client, email, shopId };
}

console.log(`\nLive verification against ${URL}\n`);

// 1. provision shop A and confirm seeded rates
console.log('1. Sign-up provisions a shop (bootstrap_shop):');
const A = await provisionShop('a', 'Verify Shop A');
const { data: ratesA } = await A.client.from('shop_rates').select('*').single();
check('shop A provisioned with seeded rates', Boolean(ratesA), 'no shop_rates row');
check('canonical steel price seeded', Number(ratesA?.price_steel) === 0.85);

// 2. save the canonical quote (engine math is test-locked client-side; here we
//    verify the DB round-trip: insert with snapshot, read back intact)
console.log('\n2. Save-quote round-trip (rate snapshot frozen onto the row):');
const { data: qRow, error: qErr } = await A.client.from('quotes').insert({
  quote_number: `Q-${new Date().getFullYear()}-001`,
  job_name: 'Verify stair stringers',
  material_spec: 'A36 Steel', material_weight: 240, quantity: 1,
  burn_minutes: 35, hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5,
  outside_services: 85,
  rate_snapshot: ratesA,
  total_cost: 1247.60, total_overhead: 224.57, total_margin: 441.65, quoted_price: 1913.82,
  status: 'draft',
}).select().single();
check('quote inserted', Boolean(qRow), qErr?.message);
if (!qRow) {
  console.error(
    '\nFAIL  quote insert was rejected. If the error above is an RLS violation,\n' +
    '      run server/migrations/2026-07-03_shop_id_defaults.sql in the Supabase\n' +
    '      SQL editor (stamps shop_id on insert), then re-run.\n'
  );
  process.exit(1);
}
check('snapshot stored by value', Number(qRow?.rate_snapshot?.price_steel) === 0.85);
check('quoted_price stored', Number(qRow?.quoted_price) === 1913.82);

// 3. adversarial isolation
console.log('\n3. ADVERSARIAL ISOLATION (CLAUDE.md §4.1):');
const B = await provisionShop('b', 'Verify Shop B');
const { data: foreign } = await B.client.from('quotes').select('*').eq('id', qRow.id).maybeSingle();
check("shop B CANNOT fetch shop A's quote by id", foreign === null);
const { data: listB } = await B.client.from('quotes').select('id');
check('shop B lists ZERO quotes', Array.isArray(listB) && listB.length === 0);
const { data: listA } = await A.client.from('quotes').select('id');
check('shop A still sees its own quote', Array.isArray(listA) && listA.length === 1);
// cross-shop write must also fail (RLS blocks the UPDATE, returning 0 rows)
const { data: tamper } = await B.client.from('quotes')
  .update({ status: 'lost' }).eq('id', qRow.id).select();
check("shop B CANNOT modify shop A's quote", Array.isArray(tamper) && tamper.length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
console.log(failed === 0
  ? '\nStage-8 gate: GREEN — live Supabase round-trip + isolation verified.\n'
  : '\nStage-8 gate: RED — fix the failures above before going further.\n');
process.exit(failed === 0 ? 0 : 1);
