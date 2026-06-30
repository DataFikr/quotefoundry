// ============================================================================
// PipelineHome.tsx — the screen the estimator lands on
// ----------------------------------------------------------------------------
// Wired to quoteService.list({ status, search }). RLS scopes to the shop, so
// this just renders whatever the service returns. Status filter + search are
// passed through to the service (server-side filtering keeps it fast at scale).
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { quoteService } from '../services/quoteService';
import type { Quote, QuoteStatus } from '../lib/types';

const STATUS_FILTERS: Array<{ key: QuoteStatus | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'opened', label: 'Opened' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

const money = (n: number) => '$' + n.toLocaleString();

export function PipelineHome({
  onOpenQuote,
  onNewQuote,
  onCloneQuote,
}: {
  onOpenQuote: (id: string) => void;
  onNewQuote: () => void;
  onCloneQuote: (id: string) => void;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuoteStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  // Reload whenever filter or search changes. Debounce search in production.
  const load = useCallback(async () => {
    setLoading(true);
    const res = await quoteService.list({
      status: filter === 'all' ? undefined : filter,
      search: search.trim() || undefined,
    });
    if (res.error) setError(res.error);
    else { setQuotes(res.data!); setError(null); }
    setLoading(false);
  }, [filter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="ph">
      <div className="ph-controls">
        <input
          className="ph-search"
          placeholder="Search by job, customer, or quote #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="ph-new" onClick={onNewQuote}>New quote</button>
      </div>

      <div className="ph-filters">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`ph-fil ${filter === f.key ? 'on' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="ph-error">Couldn't load quotes: {error}</div>}
      {loading && <div className="ph-loading">Loading quotes…</div>}

      {!loading && !error && quotes.length === 0 && (
        <div className="ph-empty">
          No quotes yet. Click <b>New quote</b> to build your first one.
        </div>
      )}

      {!loading && quotes.length > 0 && (
        <div className="ph-list">
          {quotes.map((q) => (
            <div key={q.id} className="ph-row" onClick={() => onOpenQuote(q.id)}>
              <div className="ph-job">{q.inputs.job_name}<small>{q.quote_number}</small></div>
              <div className="ph-cust">{q.customer_name ?? '—'}</div>
              <div className="ph-amt">{money(q.quoted_price)}</div>
              <div className={`ph-st ph-st--${q.status}`}>{q.status}</div>
              <button
                className="ph-clone"
                onClick={(e) => { e.stopPropagation(); onCloneQuote(q.id); }}
              >Clone</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
