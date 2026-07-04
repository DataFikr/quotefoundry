// ============================================================================
// customerScope.ts — the customer-facing grouping, mirroring the PDF's
// buildScopeLines (pdf-generation/src/generateQuotePdf.mjs). Internal economics
// (cost / overhead / margin) are NEVER part of this — the remainder to the
// quoted price is folded into one neutral "Shop fees & handling" line (§4.4).
// ============================================================================
import type { Quote } from '../data-access-layer/lib/types';

export interface ScopeLine { label: string; detail: string; amount: number }

export function customerScope(q: Quote): { lines: ScopeLine[]; subtotal: number; fees: number; total: number } {
  const t = q.totals;
  const lines: ScopeLine[] = [];

  if (t.line_material > 0) {
    // multi-material quotes list their distinct types; legacy quotes show the single spec
    const types = (q.inputs.material_lines ?? []).map((l) => l.type).filter(Boolean);
    const detail = types.length
      ? [...new Set(types)].join(', ')
      : q.inputs.material_spec || 'Steel + drop allowance';
    lines.push({ label: 'Material', detail, amount: t.line_material });
  }

  const fab = t.line_labor + t.line_burn + t.line_consumables;
  if (fab > 0)
    lines.push({ label: 'Fabrication labor & machine time', detail: 'cut, fit, weld, finish · incl. consumables', amount: fab });

  if (t.line_outside > 0)
    lines.push({ label: 'Outside services', detail: q.inputs.finish_spec || 'coating / finishing', amount: t.line_outside });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const fees = Math.max(0, t.quoted_price - subtotal);
  return { lines, subtotal, fees, total: t.quoted_price };
}
