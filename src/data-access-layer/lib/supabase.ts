// ============================================================================
// supabase.ts — the single shared client + a consistent result wrapper
// ----------------------------------------------------------------------------
// ONE client instance for the whole app. It holds the logged-in user's session,
// so every query automatically carries their auth token — which is exactly what
// Row-Level Security reads to isolate data by shop. Services never pass shop_id
// by hand; the token + RLS do it.
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabase: SupabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
  fn: () => Promise<{ data: T | null; error: { message: string } | null }>
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
