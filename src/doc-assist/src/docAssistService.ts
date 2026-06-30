// ============================================================================
// docAssistService.ts — ties Phase 0 + Tier 1 together for the editor
// ----------------------------------------------------------------------------
// Flow: estimator uploads file -> store it against the quote (Supabase Storage,
// shop-scoped by RLS) -> route by tier -> parse if Tier 1 -> return extracted
// fields the editor pre-fills. Tier 3 (and Tier 2 until phase 2) just store and
// signal "manual entry". Nothing here commits to the quote; the editor holds
// the drafts and the estimator saves through the EXISTING quoteService.
// ============================================================================

import { supabase, run, ok, fail, Result } from '../lib/supabase';
import { routeByType, pdfTextLayerGate, Tier } from './tierRouter';
import { parseSpreadsheet, ExtractedField } from './spreadsheetParser';

export interface DocAssistResult {
  tier: Tier;
  filePath: string;          // storage path (always set — every file is stored)
  parsed: boolean;
  fields: ExtractedField[];  // empty unless Tier 1 parsed
  additionalRows: number;
  message: string;           // estimator-facing status
  unmatchedHeaders?: string[]; // for telemetry — grow the synonym list from these
}

export const docAssistService = {
  // Called when the estimator uploads a file in the quote editor.
  // quoteId scopes storage; the caller's session enforces shop isolation.
  async handleUpload(
    quoteId: string,
    filename: string,
    fileBuffer: ArrayBuffer
  ): Promise<Result<DocAssistResult>> {
    // 1. STORE FIRST — every file is attached, parseable or not. This is the
    //    safety net: even if parsing fails, the file is saved and the estimator
    //    is never blocked.
    const path = `${quoteId}/${Date.now()}_${filename}`;
    const store = await run<any>(() =>
      supabase.storage.from('rfq-files').upload(path, fileBuffer).then((r: any) => ({ data: r.data, error: r.error }))
    );
    if (store.error) return fail(`Couldn't store the file: ${store.error}`);

    // 2. ROUTE by type.
    let route = routeByType(filename);

    // 3. TIER 1 — spreadsheet: parse now (zero tokens).
    if (route.tier === 'tier1_spreadsheet') {
      try {
        const result = parseSpreadsheet(Buffer.from(fileBuffer));
        await this.recordExtraction(quoteId, path, 'tier1_spreadsheet', result.fields);
        return ok({
          tier: route.tier, filePath: path, parsed: true,
          fields: result.fields, additionalRows: result.additionalRows,
          unmatchedHeaders: result.unmatchedHeaders,
          message: result.fields.length
            ? `Pre-filled ${result.fields.length} field${result.fields.length > 1 ? 's' : ''} from the spreadsheet. Review each before saving.`
            : 'Spreadsheet attached, but no recognizable columns found — enter details manually.',
        });
      } catch (e) {
        // parse failure must NOT block — fall back to store-only behaviour.
        return ok({
          tier: 'tier3_store_only', filePath: path, parsed: false,
          fields: [], additionalRows: 0,
          message: 'Spreadsheet attached, but it couldn’t be read — enter details manually.',
        });
      }
    }

    // 4. TIER 2 — PDF: the text-layer gate runs in phase 2. For now, store only.
    //    (Phase 2 will extract text here, call pdfTextLayerGate, and parse.)
    if (route.tier === 'tier2_text_pdf') {
      await this.recordExtraction(quoteId, path, 'tier3_store_only', []);
      return ok({
        tier: 'tier3_store_only', filePath: path, parsed: false,
        fields: [], additionalRows: 0,
        message: 'PDF attached. Document reading for PDFs is coming soon — enter details manually for now.',
      });
    }

    // 5. TIER 3 — store only, manual entry. No error, no dead end.
    await this.recordExtraction(quoteId, path, 'tier3_store_only', []);
    return ok({
      tier: 'tier3_store_only', filePath: path, parsed: false,
      fields: [], additionalRows: 0,
      message: `Attached — couldn’t auto-read this file type, enter details manually.`,
    });
  },

  // Persist what we extracted, for audit ("where did this value come from").
  async recordExtraction(quoteId: string, filePath: string, tier: Tier, fields: ExtractedField[]): Promise<void> {
    await run(() =>
      supabase.from('quote_files').insert({
        quote_id: quoteId,
        file_path: filePath,
        tier,
        extracted_fields: fields,
      }).select().single()
    );
  },
};

// ----------------------------------------------------------------------------
// mapToEditorInputs — turn extracted fields into the editor's input shape.
// The editor pre-fills these, tags each with confidence + source, and lets the
// estimator edit before saving via the existing quoteService. Engine-priced
// fields (labor hrs, rates) are never touched.
// ----------------------------------------------------------------------------
export function mapToEditorInputs(fields: ExtractedField[]): {
  prefill: Record<string, { value: string | number; confidence: string; source: string }>;
} {
  const prefill: Record<string, { value: string | number; confidence: string; source: string }> = {};
  // canonical doc field -> editor input field
  const FIELD_MAP: Record<string, string> = {
    description: 'job_name',
    quantity: 'quantity',
    material: 'material_spec',
    material_grade: 'material_spec',  // appended if both present (handled in UI)
    finish: 'finish_spec',
    due_date: 'lead_time',
    customer_po: 'po_reference',
    notes: 'notes',
    part_number: 'part_number',
    drawing_number: 'drawing_number',
    thickness: 'thickness',
  };
  for (const f of fields) {
    const editorField = FIELD_MAP[f.field];
    if (!editorField) continue;
    prefill[editorField] = { value: f.value, confidence: f.confidence, source: `spreadsheet (${f.sourceHeader})` };
  }
  return { prefill };
}
