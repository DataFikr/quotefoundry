// ============================================================================
// AppShell.tsx — app chrome + a simple screen router.
//   Desktop (>600px): left icon rail + top bar (design/QuoteFoundry.dc.html).
//   Mobile (≤600px):  bottom tab bar + compact top bar + sticky New-quote,
//                     per the mobile prototype (reference/QuoteFoundry Mobile
//                     Prototype.dc.html). Editor/Detail are full-screen flows
//                     with their own back nav (no tab bar) in both layouts.
// The SCREEN SWITCH is shared by both chromes — one router, two frames, so
// mobile keeps 100% of desktop functionality.
// ============================================================================
import { useState } from 'react';
import { color } from '../design/tokens';
import { heading, initials } from './ui';
import { useIsMobile } from './useIsMobile';
import { useHashRoute } from './useHashRoute';
import { Toast, useToast } from './Toast';
import { PipelineScreen } from '../screens/PipelineScreen';
import { EditorScreen, PresetCustomer } from '../screens/EditorScreen';
import { DetailScreen } from '../screens/DetailScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { RatesScreen } from '../screens/RatesScreen';
import { AccountModal } from '../screens/AccountModal';

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

// Mobile bottom-tab defs (prototype labels/icons).
const MOBILE_TABS = [
  { name: 'pipeline', icon: 'la-file-invoice-dollar', label: 'Quotes' },
  { name: 'customers', icon: 'la-users', label: 'Customers' },
  { name: 'rates', icon: 'la-sliders-h', label: 'Rates' },
] as const;

const MOBILE_TITLE: Record<string, string> = { pipeline: 'Quotes', customers: 'Customers', rates: 'Shop rates' };

const TITLES: Record<string, { title: string; sub: string }> = {
  pipeline: { title: 'Quote pipeline', sub: 'Every quote, from draft to won' },
  editor: { title: 'New quote', sub: 'Enter the job — pricing updates live' },
  detail: { title: 'Quote detail', sub: 'Scope, totals, and activity' },
  customers: { title: 'Customers', sub: 'Your saved customers' },
  rates: { title: 'Rate settings', sub: 'Your shop rates — used on new quotes' },
};

