// App.tsx — boots the data layer (mock in dev, live in Stage 8), then routes:
//   Landing → Login/Sign-up → app.
// In the no-auth demo any login just enters (the mock has a demo shop). With a
// live Supabase env, the login is real and AuthProvider gates the app.
// Query flags for tests/flows: ?app skips straight to the app; ?auth opens the
// real auth flow on the mock (provisions a fresh shop).
import { useEffect, useState } from 'react';
import { color, font } from './design/tokens';
import { devBootstrap, isLiveEnv } from './app/devBootstrap';
import { AppShell } from './app/AppShell';
import { AuthProvider, useAuth } from './auth-wiring/components/AuthProvider';
import { AuthScreen, readLogoFile } from './screens/AuthScreen';
import { LandingScreen } from './screens/LandingScreen';
import { authService } from './auth-wiring/services/authService';
import { LogoutSuccessModal } from './screens/AccountModal';
import { PublicQuoteScreen, publicQuoteToken } from './screens/PublicQuoteScreen';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.appBg, color: color.muted, fontFamily: `${font.body}, sans-serif` }}>
      {children}
    </div>
  );
}

function FinishSetup({ onDone }: { onDone: () => void }) {
  const [shopName, setShopName] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pick(f: File) {
    setErr(null);
    const res = await readLogoFile(f);
    if (res.error) { setErr(res.error); return; }
    setLogo(res.dataUrl!);
  }
  async function go() {
    if (!shopName.trim()) return;
    if (!logo) { setErr('Add your company logo — it goes on every quote PDF.'); return; }
    setBusy(true);
    await authService.bootstrap(shopName, '', logo);
    setBusy(false);
    onDone();
  }
  return (
    <Centered>
      <div style={{ background: color.surface, borderRadius: 22, padding: 32, width: 380, textAlign: 'center' }} data-screen="finish-setup">
        <h2 style={{ marginTop: 0, color: color.ink }}>Finish setting up</h2>
        <p style={{ fontSize: 14 }}>Name your shop and add your logo to start quoting.</p>
        <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Shop name"
          style={{ width: '100%', height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', marginBottom: 14 }} />
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: `1.5px dashed ${logo ? '#0E7A4C' : color.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, cursor: 'pointer', fontSize: 13, color: color.muted }}>
          {logo ? <img src={logo} alt="Logo preview" style={{ width: 36, height: 36, objectFit: 'contain' }} /> : <i className="las la-image" style={{ fontSize: 22 }} />}
          {logo ? 'Logo added — click to replace' : 'Company logo (PNG/JPEG, required)'}
          <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
        </label>
        {err && <div style={{ color: '#C92A42', fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button onClick={go} disabled={busy} style={{ width: '100%', height: 48, border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          {busy ? 'Setting up…' : 'Create shop'}
        </button>
      </div>
    </Centered>
  );
}

function Gate() {
  const { status, context, refresh } = useAuth();
  // Logout success lives HERE, not in AppShell: on live Supabase, signOut()
  // fires onAuthStateChange and unmounts the shell before a modal inside it
  // could be seen. The flag survives the swap to the auth screen.
  const [loggedOut, setLoggedOut] = useState(false);

  async function handleLogout() {
    await authService.logOut();
    setLoggedOut(true);
    refresh(); // mock client has no auth events — refresh explicitly
  }

  if (status === 'loading') return <Centered>Loading QuoteFoundry…</Centered>;
  if (status === 'signedOut') return (
    <>
      <AuthScreen onReady={refresh} />
      {loggedOut && <LogoutSuccessModal onClose={() => setLoggedOut(false)} />}
    </>
  );
  if (status === 'needsBootstrap') return <FinishSetup onDone={refresh} />;
  return (
    <AppShell
      shopName={context?.shopName || 'Your shop'}
      userName={context?.fullName || undefined}
      onLogout={handleLogout}
    />
  );
}

export function App() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  // An in-app hash (#/quotes…) means "resume where I was" — enter the app so a
  // refresh/deep-link restores the screen (Phase 4.1). In live mode the Gate
  // still enforces a session; the hash rides along through login.
  const hasAppHash = typeof window !== 'undefined' && /^#\/(quotes|customers|rates)/.test(window.location.hash);
  // PUBLIC QUOTE LINK (#/q/<token>) — the shop's CUSTOMER, not a user. Renders
  // before (and without) auth, the data layer, or devBootstrap: the screen only
  // talks to /api/quote-view / /api/quote-respond with the token as credential.
  const [publicToken, setPublicToken] = useState<string | null>(
    () => (typeof window !== 'undefined' ? publicQuoteToken(window.location.hash) : null)
  );
  useEffect(() => {
    const onHash = () => setPublicToken(publicQuoteToken(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(params.has('app') || hasAppHash);
  const [view, setView] = useState<'landing' | 'auth'>(params.has('auth') ? 'auth' : 'landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const enforceAuth = isLiveEnv() || params.has('auth');

  useEffect(() => { devBootstrap().then(() => setReady(true)); }, []);

  // Customer-facing quote page — fully standalone, before any app gating.
  if (publicToken) return <PublicQuoteScreen token={publicToken} />;

  // HARD GUARD: a production build without Supabase env vars would otherwise
  // silently ship the in-memory DEMO backend (fake login, Ironside demo shop)
  // to real visitors. Fail loudly instead — this is a deploy misconfiguration,
  // never a mode customers should see. (Local dev/e2e use `npm run dev`, which
  // is a development build, so the mock still works there.)
  if (import.meta.env.PROD && !isLiveEnv()) {
    return (
      <Centered>
        <div style={{ maxWidth: 460, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
          <h2 style={{ color: color.ink, margin: '0 0 8px' }}>Deployment configuration error</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>
            This build has no database configured (<code>VITE_SUPABASE_URL</code> /{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> are missing). Set them in the hosting
            platform's environment variables and redeploy — see <code>docs/DEPLOY.md</code> §1.
          </p>
        </div>
      </Centered>
    );
  }

  if (!ready) return <Centered>Loading QuoteFoundry…</Centered>;

  if (!entered) {
    if (view === 'landing') {
      return (
        <LandingScreen
          onStart={() => { setAuthMode('signup'); setView('auth'); }}
          onLogin={() => { setAuthMode('login'); setView('auth'); }}
        />
      );
    }
    return (
      <AuthScreen
        enforceAuth={enforceAuth}
        initialMode={authMode}
        onReady={() => setEntered(true)}
        onBack={params.has('auth') ? undefined : () => setView('landing')}
      />
    );
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
