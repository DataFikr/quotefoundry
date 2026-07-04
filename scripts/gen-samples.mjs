// Generates sample RFQ files used by the editor's "Try a sample" chips and the
// Document Assist e2e: a Tier-1 spreadsheet (CSV) and a Tier-2 text-layer PDF.
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outDir = path.resolve('public/samples');
fs.mkdirSync(outDir, { recursive: true });

// --- Tier 1: CSV ---
// Headers match the editor's Project fields (Part #, Description, Due Date)
// plus quantity/material/finish — all high-confidence Doc Assist synonyms.
const csv = [
  'Part Number,Description,Due Date,Quantity,Material,Finish',
  'SS-4471,Stair stringers,2026-07-15,12,A36 Steel,Powder Coat',
  'BRK-88,Handrail brackets,2026-07-20,8,A36 Steel,Primer',
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
  'Description: Stair stringers',
  'Due Date: 2026-07-15',
  'Quantity: 12',
  'Material: A36 steel',
  'Finish: powder coat',
  'PO #: AX-4471',
  'Notes: two matching stair stringers, galvanized.',
].forEach((l) => doc.text(l));
doc.end();
