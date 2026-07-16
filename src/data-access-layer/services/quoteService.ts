// ============================================================================
// quoteService.ts — the most important service
// ----------------------------------------------------------------------------
// This is where the two non-negotiables actually happen at write time:
//   1. RATE SNAPSHOT — on create, copy the shop's CURRENT rates onto the quote.
//      From then on, the quote computes from its own frozen copy, so editing
//      shop rates later never changes this quote.
//   2. COMPUTE ON SAVE — run the pure engine and store the totals, so list and
//      detail views read numbers instead of recomputing.
//
// Notice: no method ever passes shop_id. The Supabase client carries the user's
// token; RLS attaches/enforces the shop automatically. A forgotten filter
// cannot leak another shop's data because the database refuses it.
// ============================================================================

import { supabase, run, ok, fail, Result } from '../lib/supabase';
import { computeQuote, ratesForInputs } from '../lib/quoteEngine';
import { rateService } from './rateService';
import type { Quote, QuoteInputs, QuoteStatus, ShopRates } from '../lib/types';

// Shape a DB row into the app's Quote type.
function hydrate(row: any): Quote {
  // ONE inputs object, used both as the quote's inputs and for the totals
  // recompute — a second inline copy is exactly how a field like
  // material_lines would get silently dropped from the math.
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
  return {
    id: row.id,
    quote_number: row.quote_number,
    customer_id: row.customer_id ?? undefined,
    customer_name: row.customer_name ?? undefined,
    customer_email: row.customer_email ?? undefined,
    po_reference: row.po_reference ?? undefined,
    status: row.status,
    quoted_price: Number(row.quoted_price),
    rate_snapshot: row.rate_snapshot,
    inputs,
    // resolve material price(s) from the frozen snapshot's own library
    totals: computeQuote(inputs, ratesForInputs(row.rate_snapshot as ShopRates, inputs)),
    pdf_style: row.pdf_style ?? 'classic',
    public_token: row.public_token ?? undefined, // customer link (absent on the mock)
    sent_at: row.sent_at ?? undefined,
    opened_at: row.opened_at ?? undefined,
    created_at: row.created_at,
  };
}

