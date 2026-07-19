// ============================================================================
// materialSwatches.ts — stylized CSS "material photos" for the catalog cards.
// ----------------------------------------------------------------------------
// SendCutSend-style visual catalog without image assets: each material gets a
// hand-tuned CSS background (layered gradients ≈ brushed metal, sheen bands,
// warm alloy tones). Keyed by name, falling back to the material's CATEGORY so
// shop-invented materials still get a sensible swatch. Pure styling — never
// affects pricing.
// ============================================================================
import type { Material } from '../data-access-layer/lib/types';

type Swatch = React.CSSProperties;

// A subtle repeating streak overlay that reads as brushed grain.
const grain =
  'repeating-linear-gradient(105deg, rgba(255,255,255,.10) 0 2px, rgba(255,255,255,0) 2px 5px, rgba(0,0,0,.05) 5px 6px, rgba(0,0,0,0) 6px 11px)';

const steel: Swatch = {
  background: `${grain}, linear-gradient(160deg, #8E97A6 0%, #5C6572 45%, #7C8695 70%, #4A525E 100%)`,
};
const stainless: Swatch = {
  background: `${grain}, linear-gradient(150deg, #E8ECF2 0%, #B9C2CE 35%, #F2F5F9 52%, #9AA5B4 75%, #C9D1DC 100%)`,
};
const aluminum: Swatch = {
  background: `${grain}, linear-gradient(155deg, #DFE3E9 0%, #C2C8D1 40%, #EDF0F4 60%, #AEB6C1 100%)`,
};
const brass: Swatch = {
  background: `${grain}, linear-gradient(155deg, #E8C878 0%, #B8903E 45%, #F0D896 62%, #93702B 100%)`,
};
const copper: Swatch = {
  background: `${grain}, linear-gradient(155deg, #E2977B 0%, #B06546 45%, #EFB294 62%, #8E4E33 100%)`,
};
const rust: Swatch = {
  background: `${grain}, linear-gradient(150deg, #B07352 0%, #7E4A2E 40%, #C08A64 58%, #6B3D26 100%)`,
};
const tube: Swatch = {
  // rounded highlight band ≈ structural tube profile
  background: `linear-gradient(90deg, #4A525E 0%, #9AA3B1 22%, #D3D9E1 38%, #8E97A6 55%, #3F4650 100%)`,
};

const BY_NAME: Record<string, Swatch> = {
  'a36 steel': steel,
  'a500 tube': tube,
  '1018 cr bar': steel,
  '4140 alloy': steel,
  'ar400 plate': steel,
  'galvanized sheet': { background: `${grain}, linear-gradient(150deg, #C7CDD6 0%, #99A2AE 30%, #DCE1E8 48%, #8B94A1 70%, #B8BFC9 100%)` },
  '304 stainless': stainless,
  '316 stainless': stainless,
  '6061 aluminum': aluminum,
  '5052 aluminum': aluminum,
  '7075 aluminum': aluminum,
  'brass 360': brass,
  'copper 110': copper,
  'corten a588': rust,
};

const BY_CATEGORY: Record<string, Swatch> = {
  'carbon steel': steel,
  stainless,
  aluminum,
  'copper alloys': brass,
  other: rust,
};

export function swatchStyle(m: Pick<Material, 'name' | 'category'>): Swatch {
  return (
    BY_NAME[m.name.toLowerCase().trim()] ??
    BY_CATEGORY[(m.category ?? '').toLowerCase().trim()] ??
    steel
  );
}
