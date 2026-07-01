// ============================================================================
// docAssistAnalyzer.ts — the BROWSER entry for Document Assist (Tier 1 + 2).
// Routes an uploaded file by type, parses what it can (spreadsheet columns or
// text-PDF keywords), and returns editor pre-fill drafts + a status message.
// Zero AI tokens: Tier 1 is deterministic header matching; Tier 2 extracts the
// PDF's embedded text (via pdf.js) and keyword-matches — the text-layer gate
// keeps scanned/image PDFs out (never OCR). Every value is a draft to review.
//
// Storage/audit (quote_files) is the live-only concern in docAssistService;
// this analyzer only produces the pre-fill the editor holds until save.
// ============================================================================
import * as pdfjsLib from 'pdfjs-dist';
// Vite resolves this to a hashed URL for the worker bundle.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { routeByType, Tier } from './tierRouter';
import { parseSpreadsheet, ExtractedField } from './spreadsheetParser';
import { parsePdfText } from './pdfTextParser';
import { mapToEditorInputs, Prefill } from './fieldMap';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface AnalyzeResult {
  tier: Tier;
  parsed: boolean;
  gatedOut?: boolean;               // Tier 2 PDF with no usable text layer
  fields: ExtractedField[];
  additionalRows: number;
  message: string;
  unmatchedHeaders?: string[];
  prefill: Prefill;
}

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  return text;
}

export async function analyzeFile(file: File): Promise<AnalyzeResult> {
  const route = routeByType(file.name);
  const buf = await file.arrayBuffer();

  // Tier 1 — spreadsheet (zero tokens, high confidence on exact headers)
  if (route.tier === 'tier1_spreadsheet') {
    try {
      const r = parseSpreadsheet(buf);
      return {
        tier: 'tier1_spreadsheet', parsed: true, fields: r.fields,
        additionalRows: r.additionalRows, unmatchedHeaders: r.unmatchedHeaders,
        prefill: mapToEditorInputs(r.fields, 'spreadsheet'),
        message: r.fields.length
          ? `Pre-filled ${r.fields.length} field${r.fields.length > 1 ? 's' : ''} from the spreadsheet. Review each before saving.`
          : 'Spreadsheet attached, but no recognizable columns — enter details manually.',
      };
    } catch {
      return store('Spreadsheet attached, but it couldn’t be read — enter details manually.');
    }
  }

  // Tier 2 — PDF: extract embedded text, run the gate, keyword-match
  if (route.tier === 'tier2_text_pdf') {
    try {
      const text = await extractPdfText(buf);
      const r = parsePdfText(text);
      if (r.gatedOut) {
        return { tier: 'tier3_store_only', parsed: false, gatedOut: true, fields: [], additionalRows: 0, prefill: {},
          message: 'PDF attached — no readable text layer (scanned/image). Enter details manually; we never OCR.' };
      }
      return {
        tier: 'tier2_text_pdf', parsed: true, gatedOut: false, fields: r.fields, additionalRows: 0,
        prefill: mapToEditorInputs(r.fields, 'PDF — verify'),
        message: r.fields.length
          ? `Read ${r.fields.length} field${r.fields.length > 1 ? 's' : ''} from the PDF text. PDF layouts vary — please verify each.`
          : 'PDF text read, but no fields matched — enter details manually.',
      };
    } catch {
      return store('PDF attached, but it couldn’t be read — enter details manually.');
    }
  }

  // Tier 3 — store only (CAD, images, archives, unknown). Never a dead end.
  return store('Attached — couldn’t auto-read this file type, enter details manually.');

  function store(message: string): AnalyzeResult {
    return { tier: 'tier3_store_only', parsed: false, fields: [], additionalRows: 0, prefill: {}, message };
  }
}
