// ============================================================================
// types.ts — shared types matching the database schema
// ============================================================================

export type QuoteStatus = 'draft' | 'sent' | 'opened' | 'won' | 'lost';
export type Plan = 'trial' | 'solo' | 'shop' | 'shop_plus';

// The rate library — what the shop edits, and what gets snapshotted per quote.
export interface ShopRates {
  rate_cutting: number;
  rate_fitting: number;
  rate_welding: number;
  rate_finishing: number;
  rate_burn: number;        // $/hr machine
  price_steel: number;      // $/lb
  scrap_pct: number;        // %
  rate_consumables: number; // $/weld-hr
  overhead_pct: number;     // %
  margin_pct: number;       // %
}

// The job-specific inputs an estimator enters per quote.
export interface QuoteInputs {
  job_name: string;
  material_spec?: string;
  material_weight: number;  // lb
  quantity: number;
  burn_minutes: number;
  hrs_cutting: number;
  hrs_fitting: number;
  hrs_welding: number;
  hrs_finishing: number;
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
  sent_at?: string;
  opened_at?: string;
  created_at: string;
}
