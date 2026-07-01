// App.tsx — boots the data layer (mock in dev, live in Stage 8), then gates the
// app through AuthProvider: signed out → AuthScreen, authenticated-but-no-shop →
// finish setup, ready → AppShell. In dev the mock auto-signs-in a demo shop, so
// the daily-loop screens render immediately; with live env or ?auth the real
// login flow is shown.
import { useEffect, useState } from 'react';
import { color, font } from './design/tokens';
import { devBootstrap } from './app/devBootstrap';
import { AppShell } from './app/AppShell';
import { AuthProvider, useAuth } from './auth-wiring/components/AuthProvider';
import { AuthScreen } from './screens/AuthScreen';
import { authService } from './auth-wiring/services/authService';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.appBg, color: color.muted, fontFamily: `${font.body}, sans-serif` }}>
      {children}
    </div>
  );
}

function FinishSetup({ onDone }: { onDone: () => void }) {
  const [shopName, setShopName] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!shopName.trim()) return;
    setBusy(true);
    await authService.bootstrap(shopName, '');
    setBusy(false);
    onDone();
  }
  return (
    <Centered>
      <div style={{ background: color.surface, borderRadius: 22, padding: 32, width: 380, textAlign: 'center' }} data-screen="finish-setup">
        <h2 style={{ marginTop: 0, color: color.ink }}>Finish setting up</h2>
        <p style={{ fontSize: 14 }}>Name your shop to start quoting.</p>
        <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Shop name"
          style={{ width: '100%', height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', marginBottom: 14 }} />
        <button onClick={go} disabled={busy} style={{ width: '100%', height: 48, border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'Setting up…' : 'Create shop'}
        </button>
      </div>
    </Centered>
  );
}

function Gate() {
  const { status, context, refresh } = useAuth();
  if (status === 'loading') return <Centered>Loading QuoteForge…</Centered>;
  if (status === 'signedOut') return <AuthScreen onReady={refresh} />;
  if (status === 'needsBootstrap') return <FinishSetup onDone={refresh} />;
  return <AppShell shopName={context?.shopName || 'Your shop'} />;
}

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { devBootstrap().then(() => setReady(true)); }, []);
  if (!ready) return <Centered>Loading QuoteForge…</Centered>;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
