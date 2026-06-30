// ============================================================================
// generateQuotePdf.mjs — server-side customer-facing quote PDF
// ----------------------------------------------------------------------------
// Renders a branded quote from a QUOTE RECORD (not hardcoded data). Runs
// server-side (Edge Function / API route) and returns a PDF buffer the email
// step attaches or the app offers as a download.
//
// THE CRITICAL RULE: the customer PDF shows SCOPE + TOTAL only. Internal cost,
// overhead, and margin are NEVER printed — those live on the shop's detail
// view, not the document that goes to the customer. The line items are grouped
// for the customer, not itemised the way the engine breaks them down.
// ============================================================================

import PDFDocument from 'pdfkit';

// brand palette (matches the design system)
const BLUE_DK = '#042C53';
const BLUE = '#185FA5';
const GREEN = '#0F6E56';
const GREEN_DK = '#04342C';
const GREEN_LT = '#E1F5EE';
const BLUE_LT = '#E6F1FB';
const INK = '#1A1A1A';
const MUTE = '#5F6B7A';
const HAIR = '#D8DEE4';

const money = (n) =>
  '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ----------------------------------------------------------------------------
// Build the customer-facing line items from the quote. We GROUP engine lines
// into customer-sensible scope items and never expose overhead/margin.
// Subtotal = quoted_price minus a single "shop fees" remainder so the math
// reads cleanly without revealing the margin breakdown.
// ----------------------------------------------------------------------------
function buildScopeLines(quote) {
  const t = quote.totals;
  const lines = [];
  if (t.line_material > 0)
    lines.push(['Material', quote.inputs.material_spec || 'Steel + drop allowance', t.line_material]);

  // group labor + machine into one "fabrication labor & machine time" line
  const fab = t.line_labor + t.line_burn + t.line_consumables;
  if (fab > 0) lines.push(['Fabrication labor & machine time', 'cut, fit, weld, finish · incl. consumables', fab]);

  if (t.line_outside > 0)
    lines.push(['Outside services', quote.inputs.finish_spec || 'coating / finishing', t.line_outside]);

  return lines;
}

