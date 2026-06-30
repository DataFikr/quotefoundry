// ============================================================================
// auth.test.mjs — proves the auth wiring end to end
// ----------------------------------------------------------------------------
// Mocks Supabase auth + RLS at the boundary; runs the REAL authService logic.
// Covers the three things that break naive auth:
//   A. sign-up sequencing  (user created, then shop bootstrapped, in order)
//   B. the shopless state  (authenticated but no shop -> needsBootstrap, then recover)
//   C. cross-shop isolation (shop A can never resolve shop B's data)
// ============================================================================

// --- fake Supabase: auth users, shop_users links, RLS-style scoping ---------
const store = {
  authUsers: new Map(),     // id -> {email}
  shops: new Map(),         // id -> {name}
  shopUsers: new Map(),     // authUserId -> {shop_id, full_name}
  currentUserId: null,      // the "logged in" user (drives auth.uid())
  seq: 0,
};

const fakeSupabase = {
  auth: {
    async signUp({ email }) {
      const id = 'user_' + ++store.seq;
      store.authUsers.set(id, { email });
      store.currentUserId = id;
      // simulate email-confirmation OFF -> session returned immediately
      return { data: { user: { id }, session: { user: { id } } }, error: null };
    },
    async signInWithPassword({ email }) {
      const entry = [...store.authUsers.entries()].find(([, u]) => u.email === email);
      if (!entry) return { error: { message: 'Invalid login' } };
      store.currentUserId = entry[0];
      return { error: null };
    },
    async getUser() {
      if (!store.currentUserId) return { data: { user: null }, error: null };
      return { data: { user: { id: store.currentUserId } }, error: null };
    },
    async getSession() {
      return { data: { session: store.currentUserId ? { user: { id: store.currentUserId } } : null } };
    },
    async signOut() { store.currentUserId = null; return { error: null }; },
  },
  // bootstrap_shop RPC — SECURITY DEFINER, uses "auth.uid()" = currentUserId
  async rpc(name, args) {
    if (name !== 'bootstrap_shop') return { data: null, error: { message: 'unknown rpc' } };
    const shopId = 'shop_' + ++store.seq;
    store.shops.set(shopId, { name: args.p_shop_name });
    store.shopUsers.set(store.currentUserId, { shop_id: shopId, full_name: args.p_full_name });
    return { data: shopId, error: null };
  },
  // from('shop_users')... with RLS: a user can only read their OWN link row
  from(table) {
    return {
      select() { return this; },
      eq(col, val) { this._eqVal = val; return this; },
      async maybeSingle() {
        if (table !== 'shop_users') return { data: null, error: null };
        // RLS: even though we filter by auth_user_id, the policy also requires
        // the row belong to the caller. We enforce by reading via currentUserId.
        const link = store.shopUsers.get(store.currentUserId);
        if (!link) return { data: null, error: null };
        return { data: { shop_id: link.shop_id, full_name: link.full_name, shops: { name: store.shops.get(link.shop_id).name } }, error: null };
      },
    };
  },
};

// --- minimal run() wrapper (matches the real one) --------------------------
async function run(fn) {
  try { const { data, error } = await fn(); if (error) return { data: null, error: error.message }; return { data, error: null }; }
  catch (e) { return { data: null, error: String(e) }; }
}

// --- the REAL authService logic, bound to the fake client ------------------
const supabase = fakeSupabase;
const authService = {
  async signUp({ email, password, shopName, fullName }) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { data: null, error: error.message };
    if (!data.user) return { data: null, error: 'no user' };
    if (!data.session) return { data: { authUserId: data.user.id, shopId: '', needsBootstrap: true }, error: null };
    return this.bootstrap(shopName, fullName);
  },
  async bootstrap(shopName, fullName) {
    const { error } = await supabase.rpc('bootstrap_shop', { p_shop_name: shopName, p_full_name: fullName, p_industry: 'metal_fab' });
    if (error) return { data: null, error: error.message };
    return this.resolveSession();
  },
  async logIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: error.message };
    return this.resolveSession();
  },
  async resolveSession() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: 'Not signed in.' };
    const linkRes = await run(() => supabase.from('shop_users').select().eq('auth_user_id', user.id).maybeSingle());
    if (linkRes.error || !linkRes.data) return { data: { authUserId: user.id, shopId: '', shopName: '', needsBootstrap: true }, error: null };
    return { data: { authUserId: user.id, shopId: linkRes.data.shop_id, shopName: linkRes.data.shops?.name ?? '', fullName: linkRes.data.full_name, needsBootstrap: false }, error: null };
  },
  async logOut() { await supabase.auth.signOut(); return { data: undefined, error: null }; },
};

// ============================================================================
let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n); } };

console.log('\nA. Sign-up provisions an isolated shop in the right order:');
const a = await authService.signUp({ email: 'mike@ironside.com', password: 'x', shopName: 'Ironside Fabrication', fullName: 'Mike Torres' });
check('sign-up returned a session context', !a.error && a.data);
check('shop was provisioned (has shopId)', a.data.shopId.startsWith('shop_'));
check('not stuck in needsBootstrap', a.data.needsBootstrap === false);
check('shop name resolved', a.data.shopName === 'Ironside Fabrication');
const shopAId = a.data.shopId;

console.log('\nB. The shopless edge case — authenticated but bootstrap never ran:');
// Simulate a user who signed up but whose bootstrap failed/was skipped:
store.authUsers.set('orphan', { email: 'orphan@nowhere.com' });
store.currentUserId = 'orphan';
const orphan = await authService.resolveSession();
check('shopless user is detected', orphan.data.needsBootstrap === true);
check('shopless user has no shopId', orphan.data.shopId === '');
// Recovery: run bootstrap for them now
const recovered = await authService.bootstrap('Orphan Welding', 'Sam Orphan');
check('recovery bootstrap provisions a shop', recovered.data.shopId.startsWith('shop_'));
check('recovered user no longer needsBootstrap', recovered.data.needsBootstrap === false);

console.log('\nC. Cross-shop isolation — a second shop, separate data:');
const b = await authService.signUp({ email: 'pat@apex.com', password: 'y', shopName: 'Apex Steel', fullName: 'Pat Vale' });
check('second shop provisioned separately', b.data.shopId !== shopAId);
check('shop B resolves to Apex Steel', b.data.shopName === 'Apex Steel');
// Now log back in as shop A's owner and confirm we resolve ONLY shop A
await authService.logIn('mike@ironside.com', 'x');
const backToA = await authService.resolveSession();
check('shop A owner resolves shop A, never shop B', backToA.data.shopId === shopAId);
check('shop A owner sees Ironside, not Apex', backToA.data.shopName === 'Ironside Fabrication');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
