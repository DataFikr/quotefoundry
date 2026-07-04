import { generateQuotePdf } from './generateQuotePdf.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';
const OUT_DIR = process.env.PDF_OUT_DIR || os.tmpdir();

// A realistic quote record (the shape quoteService produces)
const quote = {
  quote_number: 'Q-2026-051',
  customer_name: 'Apex Industrial',
  customer_email: 'purchasing@apexindustrial.com',
  po_reference: 'AX-4471',
  created_at: '2026-06-25',
  terms: 'Net 30',
  inputs: {
    job_name: 'Stair stringers (pair)',
    material_spec: 'A36 steel, 240 lb + drop allowance',
    finish_spec: 'primer + safety-green topcoat',
    quantity: 2,
    lead_time: '2-3 weeks',
  },
  totals: {
    line_material: 234.60, line_labor: 810, line_burn: 70, line_consumables: 48,
    line_outside: 85, total_cost: 1247.60, total_overhead: 224.57,
    total_margin: 441.65, quoted_price: 1913.82, per_unit: 956.91,
  },
};
const shop = {
  name: 'Ironside Fabrication',
  tagline: 'Structural & custom steel · AWS D1.1 certified',
  address: '1480 Foundry Road, Cleveland, OH 44114',
  phone: '(216) 555-0142',
  email: 'quotes@ironsidefab.com',
  compliance: 'All structural welding to AWS D1.1 by certified welders; mill certs available on request',
};

const buf = await generateQuotePdf(quote, shop);
fs.writeFileSync(path.join(OUT_DIR, 'QuoteFoundry_Quote_J-2026-051.pdf'), buf);

// --- verify it's a valid PDF ---
let pass=0, fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  PASS',n)}else{fail++;console.log('  FAIL',n)}};
console.log('\n1. Valid PDF produced:');
check('starts with PDF magic bytes', buf.slice(0,5).toString()==='%PDF-');
check('non-trivial size', buf.length > 2000);

// pdfkit hex-encodes the text layer, so EXTRACT the text properly to verify.
const { PDFParse } = await import('pdf-parse');
const text = (await new PDFParse({ data: new Uint8Array(buf) }).getText()).text;

// --- THE CRITICAL CHECK: the profit split (margin/overhead) must NOT appear ---
console.log('\n2. Internal economics are NOT leaked to the customer:');
check('margin amount (441.65) absent', !text.includes('441.65'));
check('overhead amount (224.57) absent', !text.includes('224.57'));
check('the word "Margin" absent', !/margin/i.test(text));
check('the word "Overhead" absent', !/overhead/i.test(text));
// Note: the customer Subtotal equals the scope-line sum (1,247.60) BY DESIGN —
// that is an aggregate subtotal, not a labeled "shop cost"; §4.4 forbids the
// margin/overhead split, which is folded into "Shop fees & handling".
check('remainder folded into shop fees', text.includes('Shop fees & handling'));

console.log('\n3. Customer-facing numbers ARE present:');
check('total price present', text.includes('1,913.82'));
check('quote number present', text.includes('Q-2026-051'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
