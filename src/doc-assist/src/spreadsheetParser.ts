// ============================================================================
// spreadsheetParser.ts — Tier 1: parse XLSX/CSV into quote fields (zero tokens)
// ----------------------------------------------------------------------------
// Deterministic. No AI. Maps spreadsheet columns to the quote editor's existing
// input fields by matching headers against a synonym list, and assigns a
// confidence per field from the match quality:
//   exact header match   -> high
//   synonym / fuzzy match -> medium
//   no match             -> field left blank (never guessed)
//
// Output is a set of { field, value, confidence, sourceHeader } the editor
// pre-fills and the estimator reviews. Every value is a draft.
// ============================================================================

import * as XLSX from 'xlsx';

export type Confidence = 'high' | 'medium' | 'low';

export interface ExtractedField {
  field: string;          // canonical quote field name
  value: string | number;
  confidence: Confidence;
  sourceHeader: string;   // the spreadsheet header it came from (audit)
}

export interface ParseResult {
  fields: ExtractedField[];
  additionalRows: number; // count of extra line items beyond the first
  unmatchedHeaders: string[]; // headers we couldn't map — LOG THESE to grow synonyms
}

// ----------------------------------------------------------------------------
// Synonym list: canonical field -> header variants seen in the wild.
// This is the ONE part that grows from real customer files. Start reasonable,
// log unmatched headers, expand from real misses. Lowercase, no punctuation.
// ----------------------------------------------------------------------------
const SYNONYMS: Record<string, string[]> = {
  quantity:       ['qty', 'quantity', 'order qty', 'qty req', 'pieces', 'pcs', 'count'],
  part_number:    ['part number', 'part no', 'part', 'pn', 'part num', 'item number', 'item no'],
  drawing_number: ['drawing number', 'drawing no', 'dwg', 'dwg no', 'drawing'],
  description:    ['description', 'desc', 'job name', 'part name', 'item', 'item description'],
  material:       ['material', 'matl', 'material spec', 'mat', 'stock'],
  material_grade: ['grade', 'material grade', 'alloy', 'spec'],
  thickness:      ['thickness', 'thk', 'gauge', 'ga', 'material thickness'],
  finish:         ['finish', 'coating', 'surface finish', 'paint', 'powder coat'],
  due_date:       ['due date', 'due', 'need by', 'required date', 'delivery date', 'date required'],
  customer_po:    ['po', 'po number', 'po no', 'purchase order', 'customer po', 'po ref'],
  notes:          ['notes', 'note', 'comments', 'remarks', 'special instructions', 'instructions'],
};

const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// SheetJS coerces date-like cells (e.g. "2026-07-30") into Excel date serials
// (46232.79…). With cellDates:true they arrive as JS Date objects instead; we
// render them back to an ISO date string. toISOString() reads UTC, which is
// tz-safe here because cellDates builds the Date at UTC midnight — using the
// local getDate() would drift a day in negative-offset zones (the "7/29/26" bug).
function cellValue(v: unknown): string | number {
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  return v as string | number;
}

// Build a reverse lookup: normalized header -> { field, exact }
function matchHeader(header: string): { field: string; confidence: Confidence } | null {
  const h = norm(header);
  if (!h) return null;
  // exact match against any synonym -> high; the canonical name itself is exact too
  for (const [field, variants] of Object.entries(SYNONYMS)) {
    if (norm(field) === h) return { field, confidence: 'high' };
    if (variants.some((v) => norm(v) === h)) {
      // exact synonym match: high if it's the primary/obvious term, else medium.
      // Primary term = first in the list. Others are "medium" (still a synonym
      // but more ambiguous), giving the estimator a gentle review nudge.
      return { field, confidence: variants[0] === v(h, variants) ? 'high' : 'medium' };
    }
  }
  // fuzzy: header contains a synonym or vice-versa -> medium
  for (const [field, variants] of Object.entries(SYNONYMS)) {
    if (variants.some((vv) => h.includes(norm(vv)) || norm(vv).includes(h)))
      return { field, confidence: 'medium' };
  }
  return null;
}
// tiny helper to find which variant matched (for primary-term check)
function v(h: string, variants: string[]): string {
  return variants.find((x) => norm(x) === h) ?? '';
}

export function parseSpreadsheet(fileBuffer: ArrayBuffer | Uint8Array): ParseResult {
  // Works in both Node (Buffer is a Uint8Array) and the browser (ArrayBuffer →
  // Uint8Array). type:'array' is SheetJS's cross-platform byte-array mode.
  const data = fileBuffer instanceof ArrayBuffer ? new Uint8Array(fileBuffer) : fileBuffer;
  // cellDates:true → date cells become JS Dates, not Excel serial numbers.
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // rows as arrays so we can find the header row even if it's not row 1
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  if (rows.length === 0)
    return { fields: [], additionalRows: 0, unmatchedHeaders: [] };

  // find the header row: the first row where >=2 cells match a known field.
  let headerIdx = 0, bestMatches = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const matches = rows[i].filter((c) => matchHeader(String(c))).length;
    if (matches > bestMatches) { bestMatches = matches; headerIdx = i; }
  }
  const headers = (rows[headerIdx] || []).map((c) => String(c ?? ''));
  const dataRows = rows.slice(headerIdx + 1).filter((r) => r.some((c) => c !== '' && c != null));

  // map columns -> fields
  const colMap: Array<{ col: number; field: string; confidence: Confidence; header: string }> = [];
  const unmatched: string[] = [];
  headers.forEach((header, col) => {
    if (!header.trim()) return;
    const m = matchHeader(header);
    if (m) colMap.push({ col, field: m.field, confidence: m.confidence, header });
    else unmatched.push(header);
  });

  // pre-fill from the FIRST data row (PRD: one primary item applied, rest visible)
  const first = dataRows[0] || [];
  const fields: ExtractedField[] = colMap
    .map(({ col, field, confidence, header }) => ({
      field, confidence, sourceHeader: header, value: cellValue(first[col]),
    }))
    .filter((f) => f.value !== '' && f.value != null);

  return {
    fields,
    additionalRows: Math.max(0, dataRows.length - 1),
    unmatchedHeaders: unmatched,
  };
}
