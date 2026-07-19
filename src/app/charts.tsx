// ============================================================================
// charts.tsx — tiny hand-rolled SVG charts for the pipeline overview.
// ----------------------------------------------------------------------------
// Deliberately NOT a chart library (bundle diet; repo style is inline-styled
// components). Each chart is dumb: it renders exactly the numbers from
// pipelineAnalytics.ts, and shows a friendly empty state when there's nothing
// to draw — a fresh design-partner shop must never see a broken-looking chart.
// ============================================================================
import { useState } from 'react';
import { color } from '../design/tokens';
import { heading } from './ui';
import type { MonthBucket } from './pipelineAnalytics';

const money0 = (n: number) =>
  '$' + Math.round(n).toLocaleString();

// "Nice" axis: round the max up to a clean step so gridlines land on round
// dollar values (2000/4000/6000…) instead of an arbitrary top-of-bar number.
function niceTicks(max: number, target = 3): { niceMax: number; ticks: number[] } {
  if (max <= 0) return { niceMax: 0, ticks: [] };
  const rawStep = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = step; t <= niceMax + 1e-6; t += step) ticks.push(Math.round(t));
  return { niceMax, ticks };
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 132, color: color.faint, textAlign: 'center', padding: '0 12px' }}>
      <i className="las la-chart-line" style={{ fontSize: 26, marginBottom: 8 }} />
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut — win rate. Ring: won (success) vs lost (danger); % in the center.
// ---------------------------------------------------------------------------
export function Donut({ pct, wonCount, lostCount, wonValue, lostValue }: {
  pct: number; wonCount: number; lostCount: number; wonValue: number; lostValue: number;
}) {
  const decided = wonCount + lostCount;
  if (decided === 0) return <EmptyState text="Win rate appears once your first quotes are marked won or lost." />;

  const R = 52, C = 2 * Math.PI * R;
  const wonFrac = wonCount / decided;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, minHeight: 132 }}>
      <svg width={132} height={132} viewBox="0 0 132 132" role="img" aria-label={`Win rate ${pct} percent`}>
        <circle cx={66} cy={66} r={R} fill="none" stroke="#FFEFF1" strokeWidth={16} />
        <circle
          cx={66} cy={66} r={R} fill="none" stroke={color.success} strokeWidth={16}
          strokeDasharray={`${C * wonFrac} ${C}`} strokeLinecap={wonFrac > 0 && wonFrac < 1 ? 'round' : 'butt'}
          transform="rotate(-90 66 66)"
        />
        <text x={66} y={62} textAnchor="middle" style={{ fontFamily: heading, fontWeight: 900, fontSize: 26, fill: color.ink }}>{pct}%</text>
        <text x={66} y={80} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: color.muted }}>win rate</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5, fontWeight: 600 }}>
        <div><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color.success, marginRight: 7 }} />
          <span style={{ color: color.body }}>{wonCount} won</span> <span style={{ color: color.faint }}>· {money0(wonValue)}</span></div>
        <div><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color.danger, marginRight: 7 }} />
          <span style={{ color: color.body }}>{lostCount} lost</span> <span style={{ color: color.faint }}>· {money0(lostValue)}</span></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StackedBars — monthly quoted value by outcome, last 6 months.
// ---------------------------------------------------------------------------
const BUCKETS: Array<{ key: keyof Pick<MonthBucket, 'won' | 'open' | 'lost' | 'draft'>; label: string; fill: string }> = [
  { key: 'won',   label: 'Won',   fill: color.success },
  { key: 'open',  label: 'Open',  fill: color.accent },
  { key: 'lost',  label: 'Lost',  fill: '#E58A99' },
  { key: 'draft', label: 'Draft', fill: '#D9DAE8' },
];

interface HoverSeg { i: number; label: string; fill: string; month: string; value: number }

