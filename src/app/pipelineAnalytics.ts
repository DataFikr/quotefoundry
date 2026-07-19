// ============================================================================
// pipelineAnalytics.ts — pure compute for the pipeline overview.
// ----------------------------------------------------------------------------
// Same philosophy as quoteEngine: no I/O, no dates read implicitly (now is a
// parameter), trivially Vitest-testable. The screen renders EXACTLY what this
// returns, so the three glance-questions — how much is waiting on customers,
// am I winning, what needs chasing — are locked by tests, not by eyeballing.
// All bucketing is UTC (quote timestamps are ISO strings from Postgres).
// ============================================================================
import type { Quote } from '../data-access-layer/lib/types';

export const FOLLOW_UP_AGE_DAYS = 4; // sent/opened older than this = chase it

export interface MonthBucket {
  key: string;    // '2026-07'
  label: string;  // 'Jul'
  draft: number;  // $ value created this month, still draft
  open: number;   // $ sent+opened
  won: number;    // $ won
  lost: number;   // $ lost
}

export interface PipelineAnalytics {
  // numbers
  openValue: number;      // $ sent+opened — waiting on customers
  openCount: number;
  draftCount: number;     // drafts are on the shop, not the customer
  wonThisMonth: number;   // $ decided (won) this calendar month
  wonThisMonthCount: number;
  wonLastMonth: number;
  wonDelta: number | null; // % vs last month; null when last month is 0 (no honest %)
  needsFollowUp: number;  // sent/opened ≥ FOLLOW_UP_AGE_DAYS with no decision
  oldestFollowUpDays: number;
  // charts
  winRate: { pct: number; wonCount: number; lostCount: number; wonValue: number; lostValue: number };
  monthly: MonthBucket[]; // oldest → newest, always 6 entries
  funnel: { sent: number; opened: number; won: number; openedPct: number; wonPct: number };
}

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// The month a decision belongs to: decided_at when recorded, else created_at
// (older rows from before decided_at was hydrated) — never "now".
const decidedDate = (q: Quote) => new Date(q.decided_at ?? q.created_at);

export function analyzePipeline(quotes: Quote[], now: Date = new Date()): PipelineAnalytics {
  const open = quotes.filter((q) => q.status === 'sent' || q.status === 'opened');
  const drafts = quotes.filter((q) => q.status === 'draft');
  const won = quotes.filter((q) => q.status === 'won');
  const lost = quotes.filter((q) => q.status === 'lost');
  const sum = (list: Quote[]) => list.reduce((a, q) => a + q.quoted_price, 0);

  // -- won this month vs last (calendar months, UTC) --------------------------
  const thisKey = monthKey(now);
  const lastMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastKey = monthKey(lastMonthDate);
  const wonThis = won.filter((q) => monthKey(decidedDate(q)) === thisKey);
  const wonLast = won.filter((q) => monthKey(decidedDate(q)) === lastKey);
  const wonThisMonth = sum(wonThis);
  const wonLastMonth = sum(wonLast);
  const wonDelta = wonLastMonth > 0
    ? Math.round(((wonThisMonth - wonLastMonth) / wonLastMonth) * 100)
    : null;

  // -- follow-up aging --------------------------------------------------------
  const ageDays = (q: Quote) => {
    const since = q.sent_at ?? q.created_at;
    return Math.floor((now.getTime() - new Date(since).getTime()) / DAY_MS);
  };
  const stale = open.filter((q) => ageDays(q) >= FOLLOW_UP_AGE_DAYS);
  const oldestFollowUpDays = stale.reduce((m, q) => Math.max(m, ageDays(q)), 0);

  // -- win rate ---------------------------------------------------------------
  const decided = won.length + lost.length;
  const winRate = {
    pct: decided ? Math.round((won.length / decided) * 100) : 0,
    wonCount: won.length,
    lostCount: lost.length,
    wonValue: sum(won),
    lostValue: sum(lost),
  };

  // -- monthly stacked buckets (last 6 calendar months, by created_at) --------
  const monthly: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    monthly.push({ key: monthKey(d), label: MONTHS[d.getUTCMonth()], draft: 0, open: 0, won: 0, lost: 0 });
  }
  const byKey = new Map(monthly.map((m) => [m.key, m]));
  for (const q of quotes) {
    const bucket = byKey.get(monthKey(new Date(q.created_at)));
    if (!bucket) continue; // older than the window
    if (q.status === 'draft') bucket.draft += q.quoted_price;
    else if (q.status === 'won') bucket.won += q.quoted_price;
    else if (q.status === 'lost') bucket.lost += q.quoted_price;
    else bucket.open += q.quoted_price;
  }

  // -- funnel (monotonic by construction) -------------------------------------
  // "ever sent" = has sent_at OR is past draft; "ever opened" = has opened_at
  // OR is decided (a customer decision implies the quote reached them).
  const everSent = quotes.filter((q) => q.sent_at != null || q.status !== 'draft').length;
  const everOpened = quotes.filter(
    (q) => q.opened_at != null || q.status === 'opened' || q.status === 'won' || q.status === 'lost'
  ).length;
  const funnel = {
    sent: everSent,
    opened: everOpened,
    won: won.length,
    openedPct: everSent ? Math.round((everOpened / everSent) * 100) : 0,
    wonPct: everOpened ? Math.round((won.length / everOpened) * 100) : 0,
  };

  return {
    openValue: sum(open),
    openCount: open.length,
    draftCount: drafts.length,
    wonThisMonth,
    wonThisMonthCount: wonThis.length,
    wonLastMonth,
    wonDelta,
    needsFollowUp: stale.length,
    oldestFollowUpDays,
    winRate,
    monthly,
    funnel,
  };
}

// The follow-up list predicate, shared with the screen's 'followup' filter so
// the card's count and the filtered rows can never disagree.
export function needsFollowUp(q: Quote, now: Date = new Date()): boolean {
  if (q.status !== 'sent' && q.status !== 'opened') return false;
  const since = q.sent_at ?? q.created_at;
  return (now.getTime() - new Date(since).getTime()) / DAY_MS >= FOLLOW_UP_AGE_DAYS;
}
