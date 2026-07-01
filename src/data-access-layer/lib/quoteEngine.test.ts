// ============================================================================
// quoteEngine.test.ts — Vitest. Locks the canonical math (CLAUDE.md §4.3) and
// the sequential overhead→margin order so the on-screen number can never
// disagree with the saved number.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { computeQuote, resolveRates, priceForMaterial } from './quoteEngine';
import type { QuoteInputs, ShopRates } from './types';

const rates: ShopRates = {
  rate_cutting: 75, rate_fitting: 80, rate_welding: 90, rate_finishing: 65,
  rate_burn: 120, price_steel: 0.85, scrap_pct: 15, rate_consumables: 12,
  overhead_pct: 18, margin_pct: 30,
};

const inputs: QuoteInputs = {
  job_name: 'Stair stringers',
  material_weight: 240, quantity: 1, burn_minutes: 35,
  hrs_cutting: 1.5, hrs_fitting: 3, hrs_welding: 4, hrs_finishing: 1.5,
  outside_services: 85,
};

describe('computeQuote — canonical lock', () => {
  const t = computeQuote(inputs, rates);

  it('matches the canonical line items', () => {
    expect(t.line_material).toBe(234.6);
    expect(t.line_labor).toBe(810);
    expect(t.line_burn).toBe(70);
    expect(t.line_consumables).toBe(48);
  });

  it('matches the canonical totals (quoted_price 1913.82)', () => {
    expect(t.total_cost).toBe(1247.6);
    expect(t.total_overhead).toBe(224.57);
    expect(t.total_margin).toBe(441.65);
    expect(t.quoted_price).toBe(1913.82);
  });

  it('applies overhead then margin SEQUENTIALLY (not additively)', () => {
    const additiveMargin = t.total_cost * (rates.margin_pct / 100);
    expect(t.total_margin).toBeGreaterThan(additiveMargin);
    expect(t.total_margin).toBeCloseTo(
      (t.total_cost + t.total_overhead) * (rates.margin_pct / 100),
      2
    );
  });

  it('per_unit divides by quantity, never below 1', () => {
    const five = computeQuote({ ...inputs, quantity: 5 }, rates);
    expect(five.per_unit).toBe(Math.round((five.quoted_price / 5) * 100) / 100);
    const zero = computeQuote({ ...inputs, quantity: 0 }, rates);
    expect(zero.per_unit).toBe(zero.quoted_price); // treated as qty 1
  });
});

describe('material-driven pricing (resolveRates)', () => {
  const withMaterials: ShopRates = {
    ...rates,
    materials: [
      { name: 'A36 Steel', price: 0.85 },
      { name: '304 Stainless', price: 2.10 },
    ],
  };

  it('a matching material sets the effective $/lb; canonical stays 1913.82 for A36', () => {
    expect(priceForMaterial(withMaterials, 'A36 steel')).toBe(0.85); // case-insensitive
    const t = computeQuote({ ...inputs, material_spec: 'A36 steel' }, resolveRates(withMaterials, 'A36 steel'));
    expect(t.quoted_price).toBe(1913.82);
  });

  it('a pricier material raises the quote', () => {
    const t = computeQuote({ ...inputs, material_spec: '304 Stainless' }, resolveRates(withMaterials, '304 Stainless'));
    expect(t.quoted_price).toBeGreaterThan(1913.82);
  });

  it('an unknown material falls back to price_steel', () => {
    expect(priceForMaterial(withMaterials, 'Unobtainium')).toBe(rates.price_steel);
    expect(priceForMaterial(withMaterials, undefined)).toBe(rates.price_steel);
  });
});

describe('rate snapshot deep-copy invariant (CLAUDE.md §4.2)', () => {
  it('structuredClone-ing rates isolates a snapshot from later live edits', () => {
    const snapshot = structuredClone(rates);
    const before = computeQuote(inputs, snapshot).quoted_price;
    const live = structuredClone(rates);
    live.price_steel = 1.2;
    live.rate_welding = 110;
    const after = computeQuote(inputs, snapshot).quoted_price;
    expect(after).toBe(before);
    expect(after).toBe(1913.82);
    // a fresh quote at the new live rates must differ
    expect(computeQuote(inputs, live).quoted_price).not.toBe(1913.82);
  });
});
