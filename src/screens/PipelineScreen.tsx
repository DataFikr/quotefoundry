// ============================================================================
// PipelineScreen.tsx — the landing screen. Stat cards + filterable/searchable
// quote list, styled to design/QuoteFoundry.dc.html, wired to quoteService.list.
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import type { Quote, QuoteStatus } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money, statusPill, heading, cardShadow, cardShadowLg } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';
import { analyzePipeline, needsFollowUp } from '../app/pipelineAnalytics';
import { Donut, StackedBars, Funnel } from '../app/charts';
import { ScrollCarousel } from '../app/ScrollCarousel';
import type { ToastData } from '../app/Toast';

// 'followup' is a pseudo-filter: sent/opened quotes aging past the follow-up
// threshold (same predicate as the stat card, so the two can never disagree).
type Filter = QuoteStatus | 'all' | 'followup';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'followup', label: 'Needs follow-up' },
];

// Short date like "Jul 3"; em-dash when the timestamp is absent (e.g. never sent).
function shortDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Whole days between a sent timestamp and now. '—' when never sent.
function daysSince(iso?: string) {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'today' : `${days}d`;
}

function StatCard({ label, value, foot, footColor, onClick, testId, mobile }: {
  label: string; value: string; foot: string; footColor?: string; onClick?: () => void; testId?: string; mobile?: boolean;
}) {
  // Mobile: compact so all three cards fit on one row (smaller padding + type,
  // tighter foot line-height for the wrapped helper text).
  return (
    <div onClick={onClick} data-testid={testId}
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ background: color.surface, borderRadius: mobile ? 15 : 20, padding: mobile ? '12px 11px' : '22px 24px', boxShadow: cardShadow, cursor: onClick ? 'pointer' : 'default', ...(mobile ? { minWidth: 0 } : {}) }}>
      <div style={{ fontSize: mobile ? 10.5 : 13, color: color.muted, fontWeight: 600, ...(mobile ? { lineHeight: 1.25 } : {}) }}>{label}</div>
      <div style={{ fontFamily: heading, fontWeight: 700, fontSize: mobile ? 18 : 28, marginTop: mobile ? 3 : 6, ...(mobile ? { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}>{value}</div>
      <div style={{ fontSize: mobile ? 10 : 12.5, color: footColor ?? color.muted, marginTop: mobile ? 3 : 5, fontWeight: 600, ...(mobile ? { lineHeight: 1.3 } : {}) }}>{foot}</div>
    </div>
  );
}

// White card wrapper for one chart (title in the small-caps style the rates
// screen uses for section labels).
function ChartCard({ title, children, mobile, testId }: { title: string; children: React.ReactNode; mobile: boolean; testId: string }) {
  return (
    <div data-testid={testId} style={{ background: color.surface, borderRadius: 20, padding: '18px 22px 16px', boxShadow: cardShadow, ...(mobile ? { minWidth: 292, scrollSnapAlign: 'start', flex: 'none' } : {}) }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

export function PipelineScreen({ onOpen, onNew, onRefresh, notify }: { onOpen: (id: string) => void; onNew: () => void; onRefresh: () => void; notify?: (t: ToastData) => void }) {
  const mobile = useIsMobile();
  const ROW_COLS = '2.2fr 1.4fr .8fr .8fr .9fr 1fr 1fr 86px';
  const [all, setAll] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // quote id armed for delete

  const load = useCallback(async () => {
    setLoading(true);
    const res = await quoteService.list();
    if (res.data) setAll(res.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => analyzePipeline(all), [all]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((q) => {
      if (filter === 'followup') { if (!needsFollowUp(q)) return false; }
      else if (filter !== 'all' && q.status !== filter) return false;
      if (!term) return true;
      return [q.inputs.job_name, q.customer_name, q.quote_number]
        .some((v) => String(v ?? '').toLowerCase().includes(term));
    });
  }, [all, filter, search]);

  async function clone(id: string) {
    const res = await quoteService.clone(id);
    onRefresh();
    load();
    notify?.({ message: res.error ? res.error : `Cloned as ${res.data?.quote_number ?? 'a new draft'}.` });
  }

  // Drafts only (the service enforces it too). Two-step confirm, same pattern
  // as customer delete: first tap arms the button, second tap deletes.
  async function removeQuote(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete((v) => (v === id ? null : v)), 3500);
      return;
    }
    setConfirmDelete(null);
    const res = await quoteService.remove(id);
    onRefresh();
    load();
    notify?.({ message: res.error ? res.error : 'Draft deleted.' });
  }

  const deleteBtn = (q: Quote, size: number) =>
    q.status === 'draft' ? (
      <button onClick={(e) => { e.stopPropagation(); removeQuote(q.id); }} data-testid="delete-quote"
        title={confirmDelete === q.id ? 'Click again to delete this draft' : 'Delete draft'}
        aria-label={confirmDelete === q.id ? `Confirm delete ${q.quote_number}` : `Delete draft ${q.quote_number}`}
        style={{ width: size, height: size, border: 'none', borderRadius: 11, background: confirmDelete === q.id ? color.danger : '#FFEFF1', color: confirmDelete === q.id ? '#fff' : color.danger, cursor: 'pointer', fontSize: size > 38 ? 16 : 15 }}>
        <i className={confirmDelete === q.id ? 'las la-exclamation' : 'las la-trash'} />
      </button>
    ) : null;

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '30px 34px 48px' }} data-screen="pipeline">
      {/* THE 3 NUMBERS — how much is waiting, am I winning, what needs chasing.
          All three share one row (3-up) on both phone and desktop. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: mobile ? 10 : 20, marginBottom: mobile ? 14 : 20 }}>
        <StatCard mobile={mobile} testId="stat-open" label="Open pipeline" value={money(stats.openValue)}
          foot={`${stats.openCount} waiting on customers${stats.draftCount ? ` · ${stats.draftCount} draft${stats.draftCount === 1 ? '' : 's'} to finish` : ''}`}
          footColor={color.success} />
        <StatCard mobile={mobile} testId="stat-won" label="Won this month" value={money(stats.wonThisMonth)}
          foot={stats.wonDelta != null
            ? `${stats.wonDelta >= 0 ? '▲' : '▼'} ${Math.abs(stats.wonDelta)}% vs last month`
            : `${stats.wonThisMonthCount} job${stats.wonThisMonthCount === 1 ? '' : 's'} landed`}
          footColor={stats.wonDelta != null && stats.wonDelta < 0 ? color.danger : color.success} />
        <StatCard mobile={mobile} testId="stat-followup" label="Needs follow-up" value={String(stats.needsFollowUp)}
          foot={stats.needsFollowUp
            ? `oldest waiting ${stats.oldestFollowUpDays} day${stats.oldestFollowUpDays === 1 ? '' : 's'} — tap to see them`
            : 'nothing going stale — nice'}
          footColor={stats.needsFollowUp ? color.danger : color.success}
          onClick={() => setFilter(filter === 'followup' ? 'all' : 'followup')} />
      </div>

      {/* THE 3 CHARTS — win-rate donut · monthly value · sent→opened→won funnel.
          Desktop: 3-up grid. Mobile: swipeable row with side arrows (no visible
          scrollbar) so the quote list stays one thumb-scroll away. */}
      {(() => {
        const cards = (
          <>
            <ChartCard title="Win rate" mobile={mobile} testId="chart-donut">
              <Donut {...stats.winRate} />
            </ChartCard>
            <ChartCard title="Quoted per month" mobile={mobile} testId="chart-monthly">
              <StackedBars months={stats.monthly} />
            </ChartCard>
            <ChartCard title="Where quotes go" mobile={mobile} testId="chart-funnel">
              <Funnel {...stats.funnel} />
            </ChartCard>
          </>
        );
        return mobile ? (
          <div style={{ marginBottom: 18 }}>
            <ScrollCarousel gap={12} bleed={16} testId="chart-scroller">{cards}</ScrollCarousel>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 26 }}>{cards}</div>
        );
      })()}

      <div style={{ background: color.surface, borderRadius: 22, padding: '10px 12px 16px', boxShadow: cardShadowLg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px 14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: color.appBg, borderRadius: 13, padding: 4, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button key={f.key} onClick={() => setFilter(f.key)} data-filter={f.key}
                  style={{ border: 'none', borderRadius: 10, padding: '9px 16px', fontFamily: heading, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', background: on ? color.surface : 'transparent', color: on ? color.ink : color.muted, boxShadow: on ? '0 6px 14px -8px rgba(60,60,120,.5)' : 'none' }}>
                  {f.label}
                </button>
              );
            })}
          </div>
          {/* Mobile: search takes its own full-width line (the row wraps) so the
              placeholder never truncates. Desktop: fixed 300px, right-aligned. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: color.appBg, borderRadius: 12, padding: '0 14px', height: 42,
            ...(mobile
              ? { flex: '1 1 100%', width: '100%', order: -1 }
              : { marginLeft: 'auto', width: 300, maxWidth: '38vw' }) }}>
            <i className="las la-search" style={{ color: '#B6B6CC', fontSize: 17, flex: 'none' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer, or quote #"
              style={{ border: 'none', background: 'transparent', flex: 1, minWidth: 0, fontSize: 14, color: color.ink }} />
          </div>
        </div>

        {!mobile && (
          <div style={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 14, padding: '8px 22px', fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            <div>Job / Quote #</div><div>Customer</div><div>Created</div><div>Sent</div><div>Since sent</div><div style={{ textAlign: 'right' }}>Quoted</div><div>Status</div><div />
          </div>
        )}

        {loading && <div style={{ padding: 40, textAlign: 'center', color: color.muted }}>Loading quotes…</div>}

        {!loading && rows.map((q) => {
          const pill = statusPill(q.status);
          if (mobile) {
            // table → card on phones
            return (
              <div key={q.id} onClick={() => onOpen(q.id)} data-row={q.quote_number} data-row-mobile
                role="button" tabIndex={0} aria-label={`Open quote ${q.quote_number} — ${q.inputs.job_name}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q.id); } }}
                style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, margin: '8px 0', borderRadius: 16, border: `1px solid ${color.border}`, cursor: 'pointer', minHeight: 44 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'rgba(70,103,219,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 18 }}><i className="las la-drafting-compass" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.inputs.job_name}</div>
                    <div style={{ fontSize: 12.5, color: color.muted }}>{q.quote_number} · {q.customer_name ?? '—'}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); clone(q.id); }} title="Clone" style={{ width: 40, height: 40, border: 'none', borderRadius: 11, background: color.appBg, color: color.muted, cursor: 'pointer', fontSize: 16 }}><i className="las la-copy" /></button>
                  {deleteBtn(q, 40)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: heading, background: pill.bg, color: pill.color }}>{pill.label}</span>
                  <span style={{ fontFamily: heading, fontWeight: 700, fontSize: 17 }}>{money(q.quoted_price)}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: color.muted, flexWrap: 'wrap' }} data-mask>
                  <span>Created {shortDate(q.created_at)}</span>
                  <span>Sent {shortDate(q.sent_at)}</span>
                  {q.sent_at && <span style={{ color: needsFollowUp(q) ? color.danger : color.muted, fontWeight: needsFollowUp(q) ? 700 : 400 }}>{daysSince(q.sent_at)} since sent</span>}
                </div>
              </div>
            );
          }
          return (
            <div key={q.id} onClick={() => onOpen(q.id)} data-row={q.quote_number}
              role="button" tabIndex={0} aria-label={`Open quote ${q.quote_number} — ${q.inputs.job_name}`}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q.id); } }}
              style={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 14, alignItems: 'center', padding: '14px 22px', margin: '4px 0', borderRadius: 16, cursor: 'pointer', border: '1px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, background: 'rgba(70,103,219,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 19 }}>
                  <i className="las la-drafting-compass" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.inputs.job_name}</div>
                  <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>{q.quote_number}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.customer_name ?? '—'}</div>
              <div style={{ fontSize: 13.5, color: color.muted }} data-mask>{shortDate(q.created_at)}</div>
              <div style={{ fontSize: 13.5, color: color.muted }} data-mask>{shortDate(q.sent_at)}</div>
              <div style={{ fontSize: 13.5, color: needsFollowUp(q) ? color.danger : color.muted, fontWeight: needsFollowUp(q) ? 700 : 400 }} data-mask>{daysSince(q.sent_at)}</div>
              <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, textAlign: 'right' }}>{money(q.quoted_price)}</div>
              <div><span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: heading, background: pill.bg, color: pill.color }}>{pill.label}</span></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={(e) => { e.stopPropagation(); clone(q.id); }} title="Clone"
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 11, background: color.appBg, color: color.muted, cursor: 'pointer', fontSize: 15 }}>
                  <i className="las la-copy" />
                </button>
                {deleteBtn(q, 36)}
              </div>
            </div>
          );
        })}

        {!loading && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: color.muted }}>
            <i className="las la-folder-open" style={{ fontSize: 40, color: '#D6D6E6' }} />
            <div style={{ marginTop: 14, fontFamily: heading, fontWeight: 700, fontSize: 16, color: color.body }}>No quotes here</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>Try a different filter, or <span onClick={onNew} style={{ color: color.accentDeep, cursor: 'pointer', fontWeight: 700 }}>start a new quote</span>.</div>
          </div>
        )}
      </div>
    </div>
  );
}
