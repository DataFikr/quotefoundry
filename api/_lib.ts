// ============================================================================
// api/_lib.ts — shared helpers for the Vercel API routes (underscore prefix =
// not exposed as an endpoint).
// ----------------------------------------------------------------------------
// AUTH MODEL: every authenticated route receives the caller's Supabase access
// token (Authorization: Bearer …). We build a USER-SCOPED client from it, so
// every read goes through RLS — a caller can only ever load their own shop's
// rows. The service-role key is used only inside sendQuoteEmail/trackOpen,
// which re-verify ownership themselves (CLAUDE.md §4.5).
// ============================================================================

import type { VercelRequest } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { computeQuote, ratesForInputs } from '../src/data-access-layer/lib/quoteEngine';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback !== undefined ? process.env[fallback] : undefined);
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export interface Caller {
  client: SupabaseClient; // user-scoped: all queries pass through RLS
  userId: string;
  shopId: string;
}

// Resolve the caller from the bearer token, or explain why not.
export async function getCaller(req: VercelRequest): Promise<{ caller?: Caller; error?: string }> {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: 'Missing Authorization bearer token.' };

  const client = createClient(
    env('SUPABASE_URL', 'VITE_SUPABASE_URL'),
    env('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return { error: 'Invalid or expired session.' };

  const { data: link } = await client
    .from('shop_users')
    .select('shop_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (!link?.shop_id) return { error: 'No shop for this account.' };

  return { caller: { client, userId: user.id, shopId: link.shop_id } };
}

// Load a quote + its shop, shaped for generateQuotePdf. Reads go through the
// caller's RLS-scoped client, so a foreign quote id simply returns null.
// Totals are recomputed from the quote's FROZEN rate_snapshot (same math as
// the app's hydrate path) — the PDF always reflects the snapshot, not live rates.
export async function loadQuoteForPdf(caller: Caller, quoteId: string): Promise<{
  quote?: any; shop?: { name: string; logo_url?: string }; error?: string;
}> {
  const { data: row } = await caller.client.from('quotes').select('*').eq('id', quoteId).maybeSingle();
  if (!row) return { error: 'Quote not found.' }; // includes "not yours" — RLS returns nothing

  const { data: shopRow } = await caller.client.from('shops').select('name, logo_url').eq('id', caller.shopId).maybeSingle();

  const inputs = {
    job_name: row.job_name,
    part_number: row.part_number ?? undefined,
    material_spec: row.material_spec ?? undefined,
    material_weight: Number(row.material_weight ?? 0),
    material_lines: Array.isArray(row.material_lines) && row.material_lines.length ? row.material_lines : undefined,
    quantity: row.quantity,
    burn_minutes: Number(row.burn_minutes ?? 0),
    hrs_cutting: Number(row.hrs_cutting ?? 0),
    hrs_fitting: Number(row.hrs_fitting ?? 0),
    hrs_welding: Number(row.hrs_welding ?? 0),
    hrs_finishing: Number(row.hrs_finishing ?? 0),
    outside_services: Number(row.outside_services ?? 0),
    finish_spec: row.finish_spec ?? undefined,
    lead_time: row.lead_time ?? undefined,
    notes: row.notes ?? undefined,
  };
  const quote = {
    id: row.id,
    quote_number: row.quote_number,
    customer_name: row.customer_name ?? undefined,
    customer_email: row.customer_email ?? undefined,
    po_reference: row.po_reference ?? undefined,
    created_at: row.created_at,
    pdf_style: row.pdf_style ?? 'classic',
    inputs,
    totals: computeQuote(inputs, ratesForInputs(row.rate_snapshot, inputs)),
  };
  return { quote, shop: { name: shopRow?.name ?? 'Your shop', logo_url: shopRow?.logo_url ?? undefined } };
}