export function generateQuotePdf(quote, shop) {
  return new Promise((resolve, reject) => {
    // compress:false keeps the text layer inspectable (so the margin-hiding
    // guarantee is verifiable by scanning the output, not just by construction).
    const doc = new PDFDocument({ size: 'LETTER', margin: 50, compress: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const left = 50;
    const right = pageW - 50;
    const contentW = right - left;

    // ---- HEADER BAND ----
    doc.rect(0, 0, pageW, 92).fill(BLUE_DK);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
      .text(shop.name.toUpperCase(), left, 28, { width: contentW - 130 });
    doc.font('Helvetica').fontSize(9).fillColor('#B5D4F4')
      .text(shop.tagline || 'Custom steel fabrication', left, 54);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#FFFFFF')
      .text('QUOTE', right - 130, 28, { width: 130, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#B5D4F4')
      .text(`No. ${quote.quote_number}`, right - 130, 54, { width: 130, align: 'right' });
    // green accent rule
    doc.rect(0, 92, pageW, 3).fill(GREEN);

    let y = 116;

    // ---- FROM / TO / DETAILS ----
    const colW = contentW / 3;
    const block = (x, title, rows) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTE).text(title, x, y);
      doc.font('Helvetica').fontSize(9.5).fillColor(INK);
      let yy = y + 14;
      rows.forEach((r, i) => {
        doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fillColor(i === 0 ? INK : MUTE)
          .text(r, x, yy, { width: colW - 10 });
        yy += 14;
      });
    };
    block(left, 'FROM', [shop.name, shop.address || '', shop.phone || '', shop.email || '']);
    block(left + colW, 'QUOTE FOR', [quote.customer_name || '—', quote.customer_email || '', quote.po_reference ? `PO: ${quote.po_reference}` : '']);
    block(left + colW * 2, 'DETAILS', [
      `Date: ${new Date(quote.created_at || Date.now()).toLocaleDateString()}`,
      'Valid: 30 days',
      quote.inputs.lead_time ? `Lead time: ${quote.inputs.lead_time}` : 'Lead time: on request',
      `Terms: ${quote.terms || 'Net 30'}`,
    ]);
    y += 92;

    // ---- JOB SUMMARY STRIP ----
    doc.rect(left, y, contentW, 40).fill(BLUE_LT);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTE).text('JOB', left + 12, y + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE_DK)
      .text(quote.inputs.job_name, left + 12, y + 20, { width: contentW - 200 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTE).text('QTY', right - 120, y + 8);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE_DK)
      .text(`${quote.inputs.quantity} ea`, right - 120, y + 20);
    y += 58;

    // ---- SCOPE TABLE ----
    doc.font('Helvetica-Bold').fontSize(10).fillColor(BLUE).text('Scope of work', left, y);
    y += 18;
    // header row
    doc.rect(left, y, contentW, 24).fill(BLUE);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    doc.text('Description', left + 12, y + 8);
    doc.text('Amount', right - 110, y + 8, { width: 98, align: 'right' });
    y += 24;

    const lines = buildScopeLines(quote);
    lines.forEach((l, i) => {
      const rowH = 30;
      if (i % 2 === 1) { doc.rect(left, y, contentW, rowH).fill('#F5F8FC'); }
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(l[0], left + 12, y + 6, { width: contentW - 130 });
      doc.font('Helvetica').fontSize(8).fillColor(MUTE).text(l[1], left + 12, y + 18, { width: contentW - 130 });
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(money(l[2]), right - 110, y + 10, { width: 98, align: 'right' });
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor(HAIR).lineWidth(0.5).stroke();
      y += rowH;
    });
    y += 10;

    // ---- TOTAL (scope + total only — NO margin/overhead) ----
    // subtotal is the sum of shown scope lines; the difference to quoted_price
    // is folded into one neutral "shop fees & handling" line so margin stays hidden.
    const scopeSum = lines.reduce((s, l) => s + l[2], 0);
    const fees = Math.max(0, quote.totals.quoted_price - scopeSum);
    const totalsX = right - 230;

    const totalRow = (label, val, opts = {}) => {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.big ? 13 : 10)
        .fillColor(opts.color || MUTE).text(label, totalsX, y, { width: 130, align: 'right' });
      doc.font('Helvetica-Bold').fontSize(opts.big ? 14 : 10).fillColor(opts.color || INK)
        .text(money(val), totalsX + 130, y, { width: 100, align: 'right' });
    };
    totalRow('Subtotal', scopeSum);
    y += 18;
    if (fees > 0.005) { totalRow('Shop fees & handling', fees); y += 18; }
    y += 4;
    // green grand-total band
    doc.rect(totalsX - 12, y, 254, 34).fill(GREEN_LT);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(GREEN_DK)
      .text('Total', totalsX, y + 10, { width: 130, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(GREEN_DK)
      .text(money(quote.totals.quoted_price), totalsX + 130, y + 8, { width: 100, align: 'right' });
    y += 34;
    doc.font('Helvetica').fontSize(10).fillColor(MUTE)
      .text(`${money(quote.totals.per_unit)} per unit · qty ${quote.inputs.quantity}`,
        totalsX - 12, y + 6, { width: 254, align: 'right' });
    y += 30;

    // ---- TERMS ----
    doc.moveTo(left, y).lineTo(right, y).strokeColor(HAIR).lineWidth(0.5).stroke();
    y += 10;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(BLUE_DK).text('Notes & terms', left, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).fillColor(MUTE).text(
      'Valid 30 days; pricing reflects current material costs and may be revised if prices change before order. ' +
      (shop.compliance ? `${shop.compliance}. ` : '') +
      'Lead time begins on signed approval; scope or quantity changes may affect price and lead time.',
      left, y, { width: contentW, lineGap: 2 }
    );

    // ---- FOOTER ----
    doc.font('Helvetica').fontSize(8).fillColor(MUTE).text(
      `${shop.name} · ${shop.address || ''} · Thank you for the opportunity to quote your work.`,
      left, doc.page.height - 60, { width: contentW, align: 'center' }
    );

    doc.end();
  });
}
