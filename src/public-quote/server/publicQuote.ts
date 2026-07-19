// ============================================================================
// publicQuote.ts — pure logic for the public quote link (#/q/<token>).
// ----------------------------------------------------------------------------
// The customer-facing endpoints (api/quote-view.ts, api/quote-respond.ts) are
// thin I/O wrappers around this module, so the two properties that matter are
// provable by unit test, not just by construction:
//
//   1. MARGIN HIDING (§4.4) — buildPublicPayload returns an EXPLICIT allowlist.
//      It never spreads the DB row; margin, overhead, bare cost, engine line
//      breakdown and rate_snapshot are structurally absent from the payload.
//      Totals are recomputed from the quote's FROZEN rate_snapshot (same math
//      as the PDF path) and grouped by the same customerScope() the preview
//      modal and PDF use — one grouping, three surfaces.
//
//   2. STATUS INVARIANTS — respondTransition() mirrors the open-tracking rule:
//      a customer response only ever ADVANCES sent/opened → won|lost. It never
//      downgrades, never overrides an outcome that is already set (by the shop
//      or an earlier response), and never fires on a draft (a draft link is
//      treated as not found — the customer should never hold one).
// ============================================================================
import { computeQuote, ratesForInputs } from '../../data-access-layer/lib/quoteEngine';
import { customerScope } from '../../app/customerScope';
import type { Quote, QuoteInputs } from '../../data-access-layer/lib/types';

// uuid-shaped tokens only (public_token is a uuid). Rejecting everything else
// up front keeps malformed input out of the DB query entirely.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidToken(t: unknown): t is string {
  return typeof t === 'string' && UUID_RE.test(t);
}

// Row → engine inputs. The one hydration shape, shared with api/_lib.ts —
// a second inline copy is exactly how a field like material_lines would get
// silently dropped from the math (see quoteService.hydrate's warning).
export function rowToInputs(row: any): QuoteInputs {
  return {
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
    hrs_setup: Number(row.hrs_setup ?? 0),
    tooling_cost: Number(row.tooling_cost ?? 0),
    outside_services: Number(row.outside_services ?? 0),
    finish_spec: row.finish_spec ?? undefined,
    lead_time: row.lead_time ?? undefined,
    notes: row.notes ?? undefined,
  };
}

// What the customer's browser receives — nothing else leaves the server.
export type PublicQuoteState = 'open' | 'accepted' | 'declined';
export interface PublicQuotePayload {
  state: PublicQuoteState;
  responded_at?: string;               // decided_at when accepted/declined
  quote_number: string;
  job_name: string;
  part_number?: string;
  customer_name?: string;
  created_at: string;
  quantity: number;
  lead_time?: string;
  finish_spec?: string;
  pdf_style: string;
  lines: { label: string; detail: string; amount: number }[];
  subtotal: number;
  fees: number;                        // neutral "shop fees & handling" fold (§4.4)
  total: number;
  per_unit: number;
  shop: { name: string; logo_url?: string };
}

// Build the customer-safe payload from a quotes row + its shop. Returns null
// for a draft — a draft's link is "not found" to the outside world, and the
// handler must not distinguish that from a bad token (no oracle).
export function buildPublicPayload(
  row: any,
  shop: { name?: string | null; logo_url?: string | null } | null
): PublicQuotePayload | null {
  if (!row || row.status === 'draft') return null;

  const inputs = rowToInputs(row);
  const totals = computeQuote(inputs, ratesForInputs(row.rate_snapshot, inputs));
  // customerScope needs only inputs+totals; satisfy the Quote type minimally.
  const { lines, subtotal, fees, total } = customerScope({ inputs, totals } as Quote);

  const state: PublicQuoteState =
    row.status === 'won' ? 'accepted' : row.status === 'lost' ? 'declined' : 'open';

  return {
    state,
    responded_at: state === 'open' ? undefined : row.decided_at ?? undefined,
    quote_number: row.quote_number,
    job_name: inputs.job_name,
    part_number: inputs.part_number,
    customer_name: row.customer_name ?? undefined,
    created_at: row.created_at,
    quantity: inputs.quantity,
    lead_time: inputs.lead_time,
    finish_spec: inputs.finish_spec,
    pdf_style: row.pdf_style ?? 'classic',
    lines,
    subtotal,
    fees,
    total,
    per_unit: totals.per_unit,
    shop: { name: shop?.name ?? 'Your shop', logo_url: shop?.logo_url ?? undefined },
  };
}

// The response state machine. `next` = perform this transition (guarded again
// at the DB with a conditional update); `already` = quote has an outcome, tell
// the customer which one, change NOTHING; `notFound` = draft/invalid (404).
export type RespondAction = 'accept' | 'decline';
export type RespondDecision =
  | { kind: 'transition'; next: 'won' | 'lost'; event: 'won' | 'lost'; detail: string }
  | { kind: 'already'; state: PublicQuoteState }
  | { kind: 'notFound' };

export function respondTransition(status: string, action: RespondAction): RespondDecision {
  if (action !== 'accept' && action !== 'decline') return { kind: 'notFound' };
  switch (status) {
    case 'sent':
    case 'opened': {
      const next = action === 'accept' ? 'won' : 'lost';
      return {
        kind: 'transition', next, event: next,
        detail: action === 'accept' ? 'Customer accepted via quote link' : 'Customer declined via quote link',
      };
    }
    case 'won': return { kind: 'already', state: 'accepted' };
    case 'lost': return { kind: 'already', state: 'declined' };
    default: return { kind: 'notFound' };       // draft or unknown — no oracle
  }
}