export const quoteService = {
  // -- LIST (pipeline home) -------------------------------------------------
  // Optional status filter and search. RLS scopes to the caller's shop.
  async list(opts?: { status?: QuoteStatus; search?: string }): Promise<Result<Quote[]>> {
    let q = supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });

    if (opts?.status) q = q.eq('status', opts.status);
    if (opts?.search) {
      const s = `%${opts.search}%`;
      q = q.or(`job_name.ilike.${s},customer_name.ilike.${s},quote_number.ilike.${s}`);
    }
    const res = await run<any[]>(() => q);
    return res.error ? res : ok(res.data!.map(hydrate));
  },

  // -- GET ONE (quote detail) ----------------------------------------------
  async get(id: string): Promise<Result<Quote>> {
    const res = await run<any>(() =>
      supabase.from('quotes').select('*').eq('id', id).single()
    );
    return res.error ? res : ok(hydrate(res.data));
  },

  // -- CREATE --------------------------------------------------------------
  // The snapshot happens HERE: fetch live rates once, freeze onto the quote.
  async create(
    inputs: QuoteInputs,
    customer?: { id?: string; name?: string; email?: string; po?: string }
  ): Promise<Result<Quote>> {
    // 1. Read the shop's CURRENT rates, then resolve the chosen material's price.
    const ratesRes = await rateService.get();
    if (ratesRes.error) return fail(ratesRes.error);
    const rates = ratesForInputs(ratesRes.data!, inputs);

    // 2. Compute totals from those (material-resolved) rates now.
    const totals = computeQuote(inputs, rates);

    // 3. Generate the per-shop quote number (app-side; see note in spec).
    const numRes = await this.nextQuoteNumber();
    if (numRes.error) return fail(numRes.error);

    // 4. Insert. shop_id is set by an RLS-friendly default/trigger or the
    //    bootstrap context; we never pass it from the client.
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .insert({
          quote_number: numRes.data,
          customer_id: customer?.id ?? null,
          customer_name: customer?.name ?? null,
          customer_email: customer?.email ?? null,
          po_reference: customer?.po ?? null,
          ...inputs,
          rate_snapshot: rates,           // <-- THE FROZEN COPY
          total_cost: totals.total_cost,
          total_overhead: totals.total_overhead,
          total_margin: totals.total_margin,
          quoted_price: totals.quoted_price,
          status: 'draft',
        })
        .select()
        .single()
    );
    if (res.error) return res;
    await this.logEvent(res.data.id, 'created');
    return ok(hydrate(res.data));
  },

  // -- UPDATE (editing a DRAFT) --------------------------------------------
  // Re-computes from the EXISTING snapshot, not live rates, so editing a draft
  // doesn't silently re-price it against rates that changed since creation.
  async update(id: string, inputs: QuoteInputs): Promise<Result<Quote>> {
    const existing = await this.get(id);
    if (existing.error) return existing;
    if (existing.data!.status !== 'draft') {
      return fail('Only draft quotes can be edited. Clone this quote to revise.');
    }
    // recompute from the EXISTING snapshot, re-pricing the (possibly changed)
    // material(s) from the snapshot's own frozen library — never from live rates.
    const totals = computeQuote(inputs, ratesForInputs(existing.data!.rate_snapshot, inputs));
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .update({
          ...inputs,
          total_cost: totals.total_cost,
          total_overhead: totals.total_overhead,
          total_margin: totals.total_margin,
          quoted_price: totals.quoted_price,
        })
        .eq('id', id)
        .select()
        .single()
    );
    return res.error ? res : ok(hydrate(res.data));
  },

  // -- CLONE (repeat quote) ------------------------------------------------
  // Re-snapshots against CURRENT rates, because a repeat job should be priced
  // at today's costs, not the original quote's. New number, fresh draft.
  async clone(id: string): Promise<Result<Quote>> {
    const src = await this.get(id);
    if (src.error) return src;
    const q = src.data!;
    return this.create(q.inputs, {
      id: q.customer_id,
      name: q.customer_name,
      email: q.customer_email,
      po: q.po_reference,
    });
  },

  // -- STATUS TRANSITIONS --------------------------------------------------
  async markSent(id: string, recipient: string): Promise<Result<Quote>> {
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    );
    if (res.error) return res;
    await this.logEvent(id, 'sent', recipient);
    return ok(hydrate(res.data));
  },

  async markOpened(id: string): Promise<Result<Quote>> {
    // Only advance to 'opened' from 'sent' — never downgrade won/lost.
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .update({ status: 'opened', opened_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'sent')
        .select()
        .single()
    );
    if (res.error) return res;
    await this.logEvent(id, 'opened');
    return ok(hydrate(res.data));
  },

  // Persist the customer-PDF template choice (from the preview modal). Frozen
  // on the quote so a later download reproduces the document that was sent.
  async setPdfStyle(id: string, style: 'classic' | 'modern' | 'minimal'): Promise<Result<Quote>> {
    const res = await run<any>(() =>
      supabase.from('quotes').update({ pdf_style: style }).eq('id', id).select().single()
    );
    return res.error ? res : ok(hydrate(res.data));
  },

  async markOutcome(id: string, outcome: 'won' | 'lost'): Promise<Result<Quote>> {
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .update({ status: outcome, decided_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
    );
    if (res.error) return res;
    await this.logEvent(id, outcome);
    return ok(hydrate(res.data));
  },

  // -- DELETE (drafts only) --------------------------------------------------
  // A sent/won/lost quote is business history — the pipeline stats and the
  // customer's copy both reference it. Only unsent drafts may be deleted.
  async remove(id: string): Promise<Result<{ id: string }>> {
    const existing = await this.get(id);
    if (existing.error) return fail(existing.error);
    if (existing.data!.status !== 'draft') {
      return fail('Only draft quotes can be deleted. Sent quotes are history — mark them lost instead.');
    }
    const res = await run<any[]>(() =>
      supabase.from('quotes').delete().eq('id', id).select()
    );
    return res.error ? fail(res.error) : ok({ id });
  },

  // Undo for markOutcome (the 5-second toast): restore the pre-outcome status
  // and clear decided_at. Logged as its own event so the timeline stays honest
  // — the original won/lost event is history, not double-counted.
  async revertOutcome(id: string, previousStatus: QuoteStatus): Promise<Result<Quote>> {
    const res = await run<any>(() =>
      supabase
        .from('quotes')
        .update({ status: previousStatus, decided_at: null })
        .eq('id', id)
        .select()
        .single()
    );
    if (res.error) return res;
    await this.logEvent(id, 'reverted', `back to ${previousStatus}`);
    return ok(hydrate(res.data));
  },

  // -- internal helpers ----------------------------------------------------
  async logEvent(quoteId: string, type: string, detail?: string): Promise<void> {
    await run(() =>
      supabase.from('quote_events').insert({
        quote_id: quoteId,
        event_type: type,
        detail: detail ?? null,
      }).select().single()
    );
  },

  // Per-shop sequential number. Done app-side because gapless per-tenant
  // numbering is fiddly in pure SQL; the unique(shop_id, quote_number)
  // constraint is the safety net against races.
  async nextQuoteNumber(): Promise<Result<string>> {
    const year = new Date().getFullYear();
    const res = await run<any[]>(() =>
      supabase
        .from('quotes')
        .select('quote_number')
        .ilike('quote_number', `Q-${year}-%`)
        .order('quote_number', { ascending: false })
        .limit(1)
    );
    if (res.error) return res as unknown as Result<string>;
    const last = res.data?.[0]?.quote_number as string | undefined;
    const seq = last ? parseInt(last.split('-')[2], 10) + 1 : 1;
    return ok(`Q-${year}-${String(seq).padStart(3, '0')}`);
  },
};
