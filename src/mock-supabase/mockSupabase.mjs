// ============================================================================
// mockSupabase.mjs — an in-memory stand-in for the Supabase client
// ----------------------------------------------------------------------------
// Implements the subset of the supabase-js surface the services call, AND
// simulates Row-Level Security: a "session" tracks the logged-in user, the
// mock resolves their shop, and every shop-scoped query is auto-filtered to
// that shop (and inserts auto-stamp shop_id). This means the app runs end to
// end locally with the SAME isolation behaviour it'll have in production —
// without a real Supabase project.
//
// Swap import: in dev, point lib/supabase at this; in prod, the real client.
// ============================================================================

const SHOP_SCOPED = new Set(['shop_rates', 'customers', 'quotes', 'quote_events', 'shops']);

export function createMockClient() {
  // ---- in-memory store ----------------------------------------------------
  const store = {
    auth_users: new Map(),   // id -> { email, password }
    shops: new Map(),        // id -> row
    shop_users: new Map(),   // id -> row (auth_user_id, shop_id, ...)
    shop_rates: new Map(),
    customers: new Map(),
    quotes: new Map(),
    quote_events: new Map(),
  };
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  let session = null;        // { userId }

  // resolve current shop from session (mirrors current_shop_id() in SQL)
  function currentShopId() {
    if (!session) return null;
    for (const su of store.shop_users.values())
      if (su.auth_user_id === session.userId) return su.shop_id;
    return null;
  }

  // ---- a chainable, awaitable query builder -------------------------------
  function from(table) {
    const q = {
      _table: table,
      _op: 'select',
      _filters: [],     // {col, val}
      _or: null,
      _payload: null,
      _order: null,
      _limit: null,
      _single: false,
      _maybe: false,

      select(projection) { q._projection = projection || '*'; return q; },
      insert(payload) { q._op = 'insert'; q._payload = payload; return q; },
      update(payload) { q._op = 'update'; q._payload = payload; return q; },
      delete() { q._op = 'delete'; return q; },
      eq(col, val) { q._filters.push({ col, val }); return q; },
      or(expr) { q._or = expr; return q; },
      order(col, opts) { q._order = { col, asc: opts?.ascending !== false }; return q; },
      limit(n) { q._limit = n; return q; },
      ilike() { return q; },           // search handled via _or in services
      single() { q._single = true; return q.then(); },
      maybeSingle() { q._single = true; q._maybe = true; return q.then(); },
      then(resolve, reject) { return run(q).then(resolve, reject); },
    };
    return q;
  }

  function run(q) {
    return new Promise((resolve) => {
      const tbl = store[q._table];
      if (!tbl) return resolve({ data: null, error: { message: `no table ${q._table}` } });
      const shopId = currentShopId();

      // ---- INSERT ----
      if (q._op === 'insert') {
        const rows = Array.isArray(q._payload) ? q._payload : [q._payload];
        const inserted = rows.map((r) => {
          const row = { id: id(q._table), created_at: new Date().toISOString(), ...r };
          // RLS-style: shop-scoped inserts get the caller's shop stamped on.
          if (SHOP_SCOPED.has(q._table) && q._table !== 'shops') row.shop_id = shopId;
          tbl.set(row.id, row);
          return row;
        });
        const data = q._single ? inserted[0] : inserted;
        return resolve({ data, error: null });
      }

      // ---- gather rows with RLS scoping ----
      let rows = [...tbl.values()];
      if (SHOP_SCOPED.has(q._table)) {
        // THE ISOLATION RULE: only rows belonging to the caller's shop.
        rows = rows.filter((r) =>
          q._table === 'shops' ? r.id === shopId : r.shop_id === shopId
        );
      }
      // exact filters
      for (const f of q._filters) rows = rows.filter((r) => r[f.col] === f.val);
      // search (services pass an `or` of ilike clauses: "a.ilike.%x%,b.ilike.%x%")
      if (q._or) {
        const terms = q._or.split(',').map((c) => {
          const [col, , pat] = c.split('.');
          return { col, needle: pat.replace(/%/g, '').toLowerCase() };
        });
        rows = rows.filter((r) =>
          terms.some((t) => String(r[t.col] ?? '').toLowerCase().includes(t.needle))
        );
      }

      // ---- UPDATE ----
      if (q._op === 'update') {
        const updated = rows.map((r) => {
          Object.assign(r, q._payload);
          return r;
        });
        const data = q._single ? updated[0] ?? null : updated;
        if (q._single && !data) return resolve({ data: null, error: { message: 'no row' } });
        return resolve({ data, error: null });
      }

      // ---- DELETE ----
      if (q._op === 'delete') {
        rows.forEach((r) => tbl.delete(r.id));
        return resolve({ data: rows, error: null });
      }

      // ---- SELECT ----
      // Resolve a PostgREST-style embed, e.g. shop_users.select('..., shops(name)').
      // The services only embed shops(name) on shop_users; support that generically.
      if (q._projection && /shops\s*\(/.test(q._projection) && q._table === 'shop_users') {
        rows = rows.map((r) => ({ ...r, shops: store.shops.get(r.shop_id) ?? null }));
      }
      if (q._order) {
        rows.sort((a, b) => {
          const av = a[q._order.col], bv = b[q._order.col];
          return (av > bv ? 1 : av < bv ? -1 : 0) * (q._order.asc ? 1 : -1);
        });
      }
      if (q._limit) rows = rows.slice(0, q._limit);
      if (q._single) {
        if (rows.length === 0)
          return resolve(q._maybe ? { data: null, error: null } : { data: null, error: { message: 'no rows' } });
        return resolve({ data: rows[0], error: null });
      }
      resolve({ data: rows, error: null });
    });
  }

  // ---- auth ---------------------------------------------------------------
  const auth = {
    async signUp({ email, password }) {
      for (const u of store.auth_users.values())
        if (u.email === email) return { data: null, error: { message: 'Email already registered' } };
      const uid = id('user');
      store.auth_users.set(uid, { id: uid, email, password });
      session = { userId: uid };                       // confirmation OFF in mock
      return { data: { user: { id: uid }, session: { user: { id: uid } } }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const u = [...store.auth_users.values()].find((x) => x.email === email);
      if (!u || u.password !== password) return { error: { message: 'Invalid login credentials' } };
      session = { userId: u.id };
      return { error: null };
    },
    async signInWithOAuth() { return { error: null }; },
    async getUser() {
      return { data: { user: session ? { id: session.userId } : null }, error: null };
    },
    async getSession() {
      return { data: { session: session ? { user: { id: session.userId } } : null } };
    },
    async signOut() { session = null; return { error: null }; },
    async resetPasswordForEmail() { return { error: null }; },
    async updateUser() { return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    admin: {
      async getUserById(uid) {
        const u = store.auth_users.get(uid);
        return { data: { user: u ? { email: u.email } : null } };
      },
    },
  };

  // ---- rpc: bootstrap_shop (SECURITY DEFINER — runs for the calling user) --
  async function rpc(name, args) {
    if (name !== 'bootstrap_shop') return { data: null, error: { message: 'unknown rpc' } };
    if (!session) return { data: null, error: { message: 'no session' } };
    const shopId = id('shop');
    store.shops.set(shopId, { id: shopId, name: args.p_shop_name, industry: args.p_industry, plan: 'trial' });
    store.shop_users.set(id('su'), { id: id('su'), auth_user_id: session.userId, shop_id: shopId, full_name: args.p_full_name, role: 'owner' });
    // seed default rate library
    store.shop_rates.set(id('rates'), {
      id: id('rates'), shop_id: shopId,
      rate_cutting: 75, rate_fitting: 80, rate_welding: 90, rate_finishing: 65,
      rate_burn: 120, price_steel: 0.85, scrap_pct: 15, rate_consumables: 12,
      overhead_pct: 18, margin_pct: 30,
      // default material library ($/lb). A36 Steel @ 0.85 keeps the canonical
      // quote's price identical to price_steel.
      materials: [
        { name: 'A36 Steel', price: 0.85 },
        { name: 'A500 Tube', price: 0.95 },
        { name: '304 Stainless', price: 2.10 },
        { name: '6061 Aluminum', price: 1.85 },
      ],
    });
    return { data: shopId, error: null };
  }

  // ---- edge function invoke (email send) ----------------------------------
  const functions = {
    async invoke(_name, { body }) {
      // simulate the server marking the quote sent
      for (const r of store.quotes.values())
        if (r.id === body.quoteId) { r.status = 'sent'; r.sent_at = new Date().toISOString(); }
      return { data: { ok: true, emailId: id('email') }, error: null };
    },
  };

  return { from, auth, rpc, functions, _store: store, _currentShopId: currentShopId };
}
