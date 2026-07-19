// ============================================================================
// gen-fab-calculator.mjs — builds the free "Metal Fabrication & Machining Job
// Calculator" spreadsheet (public/guides/metal-fabrication-job-calculator.xlsx).
//
// A downloadable, formula-driven .xlsx that mirrors QuoteFoundry's engine and
// the converged machining formula from docs/consulting/12-machining-estimating-
// gap-analysis.md:
//   Part cost = (setup ÷ qty) + (cycle × machine rate) + material + tooling
//               + secondary ops  → × (1 + overhead) → × (1 + margin)
// Three tabs: Calculator (live), Fab example ($1,913.82 canonical), Rates &
// sources (suggested material $/lb + labor $/hr with research links).
//
//   node scripts/gen-fab-calculator.mjs
// Regenerate whenever the formula or reference rates change. SheetJS community
// edition can't embed images, so the "logo" is the ⚡ wordmark + a live
// hyperlink to quotefoundry.app in the header row.
// ============================================================================
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const OUT = 'public/guides/metal-fabrication-job-calculator.xlsx';
const SITE = 'https://quotefoundry.app';
const cur = '$#,##0.00';
const pct = '0%';

// --- cell helpers -----------------------------------------------------------
const S = (v) => ({ t: 's', v: String(v) });
const N = (v, z) => (z ? { t: 'n', v, z } : { t: 'n', v });
const F = (f, v, z) => (z ? { t: 'n', f, v, z } : { t: 'n', f, v });
const LINK = (text, url) => ({ t: 's', v: text, l: { Target: url, Tooltip: url } });

