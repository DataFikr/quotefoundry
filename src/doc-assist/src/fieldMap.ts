// ============================================================================
// fieldMap.ts — pure mapping of extracted doc fields → editor input fields.
// Kept free of any I/O (no pdf.js) so it's testable in node/Vitest. Engine-
// priced fields (labor hours, rates) are NEVER mapped — those stay the
// estimator's judgment (CLAUDE.md §5).
// ============================================================================
import type { ExtractedField } from './spreadsheetParser';

export interface Prefill {
  [editorField: string]: { value: string | number; confidence: string; source: string };
}

// canonical doc field → the editor's input field
export const FIELD_MAP: Record<string, string> = {
  description: 'job_name',
  quantity: 'quantity',
  material: 'material_spec',
  material_grade: 'material_spec',
  finish: 'finish_spec',
  due_date: 'lead_time',
  notes: 'notes',
};

export function mapToEditorInputs(fields: ExtractedField[], sourceLabel: string): Prefill {
  const prefill: Prefill = {};
  for (const f of fields) {
    const editorField = FIELD_MAP[f.field];
    if (!editorField) continue;
    if (prefill[editorField]) continue; // first mapped value wins
    prefill[editorField] = { value: f.value, confidence: f.confidence, source: `${sourceLabel} (${f.sourceHeader})` };
  }
  return prefill;
}
