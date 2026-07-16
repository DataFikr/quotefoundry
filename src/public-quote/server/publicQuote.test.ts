// @vitest-environment node
// ============================================================================
// publicQuote.test.ts — the public quote link gate.
// Locks the two properties the feature must never lose:
//   1. §4.4 margin hiding — the customer payload is an explicit allowlist:
//      margin, overhead, bare cost, engine line breakdown, rate_snapshot and
//      internal notes are absent from the ENTIRE serialized payload (the same
//      denylist discipline as pdf.test.ts, applied to JSON instead of PDF text).
//   2. §4.5-style status invariants — a customer response only advances
//      sent/opened → won/lost; existing outcomes are final; drafts and bad
//      tokens are indistinguishable (no oracle).
// Uses the canonical $1,913.82 job (CLAUDE.md §4.3) so the numbers cross-check
// the engine test: material 234.60, labor 810, burn 70, cons 48, outside 85,
// cost 1247.60, overhead 224.57, margin 441.65.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  isValidToken,
  rowToInputs,
  buildPublicPayload,
  respondTransition,
} from './publicQuote';

// The canonical quotes ROW as it comes back from the DB (strings for numerics,
// snake_case, snapshot frozen at the §4.3 rates).
const SNAPSHOT = {
  rate_cutting: 75, rate_fitting: 80, rate_welding: 90, rate_finishing: 65,
  rate_burn: 120, price_steel: 0.85, scrap_pct: 15, rate_consumables: 12,
  overhead_pct: 18, margin_pct: 30,
};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'q-1', shop_id: 'shop-a', quote_number: 'Q-2026-051',
  customer_name: 'Apex Industrial', customer_email: 'purchasing@apex.com',
  job_name: 'Stair stringers', part_number: 'SS-104', material_spec: 'A36 steel',
  material_weight: '240', material_lines: null, quantity: 1,
  burn_minutes: '35', hrs_cutting: '1.5', hrs_fitting: '3', hrs_welding: '4', hrs_finishing: '1.5',
  outside_services: '85', finish_spec: 'primer + topcoat', lead_time: '2-3 weeks',
  notes: 'INTERNAL: customer is price-sensitive, we padded finishing',
  rate_snapshot: SNAPSHOT, pdf_style: 'modern',
  status: 'sent', decided_at: null, created_at: '2026-07-10T12:00:00Z',
  public_token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  total_cost: '1247.60', total_overhead: '224.57', total_margin: '441.65', quoted_price: '1913.82',
  ...over,
});
const shop = { name: 'Ironside Fabrication', logo_url: 'data:image/png;base64,x' };

describe('buildPublicPayload — customer-safe allowlist (§4.4)', () => {
  it('shows scope + total from the frozen snapshot', () => {
    const p = buildPublicPayload(row(), shop)!;
    expect(p).not.toBeNull();
    expect(p.total).toBeCloseTo(1913.82, 2);
    expect(p.quote_number).toBe('Q-2026-051');
    expect(p.state).toBe('open');
    const labels = p.lines.map((l) => l.label);
    expect(labels).toContain('Material');
    expect(labels).toContain('Fabrication labor & machine time'); // grouped, not itemized
    expect(labels).toContain('Outside services');
    expect(p.subtotal + p.fees).toBeCloseTo(p.total, 2);
    expect(p.shop.name).toBe('Ironside Fabrication');
  });

  it('NEVER leaks internal economics — labels, keys or amounts', () => {
    const s = JSON.stringify(buildPublicPayload(row(), shop));
    // internal labels/keys are structurally absent from the whole payload
    expect(s).not.toMatch(/margin/i);
    expect(s).not.toMatch(/overhead/i);
    expect(s).not.toMatch(/snapshot/i);
    expect(s).not.toMatch(/total_cost/i);
    expect(s).not.toMatch(/line_(material|labor|burn|consumables|outside)/i); // engine breakdown
    expect(s).not.toMatch(/rate_/i);                    // any snapshot rate key
    // the profit split's canonical amounts. (The customer Subtotal — sum of the
    // visible scope lines — numerically equals shop cost BY CONSTRUCTION, and
    // the PDF prints the same subtotal; that is the approved §4.4 shape. What
    // must stay hidden is the SPLIT: margin and overhead never appear — only
    // their sum, folded into one neutral fees number.)
    expect(s).not.toContain('441.65');  // margin — never individually
    expect(s).not.toContain('224.57');  // overhead — never individually
    expect(buildPublicPayload(row(), shop)!.fees).toBeCloseTo(224.57 + 441.65, 2); // one opaque fold
    // estimator's private notes stay in the shop
    expect(s).not.toMatch(/INTERNAL/);
    expect(s).not.toMatch(/notes/i);
    // and the token itself is not echoed back into the page payload
    expect(s).not.toContain('aaaaaaaa-bbbb');
  });

  it('is a draft/missing oracle-free null', () => {
    expect(buildPublicPayload(row({ status: 'draft' }), shop)).toBeNull();
    expect(buildPublicPayload(null, shop)).toBeNull();
  });

  it('maps lifecycle → customer state (won stays accepted, lost stays declined)', () => {
    expect(buildPublicPayload(row({ status: 'sent' }), shop)!.state).toBe('open');
    expect(buildPublicPayload(row({ status: 'opened' }), shop)!.state).toBe('open');
    const won = buildPublicPayload(row({ status: 'won', decided_at: '2026-07-12T08:00:00Z' }), shop)!;
    expect(won.state).toBe('accepted');
    expect(won.responded_at).toBe('2026-07-12T08:00:00Z');
    expect(buildPublicPayload(row({ status: 'lost' }), shop)!.state).toBe('declined');
  });
});