export function StackedBars({ months }: { months: MonthBucket[] }) {
  const [hover, setHover] = useState<HoverSeg | null>(null);
  const totals = months.map((m) => m.draft + m.open + m.won + m.lost);
  const max = Math.max(...totals);
  if (max <= 0) return <EmptyState text="Monthly volume appears once you save your first quotes." />;

  const H = 118, W = 100 / months.length, AXIS_W = 46;
  const { niceMax, ticks } = niceTicks(max);
  const yOf = (v: number) => H - (v / niceMax) * H; // value → pixel y

  return (
    <div style={{ minHeight: 150 }}>
      <div style={{ display: 'flex' }}>
        {/* Y axis — round dollar ticks aligned to the gridlines */}
        <div style={{ width: AXIS_W, flex: 'none', position: 'relative', height: H }} aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ position: 'absolute', right: 8, top: yOf(t), transform: 'translateY(-50%)', fontSize: 9.5, fontWeight: 600, color: color.faint, whiteSpace: 'nowrap' }}>{money0(t)}</span>
          ))}
        </div>

        {/* plot — rects only in the stretched SVG (text would distort under
            preserveAspectRatio="none"; axis + labels are HTML around it) */}
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label="Quoted value per month by outcome">
            {ticks.map((t) => (
              <line key={t} x1={0} x2={100} y1={yOf(t)} y2={yOf(t)} stroke={color.borderSoft} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {months.map((m, i) => {
              let y = H;
              return (
                <g key={m.key}>
                  {BUCKETS.map((b) => {
                    const h = (m[b.key] / niceMax) * H;
                    if (h <= 0) return null;
                    y -= h;
                    return (
                      <rect key={b.key} x={i * W + W * 0.18} y={y} width={W * 0.64} height={h} fill={b.fill}
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={() => setHover({ i, label: b.label, fill: b.fill, month: m.label, value: m[b.key] })}
                        onMouseLeave={() => setHover((h0) => (h0 && h0.i === i && h0.label === b.label ? null : h0))}>
                        <title>{`${b.label} · ${m.label}: ${money0(m[b.key])}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* hover tooltip — the ONE hovered category's value, not the total.
              Shift horizontally near the edges so it never clips off the card. */}
          {hover && (() => {
            const pos = (hover.i + 0.5) / months.length;
            const tx = pos > 0.66 ? '-88%' : pos < 0.34 ? '-12%' : '-50%';
            return (
              <div style={{ position: 'absolute', left: `${pos * 100}%`, top: -2, transform: `translate(${tx},-100%)`, background: color.ink, color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 8px 20px -8px rgba(0,0,0,.55)', zIndex: 2 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: hover.fill, marginRight: 6 }} />
                {hover.label} · {hover.month}: {money0(hover.value)}
              </div>
            );
          })()}
        </div>
      </div>

      {/* month labels, offset to align under the plot (not the axis column) */}
      <div style={{ display: 'flex', marginTop: 4, paddingLeft: AXIS_W }}>
        {months.map((m) => (
          <span key={m.key} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, color: color.muted }}>{m.label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingLeft: AXIS_W, flexWrap: 'wrap' }}>
        {BUCKETS.map((b) => (
          <span key={b.key} style={{ fontSize: 11.5, fontWeight: 600, color: color.muted }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: b.fill, marginRight: 5 }} />{b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel — sent → opened → won, widths ∝ counts, stage conversion labeled.
// ---------------------------------------------------------------------------
export function Funnel({ sent, opened, won, openedPct, wonPct }: {
  sent: number; opened: number; won: number; openedPct: number; wonPct: number;
}) {
  if (sent === 0) return <EmptyState text="The funnel appears once you send your first quote." />;

  const rows = [
    { label: 'Sent', count: sent, fill: color.accent, pct: null as number | null },
    { label: 'Opened', count: opened, fill: '#7C5CFC', pct: openedPct },
    { label: 'Won', count: won, fill: color.success, pct: wonPct },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 132, justifyContent: 'center' }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: color.muted, marginBottom: 4 }}>
            <span>{r.label} <b style={{ color: color.body, fontFamily: heading }}>{r.count}</b></span>
            {r.pct != null && <span>{r.pct}%{r.label === 'Opened' ? ' of sent' : ' of opened'}</span>}
          </div>
          <div style={{ height: 14, borderRadius: 7, background: color.appBg, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sent ? Math.max((r.count / sent) * 100, r.count > 0 ? 6 : 0) : 0}%`, borderRadius: 7, background: r.fill, transition: 'width .3s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
