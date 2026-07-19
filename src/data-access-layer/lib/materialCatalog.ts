// ============================================================================
// materialCatalog.ts — the starter material catalog (SendCutSend-inspired).
// ----------------------------------------------------------------------------
// A REFERENCE library of the materials small fab/machining shops quote most,
// grouped by category the way big catalogs organize theirs. Prices are
// editable starting points in $/lb — typical distributor ballpark, NOT live
// market data; every shop adjusts them to its own supplier pricing in the
// rate-settings screen. Categories are display/grouping only — pricing always
// comes from the shop's own (snapshotted) library, never from this file at
// quote time. Grown deliberately (CLAUDE.md §5 style): add from real shops'
// requests, don't over-anticipate.
// ============================================================================
import type { Material } from './types';

export const MATERIAL_CATEGORIES = [
  'Carbon steel',
  'Stainless',
  'Aluminum',
  'Copper alloys',
  'Other',
] as const;

// name + reference $/lb + category. Names align with the existing defaults
// (A36 Steel, A500 Tube, 304 Stainless, 6061 Aluminum) so mergeMaterials
// updates those entries in place instead of duplicating them.
export const STARTER_CATALOG: Material[] = [
  // Carbon steel
  { name: 'A36 Steel',          price: 0.85, category: 'Carbon steel' },
  { name: 'A500 Tube',          price: 0.95, category: 'Carbon steel' },
  { name: '1018 CR Bar',        price: 1.05, category: 'Carbon steel' },
  { name: '4140 Alloy',         price: 1.45, category: 'Carbon steel' },
  { name: 'AR400 Plate',        price: 1.25, category: 'Carbon steel' },
  { name: 'Galvanized Sheet',   price: 1.05, category: 'Carbon steel' },
  // Stainless
  { name: '304 Stainless',      price: 2.10, category: 'Stainless' },
  { name: '316 Stainless',      price: 2.90, category: 'Stainless' },
  // Aluminum
  { name: '6061 Aluminum',      price: 1.85, category: 'Aluminum' },
  { name: '5052 Aluminum',      price: 1.75, category: 'Aluminum' },
  { name: '7075 Aluminum',      price: 3.20, category: 'Aluminum' },
  // Copper alloys
  { name: 'Brass 360',          price: 4.20, category: 'Copper alloys' },
  { name: 'Copper 110',         price: 5.60, category: 'Copper alloys' },
  // Other
  { name: 'Corten A588',        price: 1.10, category: 'Other' },
  { name: 'Abrasion Plate AR500', price: 1.40, category: 'Other' },
];

// The "market reference" card strip on the rates screen shows these five —
// the materials small fab/machining shops quote most, one per look.
export const TOP_MATERIALS = [
  'A36 Steel', '304 Stainless', '6061 Aluminum', 'A500 Tube', 'Brass 360',
] as const;

// Group a shop's library for display: known categories in catalog order, then
// any shop-invented categories alphabetically, then uncategorized last.
// Generic so callers can pass rows carrying extra fields (e.g. original index).
export function groupByCategory<T extends Material>(materials: T[]): { category: string; items: T[] }[] {
  const known = [...MATERIAL_CATEGORIES] as string[];
  const buckets = new Map<string, T[]>();
  for (const m of materials) {
    const cat = m.category?.trim() || 'Uncategorized';
    (buckets.get(cat) ?? buckets.set(cat, []).get(cat)!).push(m);
  }
  const extras = [...buckets.keys()]
    .filter((c) => !known.includes(c) && c !== 'Uncategorized')
    .sort();
  const order = [...known, ...extras, 'Uncategorized'];
  return order
    .filter((c) => buckets.has(c))
    .map((category) => ({ category, items: buckets.get(category)! }));
}