export function AppShell({ shopName, userName, onLogout }: { shopName: string; userName?: string; onLogout?: () => void }) {
  const { screen, navigate: go } = useHashRoute();
  const [reloadKey, setReloadKey] = useState(0);
  const [userMenu, setUserMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const mobile = useIsMobile();
  // App-level toast (Phase 4.2): lives above the screen switch so a confirmation
  // survives the navigation that a mutation triggers (e.g. "Quote saved." shows
  // on the detail screen the editor navigates to). Passed to screens as `notify`.
  const { toast, show: notify, dismiss } = useToast();

  const refresh = () => setReloadKey((k) => k + 1);

  const meta = TITLES[screen.name] ?? TITLES.pipeline;
  const tabbed = screen.name === 'pipeline' || screen.name === 'customers' || screen.name === 'rates';

  // The one screen switch, shared by both chromes.
  const content = (
    <>
      {screen.name === 'pipeline' && (
        <PipelineScreen key={reloadKey} onOpen={(id) => go({ name: 'detail', quoteId: id })} onNew={() => go({ name: 'editor' })} onRefresh={refresh} notify={notify} />
      )}
      {screen.name === 'editor' && (
        <EditorScreen quoteId={screen.quoteId} presetCustomer={screen.presetCustomer} onSaved={(id) => go({ name: 'detail', quoteId: id }, true)} onCancel={() => go({ name: 'pipeline' })} notify={notify} />
      )}
      {screen.name === 'detail' && (
        <DetailScreen quoteId={screen.quoteId} onBack={() => go({ name: 'pipeline' })} onEdit={(id) => go({ name: 'editor', quoteId: id })} onChanged={refresh} notify={notify} />
      )}
      {screen.name === 'customers' && (
        <CustomersScreen key={reloadKey} onNewQuote={(c) => go({ name: 'editor', presetCustomer: c })} notify={notify} />
      )}
      {screen.name === 'rates' && <RatesScreen notify={notify} />}
    </>
  );

  // Account dropdown (Account / Log out) — reused by both chromes.
  const accountMenu = (anchor: React.CSSProperties) => userMenu && (
    <>
      <div onClick={() => setUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div data-testid="user-menu" style={{ position: 'absolute', zIndex: 45, width: 200, background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: 14, boxShadow: '0 18px 40px -18px rgba(30,30,80,.4)', padding: 6, ...anchor }}>
        <div style={{ padding: '9px 12px 7px', fontSize: 12, color: color.muted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName || shopName}</div>
        <button onClick={() => { setUserMenu(false); setAccountOpen(true); }} data-testid="menu-account"
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'transparent', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
          <i className="las la-user-circle" style={{ fontSize: 18 }} />Account
        </button>
        <button onClick={() => { setUserMenu(false); onLogout?.(); }} data-testid="menu-logout"
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, padding: '0 12px', border: 'none', borderRadius: 10, background: 'transparent', color: color.danger, fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
          <i className="las la-sign-out-alt" style={{ fontSize: 18 }} />Log out
        </button>
      </div>
    </>
  );

  // ==========================================================================
  // MOBILE CHROME — bottom tabs, compact top bar, sticky New-quote
  // ==========================================================================
  if (mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', overflow: 'hidden', background: color.appBg, color: color.ink }}>
        {/* compact top bar (tabbed screens only; editor/detail have their own back nav) */}
        {tabbed && (
          <header style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 8px' }}>
            <div style={{ minWidth: 0 }}>
              <div data-testid="screen-title" style={{ fontFamily: heading, fontWeight: 900, fontSize: 24, letterSpacing: '-.4px', lineHeight: 1.05 }}>{MOBILE_TITLE[screen.name]}</div>
              <div style={{ fontSize: 13, color: color.muted, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shopName}</div>
            </div>
            <div style={{ marginLeft: 'auto', position: 'relative', flex: 'none' }}>
              <button onClick={() => setUserMenu((v) => !v)} data-testid="user-menu-trigger" aria-label="Account menu" aria-expanded={userMenu}
                style={{ width: 46, height: 46, border: 'none', padding: 0, borderRadius: 15, background: 'linear-gradient(135deg,#5E81F4,#7C5CFC)', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                {initials(userName || shopName)}
              </button>
              {accountMenu({ top: 54, right: 0 })}
            </div>
          </header>
        )}

        {/* screen content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {content}
        </div>

        {/* sticky New-quote (pipeline only) */}
        {screen.name === 'pipeline' && (
          <div style={{ flex: 'none', padding: '8px 16px 10px' }}>
            <button onClick={() => go({ name: 'editor' })} data-testid="new-quote"
              style={{ width: '100%', height: 58, border: 'none', borderRadius: 18, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 14px 26px -10px ${color.accent}` }}>
              <i className="las la-plus" style={{ fontSize: 20 }} />New quote
            </button>
          </div>
        )}

        {/* bottom tab bar (tabbed screens only) */}
        {tabbed && (
          <nav style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: `1px solid ${color.borderSoft}`, background: color.surface, padding: '6px 12px calc(8px + env(safe-area-inset-bottom))' }}>
            {MOBILE_TABS.map((t) => {
              const active = t.name === screen.name;
              return (
                <button key={t.name} onClick={() => go({ name: t.name } as Screen)} data-nav={t.name}
                  aria-label={t.label} aria-current={active ? 'page' : undefined}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 54, border: 'none', background: 'transparent', color: active ? color.accentDeep : color.muted, cursor: 'pointer' }}>
                  <i className={`las ${t.icon}`} style={{ fontSize: 24 }} aria-hidden="true" />
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: heading }}>{t.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
        <Toast toast={toast} onDismiss={dismiss} />
      </div>
    );
  }

  // ==========================================================================
  // DESKTOP CHROME — icon rail + top bar (unchanged)
  // ==========================================================================
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
              <button
                key={item.name}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => go({ name: item.name } as Screen)}
                data-nav={item.name}
                style={{ width: 46, height: 46, border: 'none', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, cursor: 'pointer', fontSize: 22, color: active ? color.accentDeep : color.muted, background: active ? 'rgba(70,103,219,.12)' : 'transparent' }}
              >
                <i className={`las ${item.icon}`} aria-hidden="true" />
              </button>
            );
          })}
        </nav>
        {/* user menu — Account / Log out */}
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <button onClick={() => setUserMenu((v) => !v)} data-testid="user-menu-trigger"
            aria-label="Account menu" aria-expanded={userMenu} title="Account"
            style={{ width: 38, height: 38, border: 'none', padding: 0, borderRadius: 12, background: 'linear-gradient(135deg,#4667DB,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {initials(userName || shopName)}
          </button>
          {accountMenu({ left: 50, bottom: 0 })}
        </div>
      </aside>
      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}

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
          {content}
        </div>
      </main>
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
