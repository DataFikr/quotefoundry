// ============================================================================
// laborRegions.ts — regional labor-rate reference presets.
// ----------------------------------------------------------------------------
// Sibling of materialCatalog.ts: REFERENCE data, never live market truth.
// Multipliers reflect the broad regional wage pattern in BLS OES data for the
// relevant trades (Welders 51-4121, Machinists 51-4041): coastal metros run
// well above the national median, the South a bit below, the industrial
// Midwest slightly above. A shop's BILLED rate is wages × overhead burden ×
// utilization — so these are starting points the owner adjusts, applied via
// the normal review-and-Save path. Machine burn + consumables are deliberately
// NOT regionalized (machine cost dominates those, not local wages).
// ============================================================================

export interface LaborRegion {
  key: string;
  label: string;
  hint: string;        // example metros, shown in the dropdown
  multiplier: number;  // over the national baseline
}

export const LABOR_REGIONS: LaborRegion[] = [
  { key: 'national',  label: 'National average',    hint: 'US-wide baseline',                    multiplier: 1.0 },
  { key: 'lakes',     label: 'Great Lakes / Midwest', hint: 'Detroit, Chicago, Cleveland',       multiplier: 1.04 },
  { key: 'gulf',      label: 'Gulf Coast / South',  hint: 'Houston, Dallas–Fort Worth, Mobile',  multiplier: 0.97 },
  { key: 'northeast', label: 'Northeast',           hint: 'Philadelphia, Boston, NY metro',      multiplier: 1.12 },
  { key: 'west',      label: 'West Coast',          hint: 'LA, Bay Area, Seattle, Portland',     multiplier: 1.18 },
  { key: 'mountain',  label: 'Mountain / Plains',   hint: 'Denver, Salt Lake, Kansas City',      multiplier: 0.95 },
];

// National baseline = the schema's default shop rates (quotefoundry_schema.sql).
const BASELINE = {
  rate_cutting: 75,
  rate_fitting: 80,
  rate_welding: 90,
  rate_finishing: 65,
  rate_setup: 75,
} as const;

export type RegionalRates = { -readonly [K in keyof typeof BASELINE]: number };

// Whole dollars — implying cents precision on reference data would be dishonest.
export function regionalRates(multiplier: number): RegionalRates {
  const out = {} as RegionalRates;
  for (const [key, base] of Object.entries(BASELINE) as [keyof typeof BASELINE, number][]) {
    out[key] = Math.round(base * multiplier);
  }
  return out;
}
