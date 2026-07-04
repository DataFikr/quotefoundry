// ============================================================================
// templateRoundtrip.test.ts — the public lead magnet must keep its promise:
// public/templates/quotefoundry-rfq-template.csv, filled in and dropped onto
// the editor, prefills via Doc Assist Tier 1. This locks the template headers
// to the SYNONYMS list — if either drifts, this fails before a customer sees it.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSpreadsheet } from './spreadsheetParser';
import { mapToEditorInputs } from './fieldMap';

const csv = readFileSync(join(process.cwd(), 'public/templates/quotefoundry-rfq-template.csv'));

describe('public RFQ template ↔ Doc Assist round-trip', () => {
  const result = parseSpreadsheet(new Uint8Array(csv));

  it('every template column maps to a known field (no unmatched headers)', () => {
    expect(result.unmatchedHeaders).toEqual([]);
  });

  it('extracts the core fields from the example row', () => {
    const byField = Object.fromEntries(result.fields.map((f) => [f.field, f.value]));
    expect(byField.part_number).toBe('STR-2201');
    expect(byField.description).toBe('Stair stringers');
    expect(byField.quantity).toBe(1);
    expect(byField.material).toBe('A36 Steel');
    expect(byField.finish).toBe('Hot-dip galvanized');
    // due date must be a plain ISO string, NOT an Excel serial (46232.79…)
    expect(byField.due_date).toBe('2026-08-01');
  });

  it('prefills the editor fields the page promises', () => {
    const prefill = mapToEditorInputs(result.fields, 'template');
    expect(prefill.job_name?.value).toBe('Stair stringers');
    expect(prefill.part_number?.value).toBe('STR-2201');
    expect(prefill.quantity?.value).toBe(1);
    expect(prefill.material_spec?.value).toBe('A36 Steel');
    expect(prefill.finish_spec?.value).toBe('Hot-dip galvanized');
    expect(prefill.lead_time?.value).toBe('2026-08-01'); // Due Date → editor's Due date field
  });
});
