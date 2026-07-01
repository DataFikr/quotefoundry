// ============================================================================
// AppShell.tsx — icon rail + top bar + a simple screen router, matching the
// mockup's app chrome (design/QuoteForge.dc.html). Screens mount in the scroll
// area. State-based routing keeps it dependency-free for the MVP.
// ============================================================================
import { useState, useCallback } from 'react';
import { color } from '../design/tokens';
import { heading } from './ui';
import { PipelineScreen } from '../screens/PipelineScreen';
import { EditorScreen, PresetCustomer } from '../screens/EditorScreen';
import { DetailScreen } from '../screens/DetailScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { RatesScreen } from '../screens/RatesScreen';

export type Screen =
  | { name: 'pipeline' }
  | { name: 'editor'; quoteId?: string; presetCustomer?: PresetCustomer }
  | { name: 'detail'; quoteId: string }
  | { name: 'customers' }
  | { name: 'rates' };

const NAV = [
  { name: 'pipeline', icon: 'la-stream', label: 'Pipeline' },
  { name: 'customers', icon: 'la-users', label: 'Customers' },
  { name: 'rates', icon: 'la-sliders-h', label: 'Rates' },
] as const;

const TITLES: Record<string, { title: string; sub: string }> = {
  pipeline: { title: 'Quote pipeline', sub: 'Every quote, from draft to won' },
  editor: { title: 'New quote', sub: 'Enter the job — pricing updates live' },
  detail: { title: 'Quote detail', sub: 'Scope, totals, and activity' },
  customers: { title: 'Customers', sub: 'Your saved customers' },
  rates: { title: 'Rate settings', sub: 'Your shop rates — used on new quotes' },
};

export function AppShell({ shopName }: { shopName: string }) {
  const [screen, setScreen] = useState<Screen>({ name: 'pipeline' });
  const [reloadKey, setReloadKey] = useState(0);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const meta = TITLES[screen.name] ?? TITLES.pipeline;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: color.appBg, color: color.ink }}>
      {/* ICON RAIL */}
      <aside style={{ width: 84, flex: 'none', background: color.surface, borderRight: `1px solid ${color.borderSoft}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 0', gap: 26, zIndex: 5 }}>
        <div style={{ width: 46, height: 46, borderRadius: 14, background: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 18px -6px ${color.accent}` }}>
          <i className="las la-bolt" style={{ color: '#fff', fontSize: 24 }} />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 6 }}>
          {NAV.map((item) => {
            const active = item.name === screen.name || (item.name === 'pipeline' && (screen.name === 'editor' || screen.name === 'detail'));
            return (
              <a
                key={item.name}
                title={item.label}
                onClick={() => go({ name: item.name } as Screen)}
                data-nav={item.name}
                style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, cursor: 'pointer', fontSize: 22, color: active ? color.accentDeep : color.muted, background: active ? 'rgba(94,129,244,.12)' : 'transparent' }}
              >
                <i className={`las ${item.icon}`} />
              </a>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg,#5E81F4,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14 }}>
          MT
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ flex: 'none', height: 84, display: 'flex', alignItems: 'center', gap: 18, padding: '0 34px', borderBottom: `1px solid ${color.borderSoft}`, background: color.appBg }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: heading, fontWeight: 700, fontSize: 25, letterSpacing: '-.3px' }} data-testid="screen-title">{meta.title}</h1>
            <div style={{ fontSize: 13, color: color.muted, marginTop: 1 }}>{meta.sub} · {shopName}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => go({ name: 'editor' })}
              data-testid="new-quote"
              style={{ height: 44, padding: '0 22px', border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, boxShadow: `0 10px 20px -8px ${color.accent}` }}
            >
              <i className="las la-plus" />New quote
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {screen.name === 'pipeline' && (
            <PipelineScreen key={reloadKey} onOpen={(id) => go({ name: 'detail', quoteId: id })} onNew={() => go({ name: 'editor' })} onRefresh={refresh} />
          )}
          {screen.name === 'editor' && (
            <EditorScreen quoteId={screen.quoteId} presetCustomer={screen.presetCustomer} onSaved={(id) => go({ name: 'detail', quoteId: id })} onCancel={() => go({ name: 'pipeline' })} />
          )}
          {screen.name === 'detail' && (
            <DetailScreen quoteId={screen.quoteId} onBack={() => go({ name: 'pipeline' })} onEdit={(id) => go({ name: 'editor', quoteId: id })} onChanged={refresh} />
          )}
          {screen.name === 'customers' && (
            <CustomersScreen key={reloadKey} onNewQuote={(c) => go({ name: 'editor', presetCustomer: c })} />
          )}
          {screen.name === 'rates' && <RatesScreen />}
        </div>
      </main>
    </div>
  );
}
