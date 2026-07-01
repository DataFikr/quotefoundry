// ============================================================================
// quoteEngine.ts — the pure calculation core
// ----------------------------------------------------------------------------
// No database. No async. No side effects. Just (inputs, rates) -> totals.
// This is the SAME math the live editor screen runs on every keystroke, and
// the same math quoteService runs when saving. Keeping it pure means it's
// trivially testable and impossible for the on-screen number to disagree with
// the saved number — they call the identical function.
// ============================================================================

import type { QuoteInputs, ShopRates, QuoteTotals } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// The effective $/lb for a quote: if its material_spec matches a material in the
// shop's library, use that price; otherwise fall back to price_steel. The engine
// itself stays pure — this just picks which price it's handed.
export function priceForMaterial(rates: ShopRates, materialSpec?: string): number {
  if (materialSpec && rates.materials?.length) {
    const m = rates.materials.find((x) => normName(x.name) === normName(materialSpec));
    if (m) return m.price;
  }
  return rates.price_steel;
}

// Return a rates copy whose price_steel reflects the chosen material. Both the
// live editor and quoteService snapshot from THIS, so the frozen snapshot carries
// the material's price (and the library, so a draft re-price stays deterministic).
export function resolveRates(rates: ShopRates, materialSpec?: string): ShopRates {
  return { ...rates, price_steel: priceForMaterial(rates, materialSpec) };
}

export function computeQuote(inputs: QuoteInputs, rates: ShopRates): QuoteTotals {
  const qty = inputs.quantity > 0 ? inputs.quantity : 1;

  // 1. Material: weight x price, plus scrap/drop allowance
  const material =
    inputs.material_weight * rates.price_steel * (1 + rates.scrap_pct / 100);

  // 2. Labor: each operation's hours x its rate
  const labor =
    inputs.hrs_cutting * rates.rate_cutting +
    inputs.hrs_fitting * rates.rate_fitting +
    inputs.hrs_welding * rates.rate_welding +
    inputs.hrs_finishing * rates.rate_finishing;

  // 3. Burn / machine time: minutes -> hours x machine rate
  const burn = (inputs.burn_minutes / 60) * rates.rate_burn;

  // 4. Consumables: tied to weld hours
  const consumables = inputs.hrs_welding * rates.rate_consumables;

  // 5. Outside services: vendor pass-through, no markup at cost stage
  const outside = inputs.outside_services;

  const total_cost = material + labor + burn + consumables + outside;

  // Overhead then margin — SEQUENTIAL, not additive. Margin applies to
  // cost+overhead, not bare cost. Getting this order wrong silently
  // under-prices every job.
  const total_overhead = total_cost * (rates.overhead_pct / 100);
  const with_overhead = total_cost + total_overhead;
  const total_margin = with_overhead * (rates.margin_pct / 100);
  const quoted_price = with_overhead + total_margin;

  return {
    line_material: round2(material),
    line_labor: round2(labor),
    line_burn: round2(burn),
    line_consumables: round2(consumables),
    line_outside: round2(outside),
    total_cost: round2(total_cost),
    total_overhead: round2(total_overhead),
    total_margin: round2(total_margin),
    quoted_price: round2(quoted_price),
    per_unit: round2(quoted_price / qty),
  };
}
