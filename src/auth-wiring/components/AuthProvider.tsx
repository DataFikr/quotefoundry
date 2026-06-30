// ============================================================================
// AuthProvider.tsx — app-wide session state + the route guard
// ----------------------------------------------------------------------------
// Wraps the app, resolves the session once on load, listens for auth changes,
// and exposes { context, status } to every screen. The guard below uses it to
// decide what a visitor can see:
//   - loading        -> spinner
//   - signed out     -> login / sign-up
//   - needsBootstrap -> finish-setup recovery (the shopless edge case)
//   - ready          -> the app
// ============================================================================

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../../data-access-layer/lib/supabase';
import { authService, SessionContext } from '../services/authService';

type AuthStatus = 'loading' | 'signedOut' | 'needsBootstrap' | 'ready';

interface AuthState {
  status: AuthStatus;
  context: SessionContext | null;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [context, setContext] = useState<SessionContext | null>(null);

  async function refresh() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setContext(null);
      setStatus('signedOut');
      return;
    }
    const res = await authService.resolveSession();
    if (res.error || !res.data) {
      setContext(null);
      setStatus('signedOut');
      return;
    }
    setContext(res.data);
    setStatus(res.data.needsBootstrap ? 'needsBootstrap' : 'ready');
  }

  useEffect(() => {
    refresh();
    // React to login/logout/token-refresh from anywhere (incl. other tabs).
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ status, context, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// ----------------------------------------------------------------------------
// RequireShop — the route guard. Renders children only for a fully provisioned
// session; otherwise routes to the right recovery screen.
// ----------------------------------------------------------------------------
export function RequireShop({
  children,
  onSignedOut,
  onNeedsBootstrap,
}: {
  children: ReactNode;
  onSignedOut: ReactNode;
  onNeedsBootstrap: ReactNode;
}) {
  const { status } = useAuth();
  if (status === 'loading') return <div className="auth-loading">Loading…</div>;
  if (status === 'signedOut') return <>{onSignedOut}</>;
  if (status === 'needsBootstrap') return <>{onNeedsBootstrap}</>;
  return <>{children}</>;
}
