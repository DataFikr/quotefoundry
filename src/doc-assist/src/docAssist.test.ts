// @vitest-environment node
// ============================================================================
// docAssist.test.ts — Document Assist gate against the REAL modules.
//   Tier 1: routing + spreadsheet header matching (exact=high, synonym=medium)
//   Tier 2: text-layer gate + keyword extraction (capped at medium, never high)
//   mapping: extracted fields → editor inputs (engine-priced fields excluded)
// ============================================================================
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { routeByType, pdfTextLayerGate } from './tierRouter';
import { parseSpreadsheet } from './spreadsheetParser';
import { parsePdfText, keywordExtract } from './pdfTextParser';
import { mapToEditorInputs } from './fieldMap';

function xlsx(aoa: any[][]): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('Tier router — the cost bright line', () => {
  it('sends each file to the right tier; unknown never blocks', () => {
    expect(routeByType('rfq.xlsx').tier).toBe('tier1_spreadsheet');
    expect(routeByType('parts.csv').tier).toBe('tier1_spreadsheet');
    expect(routeByType('drawing.pdf').tier).toBe('tier2_text_pdf');
    expect(routeByType('part.dwg').tier).toBe('tier3_store_only');
    expect(routeByType('scan.png').tier).toBe('tier3_store_only');
    expect(routeByType('mystery.xyz').tier).toBe('tier3_store_only');
  });
});

describe('Tier 1 — spreadsheet parse (zero tokens)', () => {
  it('exact headers → high confidence, correct values', () => {
    const r = parseSpreadsheet(xlsx([
      ['Part Number', 'Quantity', 'Material', 'Finish', 'Due Date'],
      ['SS-4471', 12, 'A36 Steel', 'Powder Coat', '2026-07-15'],
    ]));
    expect(r.fields.length).toBe(5);
    expect(r.fields.find((f) => f.field === 'quantity')!.value).toBe(12);
    expect(r.fields.find((f) => f.field === 'quantity')!.confidence).toBe('high');
    expect(r.fields.find((f) => f.field === 'material')!.value).toBe('A36 Steel');
  });

  it('abbreviations map at medium confidence', () => {
    const r = parseSpreadsheet(xlsx([['PN', 'Qty', 'Matl', 'Thk'], ['X-9', '5', '304 SS', '0.25']]));
    expect(r.fields.find((f) => f.field === 'part_number')).toBeTruthy();
    expect(r.fields.find((f) => f.field === 'material')!.confidence).toBe('medium');
  });

  it('finds a header row below preamble, counts extra line items', () => {
    const r = parseSpreadsheet(xlsx([
      ['ACME STEEL CO — RFQ', ''], ['Sent 2026-06-20', ''],
      ['Item Description', 'Quantity'], ['Bracket weldment', 40], ['Plate', 5],
    ]));
    expect(r.fields.find((f) => f.field === 'quantity')!.value).toBe(40);
    expect(r.additionalRows).toBe(1);
  });

  it('reports unmatched headers (to grow the synonym list)', () => {
    const r = parseSpreadsheet(xlsx([['Quantity', 'Widget Code'], ['3', 'W-1']]));
    expect(r.unmatchedHeaders).toContain('Widget Code');
  });
});

describe('Tier 2 — text-layer gate + keyword extraction', () => {
  it('the gate keeps scanned/image PDFs out of parsing (no OCR)', () => {
    expect(pdfTextLayerGate('Part Number 4471 Quantity 12 Material A36 steel due June').tier).toBe('tier2_text_pdf');
    expect(pdfTextLayerGate('').tier).toBe('tier3_store_only');
    expect(pdfTextLayerGate('A1 .').tier).toBe('tier3_store_only');
  });

  it('parses labeled values from text, never above medium confidence', () => {
    const text = 'RFQ\nPart Number: SS-4471\nQty: 12\nMaterial: A36 steel\nFinish: powder coat\nPO #: AX-4471';
    const r = parsePdfText(text);
    expect(r.tier).toBe('tier2_text_pdf');
    expect(r.fields.find((f) => f.field === 'quantity')!.value).toBe('12');
    expect(r.fields.every((f) => f.confidence !== 'high')).toBe(true);
  });

  it('a gated-out PDF returns store-only, no fields', () => {
    const r = parsePdfText('x');
    expect(r.gatedOut).toBe(true);
    expect(r.fields.length).toBe(0);
  });
});

describe('mapToEditorInputs — engine-priced fields are never mapped', () => {
  it('maps description→job_name, material→material_spec, etc.', () => {
    const fields = keywordExtract('Qty: 4  Material: A500 tube  Finish: primer');
    const prefill = mapToEditorInputs(fields, 'PDF');
    expect(prefill.quantity.value).toBe('4');
    expect(prefill.material_spec.value).toBe('A500 tube');
    // there is no mapping that could ever set labor hours / rates
    expect(prefill.hrs_welding).toBeUndefined();
    expect(prefill.rate_welding).toBeUndefined();
  });
});
