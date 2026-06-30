// @vitest-environment node
// ============================================================================
// pdf.test.ts — Stage 6 PDF gate. Generates the customer PDF for the canonical
// quote and EXTRACTS its text (pdfkit hex-encodes the text layer, so a raw
// byte scan is meaningless — we decode it properly). Proves §4.4: the customer
// document shows scope + total and NEVER the profit split (margin/overhead).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { PDFParse } from 'pdf-parse';
// @ts-expect-error — .mjs module has no types
import { generateQuotePdf } from './generateQuotePdf.mjs';

const quote = {
  quote_number: 'Q-2026-051', customer_name: 'Apex Industrial',
  customer_email: 'purchasing@apex.com', created_at: '2026-06-25',
  inputs: { job_name: 'Stair stringers', material_spec: 'A36 steel', finish_spec: 'primer + topcoat', quantity: 2, lead_time: '2-3 weeks' },
  totals: {
    line_material: 234.6, line_labor: 810, line_burn: 70, line_consumables: 48,
    line_outside: 85, total_cost: 1247.6, total_overhead: 224.57,
    total_margin: 441.65, quoted_price: 1913.82, per_unit: 956.91,
  },
};
const shop = { name: 'Ironside Fabrication', address: 'Cleveland, OH', phone: '(216) 555-0142', email: 'quotes@ironsidefab.com' };

async function extract(): Promise<string> {
  const buf: Buffer = await generateQuotePdf(quote, shop);
  expect(buf.slice(0, 5).toString()).toBe('%PDF-');
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  return (await parser.getText()).text;
}

describe('customer PDF (CLAUDE.md §4.4)', () => {
  it('shows customer-facing scope + total', async () => {
    const t = await extract();
    expect(t).toContain('Q-2026-051');
    expect(t).toContain('1,913.82');            // total
    expect(t).toContain('Total');
    expect(t).toContain('Subtotal');
    expect(t).toContain('Fabrication labor & machine time'); // grouped, not itemized
    expect(t).toContain('Shop fees & handling');
  });

  it('NEVER shows the profit split (margin / overhead) — labels or amounts', async () => {
    const t = await extract();
    expect(t).not.toMatch(/margin/i);
    expect(t).not.toMatch(/overhead/i);
    expect(t).not.toContain('441.65'); // margin amount
    expect(t).not.toContain('224.57'); // overhead amount
  });
});
