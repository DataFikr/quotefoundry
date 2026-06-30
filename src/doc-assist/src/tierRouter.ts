// ============================================================================
// tierRouter.ts — Phase 0: detect a file's type and route it to a tier
// ----------------------------------------------------------------------------
// The router is the bright line of the whole module. It decides, by file type
// (and for PDFs, by the text-layer gate), which tier handles a file:
//   Tier 1  spreadsheet  -> parse (zero tokens)
//   Tier 2  text-PDF     -> parse best-effort (built in phase 2)
//   Tier 3  everything else -> store only, manual entry
//
// Crucially, a file that can't be parsed NEVER dead-ends: it routes to Tier 3,
// which attaches it and falls back to manual. No error, no blocked estimator.
// ============================================================================

export type Tier = 'tier1_spreadsheet' | 'tier2_text_pdf' | 'tier3_store_only';

export interface RouteResult {
  tier: Tier;
  reason: string;          // human-readable, surfaced in logs/audit
  parseable: boolean;
}

const SPREADSHEET_EXT = new Set(['xlsx', 'xls', 'csv', 'tsv']);
const STORE_ONLY_EXT = new Set([
  'dwg', 'dxf', 'step', 'stp', 'stl', 'igs', 'iges',  // CAD — never parse geometry
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'tif', 'tiff', // images — no OCR
  'zip', 'rar', '7z', 'docx', 'doc',                   // archives/docs — out of scope
]);

function ext(filename: string): string {
  const i = filename.lastIndexOf('.');
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : '';
}

/**
 * Route by extension first. PDFs need the text-layer gate (async, needs bytes),
 * so routePdf() is separate — the caller runs it only for .pdf files.
 */
export function routeByType(filename: string): RouteResult {
  const e = ext(filename);
  if (SPREADSHEET_EXT.has(e))
    return { tier: 'tier1_spreadsheet', reason: `spreadsheet (.${e})`, parseable: true };
  if (e === 'pdf')
    return { tier: 'tier2_text_pdf', reason: 'pdf — pending text-layer gate', parseable: true };
  if (STORE_ONLY_EXT.has(e))
    return { tier: 'tier3_store_only', reason: `store-only type (.${e})`, parseable: false };
  // Unknown extension: safest is store-only (never block, never guess).
  return { tier: 'tier3_store_only', reason: `unrecognized type (.${e || 'none'})`, parseable: false };
}

/**
 * The TEXT-LAYER GATE (Phase 2 will call this for PDFs).
 * Given the text a PDF library extracted, decide if there's *enough* real text
 * to parse. Errs toward store-only when ambiguous — a wrong "no" just means
 * manual entry (cheap), a wrong "yes" wastes effort. Never triggers OCR.
 */
export function pdfTextLayerGate(extractedText: string): RouteResult {
  const cleaned = (extractedText || '').replace(/\s+/g, ' ').trim();
  // Threshold: needs a meaningful amount of extractable text, not a few stray
  // characters from a mostly-scanned page. Tunable against real files.
  const MIN_CHARS = 40;
  const MIN_WORDS = 8;
  const words = cleaned ? cleaned.split(' ').length : 0;
  if (cleaned.length >= MIN_CHARS && words >= MIN_WORDS)
    return { tier: 'tier2_text_pdf', reason: 'pdf has extractable text layer', parseable: true };
  return {
    tier: 'tier3_store_only',
    reason: 'pdf has no usable text layer (scanned/image) — store only, no OCR',
    parseable: false,
  };
}