// Build a worksheet from an array of rows (each row an array of cell specs:
// primitive | cell-object | null).
function sheet(rows, { cols, merges } = {}) {
  const ws = {};
  let maxR = 0, maxC = 0;
  rows.forEach((row, r) => {
    (row || []).forEach((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return;
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = typeof cell === 'object'
        ? cell
        : (typeof cell === 'number' ? { t: 'n', v: cell } : { t: 's', v: String(cell) });
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: Math.max(maxC, 3) } });
  if (cols) ws['!cols'] = cols;
  if (merges) ws['!merges'] = merges.map((a1) => XLSX.utils.decode_range(a1));
  return ws;
}

// ============================================================================
// TAB 1 — Calculator (prefilled with a realistic machined-part example)
// ============================================================================
const i = { qty: 10, wpp: 3, mp: 1.05, scrap: 0.10, cyc: 8, mr: 95, lh: 0.25, lr: 80, cons: 2, out: 0, sh: 2, sr: 75, tool: 50, oh: 0.18, mg: 0.30 };
const matcost = i.wpp * i.mp * (1 + i.scrap);
const mach = i.cyc / 60 * i.mr;
const lab = i.lh * i.lr;
const varpp = matcost + mach + lab + i.cons + i.out;
const setup = i.sh * i.sr;
const onetime = setup + i.tool;
const shopPart = varpp + onetime / i.qty;
const ohAmt = shopPart * i.oh;
const mgAmt = (shopPart + ohAmt) * i.mg;
const pricePart = shopPart * (1 + i.oh) * (1 + i.mg);
const lot = pricePart * i.qty;

const calcBase = [
  [LINK('⚡ QuoteFoundry — Metal Fabrication & Machining Job Calculator', SITE)],                 // 1
  [LINK('Free tool · quotefoundry.app — price a fab or machined job from your own shop rates', SITE)], // 2
  [],                                                                                             // 3
  ['HOW TO USE — edit the values in column B. Result cells calculate automatically. Works in Excel, Google Sheets & LibreOffice.'], // 4
  [],                                                                                             // 5
  ['JOB'],                                                                                        // 6
  ['Job name', S('e.g. Mounting bracket')],                                                       // 7
  ['Quantity (pieces)', N(i.qty)],                                                                // 8  B8
  [],                                                                                             // 9
  ['PER-PART VARIABLE COST  (cost to make ONE piece)'],                                           // 10
  ['Material weight per part (lb)', N(i.wpp)],                                                     // 11 B11
  ['Material price ($/lb)', N(i.mp, cur), S('see "Rates & sources" tab')],                         // 12 B12
  ['Drop / scrap allowance', N(i.scrap, pct)],                                                     // 13 B13
  ['Material cost / part', F('B11*B12*(1+B13)', matcost, cur)],                                    // 14 B14
  [],                                                                                             // 15
  ['Machining / cycle time per part (min)', N(i.cyc)],                                             // 16 B16
  ['Machine rate ($/hr)', N(i.mr, cur)],                                                           // 17 B17
  ['Machine cost / part', F('B16/60*B17', mach, cur)],                                             // 18 B18
  [],                                                                                             // 19
  ['Hand labor per part (hr)', N(i.lh)],                                                           // 20 B20
  ['Labor rate ($/hr)', N(i.lr, cur)],                                                             // 21 B21
  ['Labor cost / part', F('B20*B21', lab, cur)],                                                   // 22 B22
  [],                                                                                             // 23
  ['Consumables / part ($)  (gas, wire, abrasives)', N(i.cons, cur)],                              // 24 B24
  ['Outside services / part ($)  (plating, coating)', N(i.out, cur)],                              // 25 B25
  [],                                                                                             // 26
  ['Variable cost / part  (subtotal)', F('B14+B18+B22+B24+B25', varpp, cur)],                      // 27 B27
  [],                                                                                             // 28
  ['ONE-TIME COST  (whole lot — amortized ÷ qty)'],                                                // 29
  ['Setup & programming (hr)', N(i.sh)],                                                           // 30 B30
  ['Setup rate ($/hr)', N(i.sr, cur)],                                                             // 31 B31
  ['Setup cost (one-time)', F('B30*B31', setup, cur)],                                             // 32 B32
  ['Tooling — endmills / inserts (one-time $)', N(i.tool, cur)],                                   // 33 B33
  ['Total one-time cost', F('B32+B33', onetime, cur)],                                             // 34 B34
  [],                                                                                             // 35
  ['MARK-UPS'],                                                                                    // 36
  ['Overhead', N(i.oh, pct)],                                                                      // 37 B37
  ['Margin', N(i.mg, pct)],                                                                        // 38 B38
  [],                                                                                             // 39
  ['RESULT — at your quantity (cell B8)'],                                                         // 40
  ['Shop cost / part', F('B27+B34/B8', shopPart, cur)],                                            // 41 B41
  ['+ Overhead', F('B41*B37', ohAmt, cur)],                                                        // 42 B42
  ['+ Margin  (on cost + overhead)', F('(B41+B42)*B38', mgAmt, cur)],                              // 43 B43
  ['PRICE / PART', F('(B41+B42)*(1+B38)', pricePart, cur)],                                        // 44 B44
  ['TOTAL FOR THE LOT', F('B44*B8', lot, cur)],                                                    // 45 B45
  [],                                                                                             // 46
  ['PRICE BREAKS — per-part price as setup amortizes across the lot'],                             // 47
  ['Quantity', 'One-time / part', 'Price / part', 'Lot total'],                                    // 48 header
];
// price-break rows start at Excel row 49
const pbRows = [1, 10, 25, 50, 100].map((q, k) => {
  const r = 49 + k;
  const priced = (varpp + onetime / q) * (1 + i.oh) * (1 + i.mg);
  return [
    N(q),
    F(`$B$34/A${r}`, onetime / q, cur),
    F(`($B$27+$B$34/A${r})*(1+$B$37)*(1+$B$38)`, priced, cur),
    F(`C${r}*A${r}`, priced * q, cur),
  ];
});
const calcFooter = [
  [],
  ['Formula (same as QuoteFoundry): Part cost = (setup ÷ qty) + cycle×rate + material + tooling + secondary  →  × (1 + overhead)  →  × (1 + margin).'],
  ['Reference prices/rates are starting points — verify against your own supplier & payroll. Not live market data. No AI guesswork.'],
  [LINK('Turn this into a branded PDF quote in ~10 min → quotefoundry.app', SITE)],
];
const wsCalc = sheet([...calcBase, ...pbRows, ...calcFooter], {
  cols: [{ wch: 42 }, { wch: 17 }, { wch: 26 }, { wch: 14 }],
  merges: ['A1:D1', 'A2:D2', 'A4:D4', 'A10:D10', 'A29:D29', 'A40:D40', 'A47:D47'],
});

// ============================================================================
// TAB 2 — Fabrication example (the canonical $1,913.82 weldment, qty 1)
// ============================================================================
const wsFab = sheet([
  [LINK('⚡ QuoteFoundry — worked fabrication example', SITE)],
  [S('240 lb A36 weldment, qty 1 — the same math, per-lot. Matches QuoteFoundry’s locked $1,913.82.')],
  [],
  ['Line', 'Inputs', 'Amount'],
  ['Material', S('240 lb × $0.85/lb × 1.15 drop'), F('240*0.85*1.15', 234.60, cur)],       // C5
  ['Labor', S('1.5×75 + 3×80 + 4×90 + 1.5×65'), F('1.5*75+3*80+4*90+1.5*65', 810, cur)],   // C6
  ['Machine / burn', S('35 min ÷ 60 × $120/hr'), F('35/60*120', 70, cur)],                 // C7
  ['Consumables', S('4 weld-hr × $12'), F('4*12', 48, cur)],                               // C8
  ['Outside services', S('galvanizing'), N(85, cur)],                                       // C9
  ['Shop cost', '', F('C5+C6+C7+C8+C9', 1247.60, cur)],                                     // C10
  ['+ Overhead 18%', '', F('C10*0.18', 224.568, cur)],                                      // C11
  ['+ Margin 30%', S('on cost + overhead'), F('(C10+C11)*0.30', 441.6504, cur)],           // C12
  ['QUOTED PRICE', '', F('(C10+C11)*1.30', 1913.8164, cur)],                               // C13
  [],
  ['Sequential, not additive: margin applies to cost + overhead. Adding 48% to bare cost would quote $1,847 — $67 short on every job.'],
], {
  cols: [{ wch: 20 }, { wch: 34 }, { wch: 14 }],
  merges: ['A1:C1', 'A2:C2'],
});

// ============================================================================
// TAB 3 — Rates & sources (suggested material $/lb + labor $/hr, research links)
// ============================================================================
const MAT = [
  ['A36 Steel', 0.85, 'Carbon steel'], ['A500 Tube', 0.95, 'Carbon steel'],
  ['1018 CR Bar', 1.05, 'Carbon steel'], ['4140 Alloy', 1.45, 'Carbon steel'],
  ['AR400 Plate', 1.25, 'Carbon steel'], ['304 Stainless', 2.10, 'Stainless'],
  ['316 Stainless', 2.90, 'Stainless'], ['6061 Aluminum', 1.85, 'Aluminum'],
  ['5052 Aluminum', 1.75, 'Aluminum'], ['7075 Aluminum', 3.20, 'Aluminum'],
  ['Brass 360', 4.20, 'Copper alloys'], ['Copper 110', 5.60, 'Copper alloys'],
];
const wsRates = sheet([
  [LINK('⚡ QuoteFoundry — suggested rates & research sources', SITE)],
  [S('Starting points, not live market data — verify against the sources below and your own shop.')],
  [],
  ['MATERIAL — reference $/lb by alloy (adjust to your supplier quotes)'],
  ['Alloy', 'Reference $/lb', 'Category'],
  ...MAT.map(([n, p, c]) => [S(n), N(p, cur), S(c)]),
  ['Sources:', LINK('MetalMiner — carbon steel prices', 'https://agmetalminer.com/metal-prices/carbon-steel/')],
  ['', LINK('Material Price Book', 'https://www.materialpricebook.com/prices')],
  [],
  ['LABOR — start from the regional wage, then adjust'],
  ['Your billed $/hr is NOT the wage. Multiply the wage by your shop’s overhead burden and utilization.'],
  ['Sources:', LINK('BLS wages — Welders (51-4121)', 'https://www.bls.gov/oes/current/oes514121.htm')],
  ['', LINK('BLS wages — Machinists (51-4041)', 'https://www.bls.gov/oes/current/oes514041.htm')],
  [],
  ['Regional presets scale a national baseline: West Coast ~1.18×, Northeast ~1.12×, Great Lakes ~1.04×, National 1.00×, Gulf/South ~0.97×, Mountain/Plains ~0.95×.'],
], {
  cols: [{ wch: 40 }, { wch: 18 }, { wch: 16 }],
  merges: ['A1:C1', 'A2:C2', 'A4:C4', 'A10:C10', 'A11:C11', 'A16:C16'],
});

// --- assemble & write -------------------------------------------------------
const wb = XLSX.utils.book_new();
wb.Props = { Title: 'Metal Fabrication & Machining Job Calculator', Author: 'QuoteFoundry', Company: 'QuoteFoundry', Subject: 'Free fab/machining pricing calculator spreadsheet' };
XLSX.utils.book_append_sheet(wb, wsCalc, 'Calculator');
XLSX.utils.book_append_sheet(wb, wsFab, 'Fab example');
XLSX.utils.book_append_sheet(wb, wsRates, 'Rates & sources');
writeFileSync(OUT, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log(`Wrote ${OUT}`);
console.log(`  Calculator: price/part $${pricePart.toFixed(2)} @ qty ${i.qty}; breaks $${((varpp + onetime / 1) * 1.18 * 1.30).toFixed(2)} (×1) → $${((varpp + onetime / 100) * 1.18 * 1.30).toFixed(2)} (×100)`);
