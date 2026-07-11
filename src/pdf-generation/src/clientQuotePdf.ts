// ============================================================================
// clientQuotePdf.ts — browser-side customer quote PDF (jsPDF)
// ----------------------------------------------------------------------------
// Used by "Download PDF" on the quote detail screen: regenerates the document
// from the quote's FROZEN data (rate snapshot + customer snapshot + stored
// pdf_style), so the download always reproduces what was sent — no server
// round-trip needed. Line grouping comes from customerScope(), the same
// function the preview modal uses, so THE MARGIN-HIDING RULE (CLAUDE.md §4.4)
// holds by construction: scope + total only, never cost/overhead/margin.
//
// Three templates (chosen in the preview modal, frozen on quote.pdf_style):
//   classic — navy header band, green total (matches the server PDF)
//   modern  — brand periwinkle band (app design tokens)
//   minimal — black & white, thin rules
// ============================================================================

import { jsPDF } from 'jspdf';
import { customerScope } from '../../app/customerScope';
import { formatLeadTime } from '../../app/leadTime';
import type { Quote, PdfStyle, ShopInfo } from '../../data-access-layer/lib/types';

interface Theme {
  bandBg: string;       // header band fill ('' = no fill, ink text)
  bandText: string;
  bandSub: string;
  rule: string;         // accent rule under the band
  tableHead: string;    // scope table header fill
  tableHeadText: string;
  stripBg: string;      // job summary strip
  stripText: string;
  totalBg: string;      // grand-total band
  totalText: string;
  zebra: string;        // alternating row fill
}

const THEMES: Record<PdfStyle, Theme> = {
  classic: {
    bandBg: '#042C53', bandText: '#FFFFFF', bandSub: '#B5D4F4', rule: '#0F6E56',
    tableHead: '#185FA5', tableHeadText: '#FFFFFF', stripBg: '#E6F1FB', stripText: '#042C53',
    totalBg: '#E1F5EE', totalText: '#04342C', zebra: '#F5F8FC',
  },
  modern: {
    bandBg: '#1B51E5', bandText: '#FFFFFF', bandSub: '#C8D6FF', rule: '#4667DB',
    tableHead: '#4667DB', tableHeadText: '#FFFFFF', stripBg: '#EEF1FF', stripText: '#1B51E5',
    totalBg: '#EEF1FF', totalText: '#1B51E5', zebra: '#F7F8FF',
  },
  minimal: {
    bandBg: '', bandText: '#1A1A1A', bandSub: '#5F6B7A', rule: '#1A1A1A',
    tableHead: '', tableHeadText: '#1A1A1A', stripBg: '', stripText: '#1A1A1A',
    totalBg: '', totalText: '#1A1A1A', zebra: '',
  },
};

const INK = '#1A1A1A';
const MUTE = '#5F6B7A';
const money = (n: number) =>
  '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' | null {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
  return null;
}

