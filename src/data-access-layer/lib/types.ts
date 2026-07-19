// ============================================================================
// types.ts — shared types matching the database schema
// ============================================================================

export type QuoteStatus = 'draft' | 'sent' | 'opened' | 'won' | 'lost';
export type Plan = 'trial' | 'solo' | 'shop' | 'shop_plus';

// Customer-facing PDF template. Chosen in the preview modal, frozen on the
// quote so a later download reproduces the document that was sent.
export type PdfStyle = 'classic' | 'modern' | 'minimal';

// The shop's own public identity (name + logo shown on quotes/PDFs).
export interface ShopInfo {
  id: string;
  name: string;
  logo_url?: string;   // data-URL or storage URL; rendered top-left on the PDF
  plan?: Plan;         // trial | solo | shop | shop_plus (account screen)
  created_at?: string; // "member since" on the account screen
}

// A shop-defined material and its $/lb price. The quote's chosen material sets
// the effective price used by the engine (see resolveRates). `category` groups
// the library for display/picking (see materialCatalog.ts); it never affects
// pricing, so older {name, price} entries stay valid as-is.
export interface Material {
  name: string;
  price: number;     // $/lb
  category?: string; // e.g. 'Carbon steel' | 'Stainless' | 'Aluminum' | …
}

// The rate library — what the shop edits, and what gets snapshotted per quote.
export interface ShopRates {
  rate_cutting: number;
  rate_fitting: number;
  rate_welding: number;
  rate_finishing: number;
  rate_setup?: number;      // $/hr setup & programming (optional: pre-2026-07-17
                            // snapshots lack it — engine falls back to rate_cutting)
  rate_burn: number;        // $/hr machine
  price_steel: number;      // $/lb — the effective/default material price
  scrap_pct: number;        // %
  rate_consumables: number; // $/weld-hr
  overhead_pct: number;     // %
  margin_pct: number;       // %
  materials?: Material[];    // the shop's material library (name → $/lb)
}

// One material line on a quote: a type from the shop's library (or free text),
// its per-piece weight, and how many pieces. Metal work often mixes types
// (plate + tube + stainless), so a quote carries a LIST of these.
export interface MaterialLine {
  type: string;    // material name — priced from the snapshot's library
  weight: number;  // lb per piece
  qty: number;     // pieces of this material
}

// The job-specific inputs an estimator enters per quote.
export interface QuoteInputs {
  job_name: string;
  part_number?: string;     // from RFQ metadata (Doc Assist) or typed
  material_spec?: string;   // first line's type (kept for display/back-compat)
  material_weight: number;  // lb — legacy single-material path; ignored when material_lines present
  material_lines?: MaterialLine[]; // multi-material: engine sums these when non-empty
  quantity: number;
  burn_minutes: number;
  hrs_cutting: number;
  hrs_fitting: number;
  hrs_welding: number;
  hrs_finishing: number;
  // ONE-TIME per job (not per part) — amortized across quantity by priceBreaks.
  // Optional so every pre-existing quote/draft stays valid (absent = 0).
  hrs_setup?: number;       // setup + programming hours
  tooling_cost?: number;    // $ perishable tooling for the job (endmills, inserts…)
  outside_services: number; // vendor pass-through $
  finish_spec?: string;
  lead_time?: string;
  notes?: string;
}

// The computed output of the engine.
export interface QuoteTotals {
  line_material: number;
  line_labor: number;
  line_burn: number;
  line_consumables: number;
  line_setup: number;    // one-time setup & programming
  line_tooling: number;  // one-time perishable tooling
  line_outside: number;
  total_cost: number;      // shop cost
  total_overhead: number;
  total_margin: number;
  quoted_price: number;
  per_unit: number;
}

export interface Customer {
  id: string;
  company_name: string;
  contact_name?: string;
  contact_role?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  default_terms?: string;
  po_reference?: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  po_reference?: string;
  status: QuoteStatus;
  quoted_price: number;
  rate_snapshot: ShopRates;
  inputs: QuoteInputs;
  totals: QuoteTotals;
  pdf_style?: PdfStyle;
  // public quote link token (#/q/<token>) — the shop's own quote carries its
  // customer-facing link; absent on the mock backend (no DB default there)
  public_token?: string;
  sent_at?: string;
  opened_at?: string;
  decided_at?: string;   // won/lost timestamp — buckets monthly won analytics
  created_at: string;
}
