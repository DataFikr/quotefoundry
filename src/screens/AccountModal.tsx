// ============================================================================
// AccountModal.tsx — the "Account" view opened from the icon-rail user menu,
// plus the logout-success modal. Account shows everything the shop gave us at
// sign-up: company logo, shop name, plan, the user's name and email.
//
// LogoutSuccessModal renders at the Gate level (App.tsx), NOT inside AppShell:
// on live Supabase, signOut() fires onAuthStateChange which unmounts the app
// shell immediately — a modal inside it would flash and vanish.
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { shopService } from '../data-access-layer/services/rateService';
import { authService } from '../auth-wiring/services/authService';
import { supabase } from '../data-access-layer/lib/supabase';
import type { ShopInfo } from '../data-access-layer/lib/types';
import { color } from '../design/tokens';
import { heading, initials } from '../app/ui';
import { readLogoFile } from './AuthScreen';

const PLAN_LABEL: Record<string, string> = {
  trial: 'Free trial', solo: 'Solo', shop: 'Shop', shop_plus: 'Shop Plus',
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,20,45,.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
};

export function AccountModal({ onClose }: { onClose: () => void }) {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Change the shop logo (brands every quote PDF). Same validation as sign-up.
  async function changeLogo(file: File) {
    setLogoErr(null);
    const read = await readLogoFile(file);
    if (read.error) { setLogoErr(read.error); return; }
    setLogoBusy(true);
    const res = await shopService.setLogo(read.dataUrl!);
    setLogoBusy(false);
    if (res.error) { setLogoErr(res.error); return; }
    setShop((s) => (s ? { ...s, logo_url: res.data!.logo_url } : res.data));
  }

  useEffect(() => {
    (async () => {
      const [shopRes, sess] = await Promise.all([shopService.get(), authService.resolveSession()]);
      if (shopRes.data) setShop(shopRes.data);
      if (sess.data) setUserName(sess.data.fullName ?? '');
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? '');
      setLoading(false);
    })();
  }, []);

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '13px 0', borderBottom: '1px solid #F2F2F8', fontSize: 14 }}>
      <span style={{ color: color.body, fontWeight: 600 }}>{label}</span>
      <span style={{ color: color.ink, textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );

  return (
    <div onClick={onClose} style={overlay} data-testid="account-overlay">
      <div onClick={(e) => e.stopPropagation()} data-testid="account-modal"
        style={{ width: 440, maxWidth: '94vw', maxHeight: '92vh', overflow: 'auto', background: color.surface, borderRadius: 22, boxShadow: '0 30px 80px -20px rgba(0,0,0,.5)', padding: '28px 30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 19 }}>Account</div>
          <button onClick={onClose} aria-label="Close" data-testid="account-close"
            style={{ marginLeft: 'auto', width: 36, height: 36, border: 'none', borderRadius: 10, background: color.appBg, color: color.body, cursor: 'pointer', fontSize: 16 }}>
            <i className="las la-times" />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: color.muted, fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            {/* shop identity — logo exactly as it appears on the quote PDFs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20, padding: 16, background: color.appBg, borderRadius: 16 }}>
              {shop?.logo_url ? (
                <img src={shop.logo_url} alt={`${shop?.name ?? 'Shop'} logo`} data-testid="account-logo"
                  style={{ width: 64, height: 64, objectFit: 'contain', background: '#fff', borderRadius: 12, border: `1px solid ${color.border}`, flex: 'none' }} />
              ) : (
                <div data-testid="account-logo-placeholder" style={{ width: 64, height: 64, borderRadius: 12, background: 'linear-gradient(135deg,#4667DB,#7C5CFC)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 22, flex: 'none' }}>
                  {initials(shop?.name)}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="account-shop-name">{shop?.name ?? '—'}</div>
                <span style={{ display: 'inline-block', marginTop: 5, padding: '4px 12px', borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: heading, background: 'rgba(70,103,219,.12)', color: color.accentDeep }}>
                  {PLAN_LABEL[shop?.plan ?? ''] ?? 'Free trial'}
                </span>
                {!shop?.logo_url && <div style={{ fontSize: 12, color: color.muted, marginTop: 5 }}>No logo yet — it appears top-left on your quote PDFs.</div>}
                <div style={{ marginTop: 8 }}>
                  <button onClick={() => logoRef.current?.click()} disabled={logoBusy} data-testid="change-logo"
                    style={{ height: 34, padding: '0 14px', border: `1.5px solid ${color.border}`, borderRadius: 10, background: '#fff', color: color.body, fontFamily: heading, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: logoBusy ? 0.7 : 1 }}>
                    <i className={logoBusy ? 'las la-spinner' : 'las la-image'} style={logoBusy ? { animation: 'qfSpin 1s linear infinite' } : undefined} />
                    {logoBusy ? 'Saving…' : shop?.logo_url ? 'Change logo' : 'Add logo'}
                  </button>
                  <input ref={logoRef} type="file" accept="image/png,image/jpeg" data-testid="change-logo-input" style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) changeLogo(f); e.target.value = ''; }} />
                  {logoErr && <div style={{ fontSize: 12.5, color: color.danger, fontWeight: 600, marginTop: 6 }}>{logoErr}</div>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {row('Your name', userName || '—')}
              {row('Email', email || '—')}
              {row('Shop name', shop?.name ?? '—')}
              {shop?.created_at && row('Member since', new Date(shop.created_at).toLocaleDateString())}
            </div>

            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 16, lineHeight: 1.5 }}>
              <i className="las la-info-circle" style={{ marginRight: 5 }} />
              Your logo brands every customer quote PDF. Rates live in Rate settings; they never change quotes you've already saved.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function LogoutSuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={overlay} data-testid="logout-success-overlay">
      <div data-testid="logout-success" style={{ width: 380, maxWidth: '94vw', background: color.surface, borderRadius: 22, boxShadow: '0 30px 80px -20px rgba(0,0,0,.5)', padding: '34px 30px', textAlign: 'center' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: color.successBg, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto' }}>
          <i className="las la-check" />
        </div>
        <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 19, marginTop: 16 }}>Logged out successfully</div>
        <div style={{ fontSize: 13.5, color: color.muted, marginTop: 6, lineHeight: 1.5 }}>Your session has ended. See you next quote.</div>
        <button onClick={onClose} data-testid="logout-success-ok"
          style={{ marginTop: 20, width: '100%', height: 46, border: 'none', borderRadius: 13, background: color.accent, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
          Back to login
        </button>
      </div>
    </div>
  );
}
