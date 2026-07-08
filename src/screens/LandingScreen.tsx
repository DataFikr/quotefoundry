// ============================================================================
// LandingScreen.tsx — the public marketing page. "Start free" → sign-up,
// "Log in" → login. In the no-auth demo, either path just drops you into the
// app. Palette comes from the app design tokens (Phase 3.3 — no brand seam at
// sign-up). The founding-partner section stands in for a pricing page until
// beta feedback validates the tiers (founder decision 2026-07-03).
// ============================================================================
import { heading } from '../app/ui';
import { color } from '../design/tokens';
import { useIsMobile } from '../app/useIsMobile';
import { LandingDemo } from './LandingDemo';

// Landing accents derived from the app token palette (one brand, one hue).
const DK = color.panelFrom;        // deep ink-navy headings (matches cost panel)
const ACCENT = color.accentDeep;   // links, step badges, eyebrow labels
const CTA = color.accent;          // primary buttons — same as in-app buttons
const TINT = '#EEF1FF';            // light accent tint for cards/hero
const SUB = color.body;            // supporting copy

export function LandingScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const mobile = useIsMobile();
  const px = mobile ? 22 : 40; // shared horizontal gutter
  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', background: '#fff', color: color.ink, fontFamily: "'Source Sans 3', sans-serif" }} data-screen="landing">
      {/* nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${mobile ? 12 : 16}px ${px}px`, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: heading, fontWeight: 900, fontSize: 19, color: DK }}>
          <i className="las la-bolt" style={{ color: CTA, fontSize: 24 }} />QuoteFoundry
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a onClick={onLogin} data-testid="landing-login" style={{ fontSize: 14.5, color: SUB, cursor: 'pointer' }}>Sign in</a>
          <button onClick={onStart} data-testid="landing-start" style={{ fontFamily: heading, fontWeight: 700, fontSize: 14, padding: '9px 20px', borderRadius: 11, background: CTA, color: '#fff', border: 'none', cursor: 'pointer' }}>Start free</button>
        </div>
      </div>

      {/* hero */}
      <div style={{ background: `linear-gradient(180deg,${TINT},#F8FAFF)`, padding: mobile ? `44px ${px}px 140px` : '72px 40px 300px', textAlign: mobile ? 'left' : 'center' }}>
        <div style={{ fontFamily: heading, fontWeight: 700, fontSize: mobile ? 12 : 13, color: ACCENT, letterSpacing: '.12em', marginBottom: mobile ? 12 : 16 }}>BUILT FOR METAL FAB &amp; WELDING SHOPS</div>
        <h1 style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 33 : 46, lineHeight: 1.1, color: DK, margin: mobile ? '0 0 14px' : '0 auto 18px', maxWidth: 760, letterSpacing: mobile ? '-.6px' : '-1px' }}>Quote structural steel jobs in 10 minutes, not all afternoon</h1>
        <p style={{ fontSize: mobile ? 16.5 : 18, color: SUB, lineHeight: 1.55, maxWidth: 560, margin: mobile ? '0 0 24px' : '0 auto 30px' }}>Stop losing jobs to slow quotes and margin to forgotten costs. Enter the job, get a branded quote, win more work.</p>
        <div style={{ display: 'flex', gap: mobile ? 12 : 14, justifyContent: mobile ? 'stretch' : 'center', alignItems: 'center', flexWrap: 'wrap', flexDirection: mobile ? 'column' : 'row' }}>
          <button onClick={onStart} style={{ fontFamily: heading, fontWeight: 700, fontSize: mobile ? 17 : 16, padding: mobile ? '0 24px' : '15px 30px', height: mobile ? 60 : undefined, width: mobile ? '100%' : undefined, borderRadius: mobile ? 17 : 13, background: CTA, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: `0 14px 28px -12px ${CTA}` }}>
            <i className="las la-arrow-right" style={{ fontSize: 19 }} />Quote your first job free
          </button>
          <button onClick={onLogin} style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, padding: mobile ? '0 24px' : '15px 24px', height: mobile ? 54 : undefined, width: mobile ? '100%' : undefined, borderRadius: mobile ? 16 : 13, background: '#fff', color: ACCENT, border: `1.5px solid ${color.border}`, cursor: 'pointer' }}>Log in</button>
        </div>
        <div style={{ fontSize: 13.5, color: SUB, marginTop: 20, display: 'flex', gap: mobile ? 8 : 22, justifyContent: mobile ? 'flex-start' : 'center', flexDirection: mobile ? 'column' : 'row', flexWrap: 'wrap' }}>
          <span><i className="las la-check" style={{ color: color.success }} /> No credit card</span>
          <span><i className="las la-check" style={{ color: color.success }} /> Live in 15 minutes</span>
          <span><i className="las la-check" style={{ color: color.success }} /> Cancel anytime</span>
        </div>
      </div>

      {/* demo card (overlaps the hero seam) + benefits row */}
      <div style={{ background: '#fff', padding: mobile ? `0 ${px}px 44px` : '0 40px 56px' }}>
        <LandingDemo mobile={mobile} />
        <div style={{ textAlign: 'center', fontSize: mobile ? 13.5 : 14.5, color: color.muted, marginTop: mobile ? 12 : 16 }}>
          A real job — RFQ to sent quote — start to finish.
        </div>

        <div style={{ maxWidth: 1080, margin: mobile ? '28px auto 0' : '40px auto 0', display: mobile ? 'flex' : 'grid', flexDirection: mobile ? 'column' : undefined, gridTemplateColumns: mobile ? undefined : 'repeat(3,1fr)', gap: mobile ? 12 : 18 }}>
          {[['la-calculator', 'Accurate costing', "Priced from your shop's own rates — labor, material, burn, margin. Not guesswork."],
            ['la-file-invoice', 'RFQ processing', "Drop in the customer's RFQ spreadsheet or PDF — part, material, qty pre-filled."],
            ['la-tasks', 'Job status tracker', 'Every quote tracked draft → sent → opened → won. Know what to chase.']].map(([icon, t, d]) => (
            <div key={t} style={{ padding: mobile ? 22 : 26, borderRadius: 18, background: TINT }}>
              <i className={`las ${icon}`} aria-hidden="true" style={{ fontSize: mobile ? 28 : 30, color: ACCENT }} />
              <h4 style={{ fontFamily: heading, fontWeight: 700, fontSize: mobile ? 17 : 18, color: DK, margin: mobile ? '10px 0 5px' : '12px 0 6px' }}>{t}</h4>
              <p style={{ fontSize: 14.5, color: SUB, lineHeight: 1.5, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* three steps */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: mobile ? `44px ${px}px` : '64px 40px' }}>
        <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: ACCENT, letterSpacing: '.1em', marginBottom: 6 }}>GET SET UP ONCE</div>
        <h2 style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 26 : 30, color: DK, margin: '0 0 22px' }}>Three steps to your first quote</h2>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap: mobile ? 12 : 18 }}>
          {[['1', 'Sign up free', "No card, no sales call. You're in the app in under a minute."],
            ['2', 'Set your rates', 'Your labor, materials, and margin — entered once, reused on every quote.'],
            ['3', 'Quote in minutes', 'Enter the job; get a branded PDF that wins work and protects margin.']].map(([n, t, d]) => (
            <div key={n} style={{ padding: 26, borderRadius: 18, background: TINT }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: ACCENT, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{n}</div>
              <h4 style={{ fontFamily: heading, fontWeight: 700, fontSize: 18, color: DK, margin: '0 0 6px' }}>{t}</h4>
              <p style={{ fontSize: 14.5, color: SUB, lineHeight: 1.5, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>

      {/* founding partner beta — stands in for the pricing page during beta */}
      <div style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, padding: mobile ? `48px ${px}px` : '58px 40px' }} data-testid="founding-beta">
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: mobile ? 'left' : 'center', color: '#fff' }}>
          <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: '#AFC0FF', letterSpacing: '.12em', marginBottom: 14 }}>FOUNDING PARTNER BETA</div>
          <h2 style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 26 : 30, margin: '0 0 12px', letterSpacing: '-.5px' }}>Free while we build it with you</h2>
          <p style={{ fontSize: 16.5, color: '#C7C8E0', lineHeight: 1.6, maxWidth: 640, margin: mobile ? '0 0 24px' : '0 auto 26px' }}>
            We're onboarding a small group of fab and welding shops as founding partners.
            Use QuoteFoundry free during the beta and help shape it. When it becomes paid,
            founding shops keep a locked founding price — forever.
          </p>
          <div style={{ display: 'flex', gap: mobile ? 10 : 18, justifyContent: mobile ? 'flex-start' : 'center', flexDirection: mobile ? 'column' : 'row', flexWrap: 'wrap', fontSize: 14.5, color: '#C7C8E0', marginBottom: 26 }}>
            <span><i className="las la-check" style={{ color: color.panelAccentText }} /> Free during beta</span>
            <span><i className="las la-check" style={{ color: color.panelAccentText }} /> Founding price locked forever</span>
            <span><i className="las la-check" style={{ color: color.panelAccentText }} /> Flat per-shop — no per-user fees, ever</span>
          </div>
          <button onClick={onStart} data-testid="beta-cta" style={{ fontFamily: heading, fontWeight: 700, fontSize: mobile ? 16.5 : 15.5, padding: mobile ? '0 28px' : '14px 28px', height: mobile ? 58 : undefined, width: mobile ? '100%' : undefined, borderRadius: mobile ? 16 : 13, background: CTA, color: '#fff', border: 'none', cursor: 'pointer' }}>
            Become a founding partner
          </button>
        </div>
      </div>

      {/* footer — links the crawlable guides */}
      <div style={{ padding: mobile ? `24px ${px}px` : '30px 40px', display: 'flex', alignItems: mobile ? 'flex-start' : 'center', gap: mobile ? 12 : 24, flexDirection: mobile ? 'column' : 'row', flexWrap: 'wrap', borderTop: `1px solid ${color.border}`, fontSize: 13.5, color: color.muted }}>
        <span style={{ fontFamily: heading, fontWeight: 700, color: SUB }}>QuoteFoundry</span>
        <a href="/guides/how-to-price-a-fabrication-job.html" style={{ color: color.muted }}>How to price a fabrication job</a>
        <a href="/guides/free-fabrication-quote-template.html" style={{ color: color.muted }}>Free quote template</a>
        <span style={{ marginLeft: 'auto' }}>Built for US metal fab &amp; welding job shops</span>
      </div>
    </div>
  );
}
