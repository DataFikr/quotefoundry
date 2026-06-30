// ============================================================================
// supabase.ts — the single shared client + a consistent result wrapper
// ----------------------------------------------------------------------------
// ONE client instance for the whole app. It holds the logged-in user's session,
// so every query automatically carries their auth token — which is exactly what
// Row-Level Security reads to isolate data by shop. Services never pass shop_id
// by hand; the token + RLS do it.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Build the real client only when env is present (prod / Stage 8). In tests and
// pre-wiring dev the env is empty, so we leave it null and let the mock client be
// injected via setSupabaseClient(). `export let` gives a LIVE binding: services
// that `import { supabase }` see whatever it's reassigned to, so injection works
// without touching any service.
function makeRealClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export let supabase: SupabaseClient = makeRealClient() as SupabaseClient;

// Swap in a client (the in-memory mock for tests/dev, or a live client).
export function setSupabaseClient(client: unknown): void {
  supabase = client as SupabaseClient;
}

// A uniform result type so every service call is handled the same way in the UI:
//   const { data, error } = await quoteService.list();
//   if (error) showToast(error); else render(data);
// No throwing across the data layer — errors are values, handled explicitly.
export type Result<T> = { data: T; error: null } | { data: null; error: string };

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}
export function fail<T>(error: string): Result<T> {
  return { data: null, error };
}

// Wrap a Supabase call so PostgREST errors become friendly strings, never
// uncaught exceptions. Keeps every service method shaped identically.
export async function run<T>(
  // PostgREST builders are thenable (PromiseLike), not full Promises — accept either.
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<Result<T>> {
  try {
    const { data, error } = await fn();
    if (error) return fail(error.message);
    if (data === null) return fail('Not found');
    return ok(data);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Unexpected error');
  }
}
