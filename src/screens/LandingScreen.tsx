// ============================================================================
// LandingScreen.tsx — the public marketing page (from the QuoteForge mockup).
// "Start free" → sign-up, "Log in" → login. In the no-auth demo, either path
// just drops you into the app.
// ============================================================================
import { heading } from '../app/ui';

const DK = '#042C53';
const BLUE = '#185FA5';
const GREEN = '#0F6E56';

export function LandingScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', background: '#fff', color: '#1C1D21', fontFamily: "'Source Sans 3', sans-serif" }} data-screen="landing">
      {/* nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 40px', background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #EAECF1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: heading, fontWeight: 900, fontSize: 19, color: DK }}>
          <i className="las la-bolt" style={{ color: BLUE, fontSize: 24 }} />QuoteForge
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <a onClick={onLogin} data-testid="landing-login" style={{ fontSize: 14.5, color: '#5A6473', cursor: 'pointer' }}>Sign in</a>
          <button onClick={onStart} data-testid="landing-start" style={{ fontFamily: heading, fontWeight: 700, fontSize: 14, padding: '9px 20px', borderRadius: 11, background: BLUE, color: '#fff', border: 'none', cursor: 'pointer' }}>Start free</button>
        </div>
      </div>

      {/* hero */}
      <div style={{ background: 'linear-gradient(180deg,#E6F1FB,#F4F9FE)', padding: '72px 40px 64px', textAlign: 'center' }}>
        <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: BLUE, letterSpacing: '.12em', marginBottom: 16 }}>BUILT FOR METAL FAB &amp; WELDING SHOPS</div>
        <h1 style={{ fontFamily: heading, fontWeight: 900, fontSize: 46, lineHeight: 1.08, color: DK, margin: '0 auto 18px', maxWidth: 760, letterSpacing: '-1px' }}>Quote structural steel jobs in 10 minutes, not all afternoon</h1>
        <p style={{ fontSize: 18, color: '#0C447C', lineHeight: 1.55, maxWidth: 560, margin: '0 auto 30px' }}>Stop losing jobs to slow quotes and margin to forgotten costs. Enter the job, get a branded quote, win more work.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={onStart} style={{ fontFamily: heading, fontWeight: 700, fontSize: 16, padding: '15px 30px', borderRadius: 13, background: GREEN, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 14px 28px -12px rgba(15,110,86,.6)' }}>
            <i className="las la-arrow-right" style={{ fontSize: 19 }} />Quote your first job free
          </button>
          <button onClick={onLogin} style={{ fontFamily: heading, fontWeight: 700, fontSize: 15, padding: '15px 24px', borderRadius: 13, background: '#fff', color: BLUE, border: '1.5px solid #B9D3EC', cursor: 'pointer' }}>Log in</button>
        </div>
        <div style={{ fontSize: 13.5, color: '#0C447C', marginTop: 22, display: 'flex', gap: 22, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span><i className="las la-check" style={{ color: GREEN }} /> No credit card</span>
          <span><i className="las la-check" style={{ color: GREEN }} /> Live in 15 minutes</span>
          <span><i className="las la-check" style={{ color: GREEN }} /> Cancel anytime</span>
        </div>
      </div>

      {/* three steps */}
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 40px' }}>
        <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: BLUE, letterSpacing: '.1em', marginBottom: 6 }}>GET SET UP ONCE</div>
        <h2 style={{ fontFamily: heading, fontWeight: 900, fontSize: 30, color: DK, margin: '0 0 28px' }}>Three steps to your first quote</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {[['1', 'Sign up free', "No card, no sales call. You're in the app in under a minute."],
            ['2', 'Set your rates', 'Your labor, materials, and margin — entered once, reused on every quote.'],
            ['3', 'Quote in minutes', 'Enter the job; get a branded PDF that wins work and protects margin.']].map(([n, t, d]) => (
            <div key={n} style={{ padding: 26, borderRadius: 18, background: '#E6F1FB' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: BLUE, color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{n}</div>
              <h4 style={{ fontFamily: heading, fontWeight: 700, fontSize: 18, color: DK, margin: '0 0 6px' }}>{t}</h4>
              <p style={{ fontSize: 14.5, color: '#0C447C', lineHeight: 1.5, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
