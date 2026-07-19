// @vitest-environment node
// ============================================================================
// pipelineAnalytics.test.ts — locks the pipeline overview's three answers:
// how much is waiting on customers, am I winning, what needs chasing.
// Pure module, fixed `now`, so every number is deterministic.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { analyzePipeline, needsFollowUp, FOLLOW_UP_AGE_DAYS } from './pipelineAnalytics';
import type { Quote } from '../data-access-layer/lib/types';

const NOW = new Date('2026-07-17T12:00:00Z');

// Minimal quote factory — analytics only reads status/price/dates.
let n = 0;
function q(over: Partial<Quote>): Quote {
  n += 1;
  return {
    id: `q${n}`, quote_number: `Q-2026-${n}`, status: 'draft', quoted_price: 1000,
    rate_snapshot: {} as any, inputs: {} as any, totals: {} as any,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  } as Quote;
}

describe('analyzePipeline — the 3 numbers', () => {
  it('empty list → all zeroes, no NaN, 6 empty months', () => {
    const a = analyzePipeline([], NOW);
    expect(a.openValue).toBe(0);
    expect(a.wonDelta).toBeNull();
    expect(a.winRate.pct).toBe(0);
    expect(a.needsFollowUp).toBe(0);
    expect(a.monthly).toHaveLength(6);
    expect(a.monthly.every((m) => m.draft + m.open + m.won + m.lost === 0)).toBe(true);
    expect(JSON.stringify(a)).not.toContain('NaN');
  });

  it('open pipeline = sent+opened only; drafts counted separately', () => {
    const a = analyzePipeline([
      q({ status: 'draft', quoted_price: 999 }),
      q({ status: 'sent', quoted_price: 500 }),
      q({ status: 'opened', quoted_price: 300 }),
      q({ status: 'won', quoted_price: 800 }),
    ], NOW);
    expect(a.openValue).toBe(800);   // 500 + 300 — the draft's 999 is NOT waiting on a customer
    expect(a.openCount).toBe(2);
    expect(a.draftCount).toBe(1);
  });

  it('won this month buckets by decided_at, with % delta vs last month', () => {
    const a = analyzePipeline([
      q({ status: 'won', quoted_price: 3000, decided_at: '2026-07-10T00:00:00Z' }),
      q({ status: 'won', quoted_price: 2000, decided_at: '2026-06-20T00:00:00Z' }),
      q({ status: 'won', quoted_price: 5000, decided_at: '2026-01-05T00:00:00Z' }), // outside both months
    ], NOW);
    expect(a.wonThisMonth).toBe(3000);
    expect(a.wonLastMonth).toBe(2000);
    expect(a.wonDelta).toBe(50);      // (3000-2000)/2000
  });

  it('delta is null (not Infinity) when last month won nothing', () => {
    const a = analyzePipeline([q({ status: 'won', decided_at: '2026-07-10T00:00:00Z' })], NOW);
    expect(a.wonDelta).toBeNull();
  });

  it('needs follow-up = sent/opened aging past the threshold, from sent_at', () => {
    const fresh = q({ status: 'sent', sent_at: '2026-07-16T00:00:00Z' });    // 1 day
    const stale = q({ status: 'opened', sent_at: '2026-07-05T00:00:00Z' });  // 12 days
    const decided = q({ status: 'won', sent_at: '2026-06-01T00:00:00Z' });   // decided → never
    const a = analyzePipeline([fresh, stale, decided], NOW);
    expect(a.needsFollowUp).toBe(1);
    expect(a.oldestFollowUpDays).toBe(12);
    expect(needsFollowUp(fresh, NOW)).toBe(false);
    expect(needsFollowUp(stale, NOW)).toBe(true);
    expect(needsFollowUp(decided, NOW)).toBe(false);
    // exact threshold counts (>=)
    const at = q({ status: 'sent', sent_at: new Date(NOW.getTime() - FOLLOW_UP_AGE_DAYS * 86_400_000).toISOString() });
    expect(needsFollowUp(at, NOW)).toBe(true);
  });
});

describe('analyzePipeline — the 3 charts', () => {
  it('win rate splits counts and values', () => {
    const a = analyzePipeline([
      q({ status: 'won', quoted_price: 100 }),
      q({ status: 'won', quoted_price: 200 }),
      q({ status: 'lost', quoted_price: 900 }),
    ], NOW);
    expect(a.winRate).toEqual({ pct: 67, wonCount: 2, lostCount: 1, wonValue: 300, lostValue: 900 });
  });

  it('monthly buckets span a year boundary correctly (Feb..Jul from a July now)', () => {
    const a = analyzePipeline([
      q({ status: 'sent', quoted_price: 400, created_at: '2026-02-15T00:00:00Z' }),
      q({ status: 'won', quoted_price: 700, created_at: '2026-07-02T00:00:00Z' }),
      q({ status: 'lost', quoted_price: 50, created_at: '2025-12-31T00:00:00Z' }), // outside window
    ], NOW);
    expect(a.monthly.map((m) => m.key)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']);
    expect(a.monthly[0].open).toBe(400);
    expect(a.monthly[5].won).toBe(700);
    const total = a.monthly.reduce((s, m) => s + m.draft + m.open + m.won + m.lost, 0);
    expect(total).toBe(1100); // the 2025 quote fell out of the window
    // and the window itself crosses the year boundary from a January "now"
    const jan = analyzePipeline([], new Date('2026-01-15T00:00:00Z'));
    expect(jan.monthly.map((m) => m.key)).toEqual(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']);
  });

  it('funnel is monotonic: decided quotes imply sent AND opened', () => {
    const a = analyzePipeline([
      q({ status: 'won' }),                                  // no sent_at/opened_at recorded
      q({ status: 'lost' }),
      q({ status: 'sent', sent_at: '2026-07-16T00:00:00Z' }),
      q({ status: 'draft' }),
    ], NOW);
    expect(a.funnel.sent).toBe(3);      // won + lost + sent (draft excluded)
    expect(a.funnel.opened).toBe(2);    // won + lost imply the customer saw it
    expect(a.funnel.won).toBe(1);
    expect(a.funnel.sent).toBeGreaterThanOrEqual(a.funnel.opened);
    expect(a.funnel.opened).toBeGreaterThanOrEqual(a.funnel.won);
    expect(a.funnel.openedPct).toBe(67);
    expect(a.funnel.wonPct).toBe(50);
  });
});
