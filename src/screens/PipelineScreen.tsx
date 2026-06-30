// ============================================================================
// PipelineScreen.tsx — the landing screen. Stat cards + filterable/searchable
// quote list, styled to design/QuoteForge.dc.html, wired to quoteService.list.
// ============================================================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import { quoteService } from '../data-access-layer/services/quoteService';
import type { Quote, QuoteStatus } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { money, statusPill, heading, cardShadow, cardShadowLg } from '../app/ui';
import { useIsMobile } from '../app/useIsMobile';

const FILTERS: Array<{ key: QuoteStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

function StatCard({ label, value, foot, footColor }: { label: string; value: string; foot: string; footColor?: string }) {
  return (
    <div style={{ background: color.surface, borderRadius: 20, padding: '22px 24px', boxShadow: cardShadow }}>
      <div style={{ fontSize: 13, color: color.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 28, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12.5, color: footColor ?? color.muted, marginTop: 5, fontWeight: 600 }}>{foot}</div>
    </div>
  );
}

export function PipelineScreen({ onOpen, onNew, onRefresh }: { onOpen: (id: string) => void; onNew: () => void; onRefresh: () => void }) {
  const mobile = useIsMobile();
  const ROW_COLS = '2.4fr 1.7fr 1fr 1.1fr 1fr 44px';
  const [all, setAll] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await quoteService.list();
    if (res.data) setAll(res.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const openQ = all.filter((q) => ['draft', 'sent', 'opened'].includes(q.status));
    const won = all.filter((q) => q.status === 'won');
    const lost = all.filter((q) => q.status === 'lost');
    const openSum = openQ.reduce((a, q) => a + q.quoted_price, 0);
    const wonSum = won.reduce((a, q) => a + q.quoted_price, 0);
    const decided = won.length + lost.length;
    const avg = all.length ? all.reduce((a, q) => a + q.quoted_price, 0) / all.length : 0;
    return {
      openSum, openCount: openQ.length, wonSum, wonCount: won.length,
      winRate: decided ? Math.round((won.length / decided) * 100) : 0, avg,
    };
  }, [all]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all.filter((q) => {
      if (filter !== 'all' && q.status !== filter) return false;
      if (!term) return true;
      return [q.inputs.job_name, q.customer_name, q.quote_number]
        .some((v) => String(v ?? '').toLowerCase().includes(term));
    });
  }, [all, filter, search]);

  async function clone(id: string) {
    await quoteService.clone(id);
    onRefresh();
    load();
  }

  return (
    <div style={{ padding: mobile ? '18px 16px 40px' : '30px 34px 48px' }} data-screen="pipeline">
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: mobile ? 12 : 20, marginBottom: 26 }}>
        <StatCard label="Open pipeline" value={money(stats.openSum)} foot={`${stats.openCount} active quotes`} footColor={color.success} />
        <StatCard label="Won this month" value={money(stats.wonSum)} foot={`${stats.wonCount} jobs landed`} footColor={color.success} />
        <StatCard label="Win rate" value={`${stats.winRate}%`} foot="won vs. lost" />
        <StatCard label="Avg. quote" value={money(stats.avg)} foot="across all quotes" />
      </div>

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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, background: color.appBg, borderRadius: 12, padding: '0 14px', height: 42, width: 300, maxWidth: '38vw' }}>
            <i className="las la-search" style={{ color: '#B6B6CC', fontSize: 17 }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job, customer, or quote #"
              style={{ border: 'none', background: 'transparent', flex: 1, fontSize: 14, color: color.ink }} />
          </div>
        </div>

        {!mobile && (
          <div style={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 14, padding: '8px 22px', fontSize: 12, fontWeight: 700, color: color.faint, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            <div>Job / Quote #</div><div>Customer</div><div>Date</div><div style={{ textAlign: 'right' }}>Quoted</div><div>Status</div><div />
          </div>
        )}

        {loading && <div style={{ padding: 40, textAlign: 'center', color: color.muted }}>Loading quotes…</div>}

        {!loading && rows.map((q) => {
          const pill = statusPill(q.status);
          if (mobile) {
            // table → card on phones
            return (
              <div key={q.id} onClick={() => onOpen(q.id)} data-row={q.quote_number} data-row-mobile
                style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16, margin: '8px 0', borderRadius: 16, border: `1px solid ${color.border}`, cursor: 'pointer', minHeight: 44 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: 'rgba(94,129,244,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 18 }}><i className="las la-drafting-compass" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.inputs.job_name}</div>
                    <div style={{ fontSize: 12.5, color: color.muted }}>{q.quote_number} · {q.customer_name ?? '—'}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); clone(q.id); }} title="Clone" style={{ width: 40, height: 40, border: 'none', borderRadius: 11, background: color.appBg, color: color.muted, cursor: 'pointer', fontSize: 16 }}><i className="las la-copy" /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: heading, background: pill.bg, color: pill.color }}>{pill.label}</span>
                  <span style={{ fontFamily: heading, fontWeight: 700, fontSize: 17 }}>{money(q.quoted_price)}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={q.id} onClick={() => onOpen(q.id)} data-row={q.quote_number}
              style={{ display: 'grid', gridTemplateColumns: ROW_COLS, gap: 14, alignItems: 'center', padding: '14px 22px', margin: '4px 0', borderRadius: 16, cursor: 'pointer', border: '1px solid transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                <div style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, background: 'rgba(94,129,244,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.accentDeep, fontSize: 19 }}>
                  <i className="las la-drafting-compass" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.inputs.job_name}</div>
                  <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>{q.quote_number}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, color: color.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.customer_name ?? '—'}</div>
              <div style={{ fontSize: 13.5, color: color.muted }} data-mask>{new Date(q.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, textAlign: 'right' }}>{money(q.quoted_price)}</div>
              <div><span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: heading, background: pill.bg, color: pill.color }}>{pill.label}</span></div>
              <button onClick={(e) => { e.stopPropagation(); clone(q.id); }} title="Clone"
                style={{ width: 36, height: 36, border: 'none', borderRadius: 11, background: color.appBg, color: color.muted, cursor: 'pointer', fontSize: 15 }}>
                <i className="las la-copy" />
              </button>
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
