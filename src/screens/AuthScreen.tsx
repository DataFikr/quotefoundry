// ============================================================================
// AuthScreen.tsx — login / sign-up entry, wired to authService. Sign-up runs
// the full provisioning sequence (auth user → bootstrap_shop → seeded rates).
// Shown when the live client has no session (Stage 8). Styled to the app brand.
// ============================================================================
import { useState, useRef } from 'react';
import { authService } from '../auth-wiring/services/authService';
import { color } from '../design/tokens';
import { heading, cardShadowLg } from '../app/ui';

// Company logo upload: PNG/JPEG only (what the PDF generators embed), capped
// so the data-URL stays a sane size in the shops row.
export const LOGO_MAX_BYTES = 500 * 1024;

export function readLogoFile(file: File): Promise<{ dataUrl?: string; error?: string }> {
  if (!/^image\/(png|jpe?g)$/.test(file.type)) {
    return Promise.resolve({ error: 'Logo must be a PNG or JPEG image.' });
  }
  if (file.size > LOGO_MAX_BYTES) {
    return Promise.resolve({ error: 'Logo must be under 500 KB — export a smaller version.' });
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result) });
    reader.onerror = () => resolve({ error: 'Could not read that file.' });
    reader.readAsDataURL(file);
  });
}

export function AuthScreen({ onReady, onBack, enforceAuth = true, initialMode = 'login' }: {
  onReady: () => void; onBack?: () => void; enforceAuth?: boolean; initialMode?: 'login' | 'signup';
}) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [logo, setLogo] = useState<{ dataUrl: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  async function pickLogo(file: File) {
    setError(null);
    const res = await readLogoFile(file);
    if (res.error) { setError(res.error); return; }
    setLogo({ dataUrl: res.dataUrl!, name: file.name });
  }

  async function submit() {
    // No-auth demo: any login/signup just enters the app.
    if (!enforceAuth) { onReady(); return; }
    // Logo is required at sign-up — it brands every customer PDF (top-left).
    if (mode === 'signup' && !logo) { setError('Add your company logo — it goes on every quote PDF.'); return; }
    setBusy(true); setError(null);
    const res = mode === 'signup'
      ? await authService.signUp({ email, password, shopName, fullName, logoDataUrl: logo?.dataUrl })
      : await authService.logIn(email, password);
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    onReady();
  }

  const field: React.CSSProperties = { width: '100%', height: 46, border: `1.5px solid ${color.border}`, borderRadius: 12, padding: '0 14px', fontSize: 14.5, marginTop: 7, color: color.ink };
  const labelCss: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: color.body, fontFamily: heading };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.appBg, padding: 24 }} data-screen="auth">
      <div style={{ width: 420, maxWidth: '94vw', background: color.surface, borderRadius: 22, boxShadow: cardShadowLg, padding: '34px 34px 30px' }}>
        {onBack && (
          <div onClick={onBack} data-testid="auth-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: color.muted, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14 }}>
            <i className="las la-arrow-left" /> Back
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 18px -6px ${color.accent}` }}>
            <i className="las la-bolt" style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <div style={{ fontFamily: heading, fontWeight: 900, fontSize: 22, color: color.accentDeep }}>QuoteFoundry</div>
        </div>

        <h2 style={{ margin: '0 0 4px', fontFamily: heading, fontWeight: 700, fontSize: 22 }}>
          {mode === 'signup' ? 'Start your free trial' : 'Welcome back'}
        </h2>
        <div style={{ fontSize: 13.5, color: color.muted, marginBottom: 18 }}>
          {mode === 'signup' ? 'Quote your first job in minutes — no card required.' : 'Log in to your shop.'}
        </div>

        {mode === 'signup' && (
          <>
            <label style={{ display: 'block', marginBottom: 12 }}><span style={labelCss}>Shop name</span>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Ironside Fabrication" style={field} data-field="shopName" /></label>
            <label style={{ display: 'block', marginBottom: 12 }}><span style={labelCss}>Your name</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mike Torres" style={field} data-field="fullName" /></label>
            <div style={{ marginBottom: 12 }}>
              <span style={labelCss}>Company logo <span style={{ color: color.muted, fontWeight: 400 }}>(required — appears on your quote PDFs)</span></span>
              <div onClick={() => logoRef.current?.click()} data-testid="logo-drop"
                style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 12, border: `1.5px dashed ${logo ? color.success : color.border}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer', background: logo ? color.successBg : '#FBFBFE' }}>
                {logo ? (
                  <>
                    <img src={logo.dataUrl} alt="Company logo preview" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: color.success, fontFamily: heading }}>Logo added</div>
                      <div style={{ fontSize: 12, color: color.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{logo.name} — click to replace</div>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="las la-image" style={{ fontSize: 24, color: '#B6B6CC' }} />
                    <div style={{ fontSize: 13, color: '#71728F' }}>Click to upload — PNG or JPEG, under 500 KB</div>
                  </>
                )}
                <input ref={logoRef} type="file" accept="image/png,image/jpeg" data-testid="logo-input" style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickLogo(f); e.target.value = ''; }} />
              </div>
            </div>
          </>
        )}
        <label style={{ display: 'block', marginBottom: 12 }}><span style={labelCss}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.com" style={field} data-field="email" /></label>
        <label style={{ display: 'block', marginBottom: 16 }}><span style={labelCss}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={field} data-field="password" /></label>

        {error && <div style={{ color: color.danger, fontSize: 13, marginBottom: 12 }} data-testid="auth-error">{error}</div>}

        <button onClick={submit} disabled={busy} data-testid="auth-submit"
          style={{ width: '100%', height: 50, border: 'none', borderRadius: 14, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create shop & start' : 'Log in'}
        </button>
        {!enforceAuth && (
          <div style={{ textAlign: 'center', fontSize: 12, color: color.faint, marginTop: 10 }}>Demo mode — any details take you straight in.</div>
        )}

        <div style={{ textAlign: 'center', fontSize: 13.5, color: color.muted, marginTop: 16 }}>
          {mode === 'signup' ? (
            <>Already have a shop? <a onClick={() => { setMode('login'); setError(null); }} data-testid="to-login" style={{ color: color.accentDeep, cursor: 'pointer', fontWeight: 700 }}>Log in</a></>
          ) : (
            <>New here? <a onClick={() => { setMode('signup'); setError(null); }} data-testid="to-signup" style={{ color: color.accentDeep, cursor: 'pointer', fontWeight: 700 }}>Start free trial</a></>
          )}
        </div>
      </div>
    </div>
  );
}