export function buildQuotePdf(quote: Quote, shop: Pick<ShopInfo, 'name' | 'logo_url'>, style?: PdfStyle): jsPDF {
  const t = THEMES[style ?? quote.pdf_style ?? 'classic'];
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 50;
  const right = pageW - 50;
  const contentW = right - left;

  // ---- HEADER BAND (logo top-left, per shop branding) ----
  const bandH = 92;
  if (t.bandBg) { doc.setFillColor(t.bandBg); doc.rect(0, 0, pageW, bandH, 'F'); }
  let nameX = left;
  const logoFmt = shop.logo_url ? imageFormat(shop.logo_url) : null;
  if (shop.logo_url && logoFmt) {
    try {
      doc.addImage(shop.logo_url, logoFmt, left, 20, 52, 52);
      nameX = left + 64;
    } catch { /* unreadable image: fall back to text-only header */ }
  }
  doc.setTextColor(t.bandText); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(shop.name.toUpperCase(), nameX, 42, { maxWidth: contentW - (nameX - left) - 140 });
  doc.setTextColor(t.bandSub); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Custom steel fabrication', nameX, 60);
  doc.setTextColor(t.bandText); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('QUOTE', right, 42, { align: 'right' });
  doc.setTextColor(t.bandSub); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`No. ${quote.quote_number}`, right, 60, { align: 'right' });
  doc.setFillColor(t.rule); doc.rect(0, bandH, pageW, t.bandBg ? 3 : 1.5, 'F');

  let y = 118;

  // ---- FROM / QUOTE FOR / DETAILS ----
  const colW = contentW / 3;
  const block = (x: number, title: string, rows: string[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(MUTE);
    doc.text(title, x, y);
    let yy = y + 14;
    rows.filter(Boolean).forEach((r, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setFontSize(9.5);
      doc.setTextColor(i === 0 ? INK : MUTE);
      doc.text(r, x, yy, { maxWidth: colW - 10 });
      yy += 14;
    });
  };
  block(left, 'FROM', [shop.name]);
  block(left + colW, 'QUOTE FOR', [quote.customer_name || '—', quote.customer_email || '', quote.po_reference ? `PO: ${quote.po_reference}` : '']);
  block(left + colW * 2, 'DETAILS', [
    `Date: ${new Date(quote.created_at || Date.now()).toLocaleDateString()}`,
    'Valid: 30 days',
    `Lead time: ${formatLeadTime(quote.inputs.lead_time) || 'on request'}`,
    'Terms: Net 30',
  ]);
  y += 84;

  // ---- JOB SUMMARY STRIP (part number shown when present) ----
  const jobLine = quote.inputs.part_number
    ? `${quote.inputs.job_name} · Part # ${quote.inputs.part_number}`
    : quote.inputs.job_name;
  if (t.stripBg) { doc.setFillColor(t.stripBg); doc.rect(left, y, contentW, 40, 'F'); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(MUTE);
  doc.text('JOB', left + 12, y + 14);
  doc.setFontSize(11); doc.setTextColor(t.stripText || INK);
  doc.text(jobLine, left + 12, y + 30, { maxWidth: contentW - 200 });
  doc.setFontSize(8); doc.setTextColor(MUTE);
  doc.text('QTY', right - 108, y + 14);
  doc.setFontSize(11); doc.setTextColor(t.stripText || INK);
  doc.text(`${quote.inputs.quantity} ea`, right - 108, y + 30);
  if (!t.stripBg) { doc.setDrawColor('#1A1A1A'); doc.setLineWidth(0.5); doc.line(left, y + 40, right, y + 40); }
  y += 58;

  // ---- SCOPE TABLE (customerScope — margin/overhead structurally excluded) ----
  const { lines, subtotal, fees, total } = customerScope(quote);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.setTextColor(t.tableHead || INK);
  doc.text('Scope of work', left, y);
  y += 10;
  if (t.tableHead) { doc.setFillColor(t.tableHead); doc.rect(left, y, contentW, 24, 'F'); }
  doc.setFontSize(9); doc.setTextColor(t.tableHeadText);
  doc.text('Description', left + 12, y + 15);
  doc.text('Amount', right - 12, y + 15, { align: 'right' });
  if (!t.tableHead) { doc.setDrawColor('#1A1A1A'); doc.setLineWidth(1); doc.line(left, y + 24, right, y + 24); }
  y += 24;

  lines.forEach((l, i) => {
    const rowH = 30;
    if (t.zebra && i % 2 === 1) { doc.setFillColor(t.zebra); doc.rect(left, y, contentW, rowH, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(INK);
    doc.text(l.label, left + 12, y + 12, { maxWidth: contentW - 130 });
    doc.setFontSize(8); doc.setTextColor(MUTE);
    doc.text(l.detail ?? '', left + 12, y + 24, { maxWidth: contentW - 130 });
    doc.setFontSize(9.5); doc.setTextColor(INK);
    doc.text(money(l.amount), right - 12, y + 16, { align: 'right' });
    doc.setDrawColor('#D8DEE4'); doc.setLineWidth(0.5); doc.line(left, y + rowH, right, y + rowH);
    y += rowH;
  });
  y += 14;

  // ---- TOTALS (scope + total only) ----
  const totalsRight = right;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTE);
  doc.text('Subtotal', totalsRight - 110, y, { align: 'right' });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(INK);
  doc.text(money(subtotal), totalsRight, y, { align: 'right' });
  y += 18;
  if (fees > 0.005) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(MUTE);
    doc.text('Shop fees & handling', totalsRight - 110, y, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(INK);
    doc.text(money(fees), totalsRight, y, { align: 'right' });
    y += 18;
  }
  y += 4;
  if (t.totalBg) { doc.setFillColor(t.totalBg); doc.rect(totalsRight - 254, y, 254, 34, 'F'); }
  else { doc.setDrawColor('#1A1A1A'); doc.setLineWidth(1); doc.line(totalsRight - 254, y, totalsRight, y); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(t.totalText);
  doc.text('Total', totalsRight - 110, y + 22, { align: 'right' });
  doc.setFontSize(16);
  doc.text(money(total), totalsRight - 12, y + 22, { align: 'right' });
  y += 34;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(MUTE);
  doc.text(`${money(quote.totals.per_unit)} per unit · qty ${quote.inputs.quantity}`, totalsRight - 12, y + 14, { align: 'right' });
  y += 36;

  // ---- TERMS + FOOTER ----
  doc.setDrawColor('#D8DEE4'); doc.setLineWidth(0.5); doc.line(left, y, right, y);
  y += 14;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(t.tableHead || INK);
  doc.text('Notes & terms', left, y);
  y += 12;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTE);
  doc.text(
    'Valid 30 days; pricing reflects current material costs and may be revised if prices change before order. ' +
    'Lead time begins on signed approval; scope or quantity changes may affect price and lead time.',
    left, y, { maxWidth: contentW, lineHeightFactor: 1.4 }
  );
  doc.setFontSize(8); doc.setTextColor(MUTE);
  doc.text(`${shop.name} · Thank you for the opportunity to quote your work.`,
    pageW / 2, doc.internal.pageSize.getHeight() - 50, { align: 'center' });

  return doc;
}

export function downloadQuotePdf(quote: Quote, shop: Pick<ShopInfo, 'name' | 'logo_url'>, style?: PdfStyle): void {
  buildQuotePdf(quote, shop, style).save(`${quote.quote_number}.pdf`);
}
