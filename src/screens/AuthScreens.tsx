// ============================================================================
// AuthScreens.tsx — login, sign-up, password reset UI
// ----------------------------------------------------------------------------
// Wired to authService. These are the entry points: sign-up runs the full
// provisioning sequence (auth user -> bootstrap shop), login resolves the
// session, and the shopless-recovery screen catches Google/OAuth users who
// never went through the sign-up form.
// ============================================================================

import { useState } from 'react';
import { authService } from '../services/authService';

export function LoginScreen({ onSuccess, onGoToSignup, onForgot }: {
  onSuccess: () => void; onGoToSignup: () => void; onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setError(null);
    const res = await authService.logIn(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else onSuccess();
  }

  return (
    <div className="auth-card">
      <h2>Welcome back</h2>
      <button className="auth-sso" onClick={() => authService.logInWithGoogle()}>Continue with Google</button>
      <div className="auth-or">or</div>
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword}
        labelAction={{ text: 'Forgot?', onClick: onForgot }} />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} onClick={submit}>
        {busy ? 'Logging in…' : 'Log in'}
      </button>
      <p className="auth-foot">New here? <a onClick={onGoToSignup}>Start free trial</a></p>
    </div>
  );
}

export function SignupScreen({ onSuccess, onGoToLogin }: {
  onSuccess: () => void; onGoToLogin: () => void;
}) {
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    if (!shopName.trim()) { setError('Enter your shop name.'); return; }
    setBusy(true); setError(null);
    const res = await authService.signUp({ email, password, shopName, fullName });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    // If email confirmation is ON, the shop isn't provisioned yet — tell them.
    if (res.data!.needsBootstrap) setConfirmSent(true);
    else onSuccess();
  }

  if (confirmSent) {
    return (
      <div className="auth-card auth-card--center">
        <h2>Check your email</h2>
        <p>Confirm your address to finish setting up <b>{shopName}</b>, then log in to start quoting.</p>
        <button className="auth-primary" onClick={onGoToLogin}>Back to login</button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Start quoting free</h2>
      <p className="auth-sub">No credit card. Your first quote is minutes away.</p>
      <button className="auth-sso" onClick={() => authService.logInWithGoogle()}>Sign up with Google</button>
      <div className="auth-or">or</div>
      <Field label="Shop name" value={shopName} onChange={setShopName} />
      <Field label="Your name" value={fullName} onChange={setFullName} />
      <Field label="Work email" type="email" value={email} onChange={setEmail} />
      <Field label="Create password" type="password" value={password} onChange={setPassword} />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} onClick={submit}>
        {busy ? 'Creating account…' : 'Create account'}
      </button>
      <p className="auth-fine">Your shop's data is private and isolated. Only people you invite can see your quotes.</p>
      <p className="auth-foot">Already have an account? <a onClick={onGoToLogin}>Log in</a></p>
    </div>
  );
}

// Shopless recovery — for Google/OAuth users who arrive authenticated but with
// no shop. The RequireShop guard routes them here. It runs bootstrap, turning
// them into a fully provisioned shop.
export function FinishSetupScreen({ onDone }: { onDone: () => void }) {
  const [shopName, setShopName] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!shopName.trim()) { setError('Enter your shop name.'); return; }
    setBusy(true); setError(null);
    const res = await authService.bootstrap(shopName, fullName);
    setBusy(false);
    if (res.error) setError(res.error);
    else onDone();
  }

  return (
    <div className="auth-card">
      <h2>Finish setting up your shop</h2>
      <p className="auth-sub">One quick step — name your shop and you're ready to quote.</p>
      <Field label="Shop name" value={shopName} onChange={setShopName} />
      <Field label="Your name" value={fullName} onChange={setFullName} />
      {error && <p className="auth-error">{error}</p>}
      <button className="auth-primary" disabled={busy} onClick={submit}>
        {busy ? 'Setting up…' : 'Finish setup'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', labelAction }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  labelAction?: { text: string; onClick: () => void };
}) {
  return (
    <label className="auth-field">
      <span className="auth-label">
        {label}
        {labelAction && <a className="auth-labelact" onClick={labelAction.onClick}>{labelAction.text}</a>}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