describe('respondTransition — status invariants (mirrors §4.5)', () => {
  it('advances sent/opened on accept → won, decline → lost', () => {
    for (const from of ['sent', 'opened']) {
      const a = respondTransition(from, 'accept');
      expect(a).toMatchObject({ kind: 'transition', next: 'won', event: 'won' });
      const d = respondTransition(from, 'decline');
      expect(d).toMatchObject({ kind: 'transition', next: 'lost', event: 'lost' });
    }
  });

  it('NEVER overrides an existing outcome — won/lost are final', () => {
    expect(respondTransition('won', 'decline')).toEqual({ kind: 'already', state: 'accepted' });
    expect(respondTransition('won', 'accept')).toEqual({ kind: 'already', state: 'accepted' });
    expect(respondTransition('lost', 'accept')).toEqual({ kind: 'already', state: 'declined' });
    expect(respondTransition('lost', 'decline')).toEqual({ kind: 'already', state: 'declined' });
  });

  it('rejects drafts, unknown statuses and bogus actions (no oracle)', () => {
    expect(respondTransition('draft', 'accept')).toEqual({ kind: 'notFound' });
    expect(respondTransition('???', 'accept')).toEqual({ kind: 'notFound' });
    expect(respondTransition('sent', 'delete' as any)).toEqual({ kind: 'notFound' });
  });
});

describe('isValidToken — adversarial input never reaches the DB', () => {
  it('accepts only uuid-shaped tokens', () => {
    expect(isValidToken('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')).toBe(true);
    expect(isValidToken('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')).toBe(true);
  });
  it('rejects everything else', () => {
    for (const bad of [
      '', 'abc', 'aaaaaaaa-bbbb-4ccc-8ddd', // absent / short
      "' OR 1=1 --", '../../etc/passwd',    // injection shapes
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee ', // trailing space
      42, null, undefined, ['a'],           // non-strings
    ]) expect(isValidToken(bad as any)).toBe(false);
  });
});

describe('rowToInputs — the one shared hydration', () => {
  it('keeps material_lines when present, drops empty to undefined', () => {
    const withLines = rowToInputs(row({ material_lines: [{ type: 'A36 Steel', weight: 10, qty: 2 }] }));
    expect(withLines.material_lines).toHaveLength(1);
    expect(rowToInputs(row({ material_lines: [] })).material_lines).toBeUndefined();
    expect(rowToInputs(row()).material_lines).toBeUndefined();
  });
  it('coerces numeric strings (Postgres numerics arrive as text)', () => {
    const i = rowToInputs(row());
    expect(i.material_weight).toBe(240);
    expect(i.burn_minutes).toBe(35);
    expect(i.hrs_welding).toBe(4);
  });
});
