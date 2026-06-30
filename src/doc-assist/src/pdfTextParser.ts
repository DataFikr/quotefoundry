// ============================================================================
// pdfTextParser.ts — Tier 2: text-layer PDF extraction (zero tokens by default)
// ----------------------------------------------------------------------------
// Pipeline:
//   1. Extract the PDF's embedded text with a library (NO token cost).
//   2. Run the text-layer GATE (from tierRouter) — if there's not enough real
//      text, this is a scanned/image PDF: store only, NEVER call OCR/vision.
//   3. Keyword/regex matching pulls labeled values out of the text (zero tokens).
//   4. (Optional, deferred) a small AI structuring pass ONLY if keyword matching
//      proves insufficient on real files. Kept out of the default path.
//
// All Tier-2 fields default to LOW/MEDIUM confidence — PDF layouts vary, so the
// estimator is nudged to verify every value. Tier 2 is a head-start, not truth.
// ============================================================================

import { pdfTextLayerGate, Tier } from './tierRouter';
import type { ExtractedField, Confidence } from './spreadsheetParser';

export interface PdfParseResult {
  tier: Tier;                 // tier2_text_pdf if parsed, tier3_store_only if gated out
  gatedOut: boolean;          // true = no usable text layer (scanned/image)
  fields: ExtractedField[];
  rawTextLength: number;      // for telemetry
}

// ----------------------------------------------------------------------------
// Label patterns: canonical field -> regexes that find "Label: value" or
// "Label value" in free text. Ordered most-specific first. All case-insensitive.
// Confidence is intentionally capped at MEDIUM for PDFs (never "high") because
// label-based extraction from varied layouts is inherently less certain than a
// spreadsheet column.
// ----------------------------------------------------------------------------
interface LabelRule {
  field: string;
  patterns: RegExp[];
  confidence: Confidence;     // medium for clear labels, low for loose ones
  clean?: (v: string) => string;
}

const trim = (v: string) => v.replace(/\s+/g, ' ').trim();

const RULES: LabelRule[] = [
  { field: 'quantity', confidence: 'medium',
    patterns: [
      /(?:qty|quantity|order\s*qty|pieces|pcs)\s*[:#]?\s*(\d{1,6})/i,
    ],
    clean: (v) => v.replace(/[^\d]/g, ''),
  },
  { field: 'part_number', confidence: 'medium',
    patterns: [
      /(?:part\s*(?:number|no|#)|p\/n|\bpn\b)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{0,30}[A-Za-z0-9])/i,
    ],
  },
  { field: 'drawing_number', confidence: 'medium',
    patterns: [
      /(?:drawing\s*(?:number|no|#)|dwg\s*(?:no|#)?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{1,30})/i,
    ],
  },
  { field: 'customer_po', confidence: 'medium',
    patterns: [
      /(?:p\.?o\.?\s*(?:number|no|#)?|purchase\s*order)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\-_.\/]{1,30})/i,
    ],
  },
  { field: 'material', confidence: 'medium',
    patterns: [
      /(?:material|matl|mat'?l)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9 \-_.\/]{1,40}?)(?:\s{2,}|\n|$|thickness|qty|finish)/i,
    ],
    clean: trim,
  },
  { field: 'thickness', confidence: 'medium',
    patterns: [
      /(?:thickness|thk|gauge|ga)\s*[:#]?\s*([0-9][0-9.\/" ]{0,12}(?:in|mm|"|ga)?)/i,
    ],
    clean: trim,
  },
  { field: 'finish', confidence: 'medium',
    patterns: [
      /(?:finish|coating)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9 \-_.\/]{1,30}?)(?:\s{2,}|\n|$|qty|material)/i,
    ],
    clean: trim,
  },
  { field: 'due_date', confidence: 'low',
    patterns: [
      /(?:due\s*date|due|need\s*by|required\s*(?:date|by)|delivery\s*date)\s*[:#]?\s*([0-9]{1,4}[\/\-.][0-9]{1,2}[\/\-.][0-9]{1,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s*\d{0,4})/i,
    ],
    clean: trim,
  },
];

/**
 * Keyword extraction over already-extracted PDF text. Zero tokens.
 */
export function keywordExtract(text: string): ExtractedField[] {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const value = rule.clean ? rule.clean(m[1]) : m[1].trim();
        if (value && !seen.has(rule.field)) {
          fields.push({
            field: rule.field,
            value,
            confidence: rule.confidence,
            sourceHeader: 'pdf-text',
          });
          seen.add(rule.field);
        }
        break; // first matching pattern wins for this field
      }
    }
  }
  return fields;
}

/**
 * Full Tier-2 entry point. Takes the raw extracted PDF text (the caller runs
 * pdf-parse to get it server-side), gates it, and keyword-extracts.
 *
 * Separating text extraction (I/O) from this pure function keeps the logic
 * testable without a real PDF — the same pattern used throughout the build.
 */
export function parsePdfText(extractedText: string): PdfParseResult {
  const gate = pdfTextLayerGate(extractedText);
  if (gate.tier === 'tier3_store_only') {
    // Scanned/image PDF — no usable text. Store only. NEVER OCR.
    return { tier: 'tier3_store_only', gatedOut: true, fields: [], rawTextLength: (extractedText || '').length };
  }
  const fields = keywordExtract(extractedText);
  return {
    tier: 'tier2_text_pdf',
    gatedOut: false,
    fields,
    rawTextLength: extractedText.length,
  };
}

// ----------------------------------------------------------------------------
// OPTIONAL AI structuring pass — DEFERRED, off by default.
// Only build/enable this if real customer PDFs prove keyword matching misses
// too much. The input is extracted TEXT (cheap, a few thousand tokens), never
// images. Documented here so the escalation path is explicit but unbuilt.
// ----------------------------------------------------------------------------
export const AI_STRUCTURING_ENABLED = false;

export async function aiStructureFallback(_text: string): Promise<ExtractedField[]> {
  // Intentionally unimplemented for the MVP. When enabled:
  //   - send extracted text (not images) to the model
  //   - prompt for strict JSON: { field: value, confidence } or null
  //   - cap confidence at 'medium', flag everything for review
  // Keeping this a no-op preserves the zero-token guarantee by default.
  return [];
}
