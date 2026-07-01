// Generates sample RFQ files used by the editor's "Try a sample" chips and the
// Document Assist e2e: a Tier-1 spreadsheet (CSV) and a Tier-2 text-layer PDF.
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outDir = path.resolve('public/samples');
fs.mkdirSync(outDir, { recursive: true });

// --- Tier 1: CSV ---
const csv = [
  'Part Number,Quantity,Material,Finish,Due Date',
  'SS-4471,12,A36 Steel,Powder Coat,2026-07-15',
  'BRK-88,8,A36 Steel,Primer,2026-07-20',
].join('\n');
fs.writeFileSync(path.join(outDir, 'rfq.csv'), csv);

// --- Tier 2: text-layer PDF ---
const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
const chunks = [];
doc.on('data', (c) => chunks.push(c));
doc.on('end', () => {
  fs.writeFileSync(path.join(outDir, 'rfq.pdf'), Buffer.concat(chunks));
  console.log('wrote public/samples/rfq.csv and rfq.pdf');
});
doc.font('Helvetica-Bold').fontSize(16).text('Request for Quote', { align: 'left' });
doc.moveDown();
doc.font('Helvetica').fontSize(12);
[
  'Part Number: SS-4471',
  'Qty: 12',
  'Material: A36 steel',
  'Finish: powder coat',
  'Due Date: 2026-07-15',
  'PO #: AX-4471',
  'Notes: two matching stair stringers, galvanized.',
].forEach((l) => doc.text(l));
doc.end();
