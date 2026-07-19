// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { LABOR_REGIONS, regionalRates } from './laborRegions';

describe('laborRegions — regional reference presets', () => {
  it('every region produces all five labor fields in whole dollars', () => {
    for (const r of LABOR_REGIONS) {
      const rates = regionalRates(r.multiplier);
      for (const key of ['rate_cutting', 'rate_fitting', 'rate_welding', 'rate_finishing', 'rate_setup'] as const) {
        expect(rates[key]).toBeGreaterThan(0);
        expect(Number.isInteger(rates[key])).toBe(true);
      }
    }
  });

  it('national ×1.00 returns the schema defaults exactly', () => {
    expect(regionalRates(1)).toEqual({
      rate_cutting: 75, rate_fitting: 80, rate_welding: 90, rate_finishing: 65, rate_setup: 75,
    });
  });

  it('multipliers order regions sensibly: West Coast > national > Mountain/Plains', () => {
    const by = Object.fromEntries(LABOR_REGIONS.map((r) => [r.key, r.multiplier]));
    expect(by.west).toBeGreaterThan(by.northeast); // coasts top the table
    expect(by.northeast).toBeGreaterThan(by.national);
    expect(by.national).toBeGreaterThan(by.mountain);
    // and the applied rates follow (welding as the spot check)
    expect(regionalRates(by.west).rate_welding).toBeGreaterThan(regionalRates(by.mountain).rate_welding);
  });

  it('Great Lakes example matches the documented 78/83/94/68/78', () => {
    const lakes = LABOR_REGIONS.find((r) => r.key === 'lakes')!;
    expect(regionalRates(lakes.multiplier)).toEqual({
      rate_cutting: 78, rate_fitting: 83, rate_welding: 94, rate_finishing: 68, rate_setup: 78,
    });
  });
});
