// ============================================================================
// LandingDemo.tsx — the overlapping "browser-frame" product demo on the landing
// page (Landing v2 handoff). A lightweight CSS-animated stand-in for a produced
// video: it loops RFQ-drop → fields fill → price builds → sent → opened.
//
// Honesty notes (CLAUDE.md §8 — never overpromise):
//  · The dollar figures are an illustrative marketing mock, NOT computeQuote()
//    output. They must never be read as canonical pricing.
//  · The "Watch full demo" pill renders ONLY when a real `demoVideoUrl` is
//    supplied — no dead link, no "55s video" promise until one exists.
//
// Motion (a11y): every animated node's BASE style is the completed final frame;
// keyframes in global.css animate up to it and loop. prefers-reduced-motion
// freezes the loop on that finished frame (see `.qf-demo-stage` guard).
// Desktop autoplays; mobile shows a poster and plays in place on tap.
// ============================================================================
import { useState, useRef, useEffect } from 'react';
import { heading } from '../app/ui';
import { color } from '../design/tokens';
import { demoVideo } from '../app/demoVideo';

const DUR = '5s';
const anim = (name: string): React.CSSProperties => ({ animation: `${name} ${DUR} linear infinite` });

const CTA = color.accent;
const DK = color.panelFrom;
const SUB = color.body;

function TrafficDots({ size }: { size: number }) {
  const dot = (bg: string): React.CSSProperties => ({ width: size, height: size, borderRadius: '50%', background: bg });
  return (
    <>
      <span style={dot(color.dangerDot)} />
      <span style={dot(color.warnBorder)} />
      <span style={dot(color.panelAccentText)} />
    </>
  );
}

// The animated stage — the "money frame". Reused for desktop autoplay and the
// mobile tap-to-play state; `mobile` only tunes geometry, never the timing.
function Stage({ mobile }: { mobile: boolean }) {
  const fieldRow = (label: string, valueAnim: string, value: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      <span style={{ fontSize: 12.5, color: color.muted, fontWeight: 600 }}>{label}</span>
      <div style={{ height: mobile ? 38 : 44, border: `1px solid ${color.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 14px', fontSize: mobile ? 13.5 : 15, color: color.ink, background: '#fff', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={anim(valueAnim)}>{value}</span>
      </div>
    </div>
  );
  const costRow = (rowAnim: string, label: string, amount: string, accent?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: mobile ? 13 : 14.5, color: '#C7C8E0', ...anim(rowAnim) }}>
      <span>{label}</span>
      <span style={{ fontFamily: heading, fontWeight: 700, color: accent ? color.panelAccentText : '#fff' }}>{amount}</span>
    </div>
  );

  return (
    <div className="qf-demo-stage" role="img" aria-label="Product demo: a customer RFQ auto-fills the job fields, the price builds from the shop's own rates, and the quote is sent and opened." style={{ position: 'relative', height: mobile ? 340 : 574, background: color.appBg, overflow: 'hidden' }}>
      {/* editor mock */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, padding: mobile ? '16px' : '26px 30px', display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 18 }}>
        {/* editor top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 8 : 14 }}>
          <div style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 14 : 20, color: DK, whiteSpace: 'nowrap' }}>Q-2026-051 · Structural brackets</div>
          {!mobile && <div style={{ fontSize: 14, color: color.muted }}>Ironline Fabrication</div>}
          {/* status pill crossfade: Draft → Sent → Opened */}
          <div style={{ position: 'relative', marginLeft: 'auto', width: 96, height: 28 }}>
            {[
              ['qfPillDraft', 'Draft', '#ECECF4', SUB, 1],
              ['qfPillSent', 'Sent', '#EEF1FF', color.accentDeep, 0],
              ['qfPillOpened', 'Opened ✓', color.successBg, color.success, 1],
            ].map(([a, label, bg, fg, base]) => (
              <span key={label as string} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: bg as string, color: fg as string, fontWeight: 600, fontSize: 12.5, opacity: base as number, ...anim(a as string) }}>{label as string}</span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.25fr 1fr', gap: mobile ? 12 : 18, flex: 1, minHeight: 0 }}>
          {/* left: job fields */}
          <div style={{ background: '#fff', border: `1px solid ${color.border}`, borderRadius: 14, padding: mobile ? 14 : 22, display: 'flex', flexDirection: 'column', gap: mobile ? 10 : 14, position: 'relative' }}>
            <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: color.muted, letterSpacing: '.08em' }}>JOB DETAILS</div>
            {fieldRow('Part', 'qfFill1', 'Structural brackets — welded, drilled')}
            {fieldRow('Material', 'qfFill2', 'A36 steel — 240 lb')}
            <div style={{ display: 'flex', gap: 12 }}>
              {fieldRow('Qty', 'qfFill3', '1')}
              {fieldRow('Labor hrs', 'qfFill3', '8.5')}
            </div>
            {/* RFQ file-drop chip (scene 1) */}
            <div style={{ position: 'absolute', top: mobile ? 44 : 54, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: DK, color: '#fff', fontSize: 13.5, fontWeight: 600, padding: '9px 16px', borderRadius: 11, boxShadow: '0 12px 26px -10px rgba(28,29,43,.6)', whiteSpace: 'nowrap', opacity: 0, ...anim('qfDrop') }}>
              <i className="las la-file-invoice" style={{ fontSize: 17, color: color.panelAccentText }} /> RFQ_ironline.xlsx
            </div>
          </div>

          {/* right: dark cost panel */}
          <div style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, borderRadius: 14, padding: mobile ? 14 : 22, color: '#fff', display: 'flex', flexDirection: 'column', gap: mobile ? 8 : 12 }}>
            <div style={{ fontFamily: heading, fontWeight: 700, fontSize: 13, color: '#AFC0FF', letterSpacing: '.08em' }}>COST SUMMARY</div>
            {costRow('qfRow1', 'Material — A36, 240 lb', '$412')}
            {costRow('qfRow2', 'Labor — 8.5 hrs @ $80', '$680')}
            {costRow('qfRow3', 'Consumables + burn', '$168')}
            <div style={{ height: 1, background: 'rgba(255,255,255,.14)' }} />
            {costRow('', 'Margin 18%', '+$226', true)}
            <div style={{ marginTop: 'auto', ...anim('qfTotal') }}>
              <div style={{ fontSize: 13, color: '#AFC0FF', marginBottom: 4 }}>QUOTED PRICE</div>
              <div style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 30 : 44, letterSpacing: '-1px' }}>$1,486</div>
            </div>
          </div>
        </div>
      </div>

      {/* burned-in captions */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 20, height: 40, pointerEvents: 'none' }}>
        {[
          ['qfCap1', 'A customer RFQ just landed — fields filled, no retyping.'],
          ['qfCap2', 'Your rates. Your labor. Watch the price build itself.'],
          ['qfCap3', "Sent — and you'll know when they open it."],
        ].map(([a, text]) => (
          <span key={a} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis', background: 'rgba(43,45,66,.82)', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: mobile ? 12.5 : 16.5, padding: '9px 20px', borderRadius: 999, opacity: 0, ...anim(a) }}>{text}</span>
        ))}
      </div>

      {/* end card */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center', padding: 24, opacity: 0, ...anim('qfEndCard') }}>
        <i className="las la-bolt" style={{ fontSize: mobile ? 40 : 54, color: CTA }} />
        <div style={{ fontFamily: heading, fontWeight: 900, fontSize: mobile ? 22 : 34, color: '#fff', letterSpacing: '-.5px' }}>Your rates. Your quote. Under 10 minutes.</div>
        <div style={{ fontSize: mobile ? 14 : 16.5, color: '#C7C8E0' }}>Start free — no card</div>
      </div>

      {/* loop progress */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: 0, background: CTA, ...anim('qfProgress') }} />
    </div>
  );
}

// The produced 55s video. `autoplay` (desktop) plays only while on-screen via an
// IntersectionObserver — the "network diet" from doc 09; mobile mounts this only
// after a tap. If the source 404s (not yet encoded), onError bubbles up so the
// caller can fall back to the CSS animation. Always muted+loop → poster-until-play.
function VideoPlayer({ mobile, autoplay, onError }: { mobile: boolean; autoplay: boolean; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!autoplay) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }),
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [autoplay]);
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      controls={!autoplay}
      poster={demoVideo.poster}
      onError={onError}
      data-testid="demo-video"
      aria-label="QuoteFoundry product demo — a real job quoted from RFQ to sent, at 2× speed"
      style={{ display: 'block', width: '100%', height: mobile ? 216 : 574, objectFit: 'cover', background: color.appBg, border: 'none' }}
    >
      <source src={demoVideo.webm} type="video/webm" />
      <source src={demoVideo.mp4} type="video/mp4" />
    </video>
  );
}

export function LandingDemo({ mobile, demoVideoUrl }: { mobile: boolean; demoVideoUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const useVideo = demoVideo.enabled && !videoFailed;
  const chromeDot = mobile ? 9 : 11;

  return (
    <div
      role="region"
      aria-label="QuoteFoundry product demo"
      data-testid="landing-demo"
      style={{
        maxWidth: mobile ? undefined : 960,
        margin: mobile ? '-110px auto 0' : '-260px auto 0',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#fff',
        border: `1px solid ${color.border}`,
        boxShadow: '0 32px 70px -28px rgba(28,29,43,.4)',
        position: 'relative',
      }}
    >
      {/* browser chrome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: mobile ? '9px 12px' : '11px 16px', background: color.appBg, borderBottom: `1px solid ${color.border}` }}>
        <TrafficDots size={chromeDot} />
        <span style={{ margin: '0 auto', fontSize: mobile ? 11 : 12.5, color: color.muted, background: '#fff', border: `1px solid ${color.border}`, borderRadius: 7, padding: mobile ? '2px 10px' : '3px 14px' }}>
          <i className="las la-lock" style={{ fontSize: 11 }} /> app.quotefoundry.app
        </span>
        <span style={{ width: mobile ? 30 : 55 }} />
      </div>

      {/* Desktop: play the produced video in-place (falls back to the CSS
          animation if the asset isn't encoded yet). Mobile shows a poster until
          tapped, then plays the video (or animation) in place. */}
      {!mobile && useVideo ? (
        <VideoPlayer mobile={false} autoplay onError={() => setVideoFailed(true)} />
      ) : mobile && playing ? (
        useVideo
          ? <VideoPlayer mobile autoplay={false} onError={() => setVideoFailed(true)} />
          : <Stage mobile />
      ) : mobile && !playing ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          data-testid="demo-play"
          aria-label="Play the QuoteFoundry demo"
          style={{ display: 'block', width: '100%', position: 'relative', height: 216, border: 'none', cursor: 'pointer', padding: 0, background: 'linear-gradient(150deg,#14152A 0%,#1C1D2B 55%,#231820 100%)', overflow: 'hidden' }}
        >
          {/* mini app window — the final "Opened" frame */}
          <div aria-hidden="true" style={{ position: 'absolute', left: 22, right: 22, top: 38, bottom: -26, borderRadius: '12px 12px 0 0', background: color.appBg, boxShadow: '0 24px 60px -18px rgba(8,9,20,.85)', overflow: 'hidden' }}>
            <div style={{ height: 26, display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px', background: '#fff', borderBottom: `1px solid ${color.border}` }}>
              <TrafficDots size={7} />
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 600, color: color.success, background: color.successBg, borderRadius: 6, padding: '2px 8px' }}><i className="las la-eye" style={{ fontSize: 10 }} />Opened</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 8, padding: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {['Structural brackets — welded', 'A36 steel — 240 lb', '8.5 labor hrs @ $80'].map((t) => (
                  <div key={t} style={{ height: 22, border: `1px solid ${color.border}`, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 9.5, color: SUB, whiteSpace: 'nowrap', overflow: 'hidden' }}>{t}</div>
                ))}
              </div>
              <div style={{ background: `linear-gradient(160deg,${color.panelFrom},${color.panelTo})`, borderRadius: 8, padding: '10px 12px', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 8.5, color: '#AFC0FF', letterSpacing: '.06em', marginBottom: 2 }}>QUOTED PRICE</div>
                <div style={{ fontFamily: heading, fontWeight: 900, fontSize: 26, letterSpacing: '-.5px' }}>$1,486</div>
              </div>
            </div>
          </div>
          {/* play affordance */}
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 72, height: 72, borderRadius: '50%', background: CTA, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 40px -10px rgba(8,9,20,.9)' }}><i className="las la-play" style={{ fontSize: 30, color: '#fff', marginLeft: 4 }} /></span>
          </span>
        </button>
      ) : (
        <Stage mobile={mobile} />
      )}

      {/* Watch full demo — only when a produced video actually exists (A2). */}
      {demoVideoUrl && (
        <a
          href={demoVideoUrl}
          data-testid="demo-watch-full"
          aria-label="Watch the full demo video"
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 5, display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(28,29,43,.88)', color: '#fff', fontFamily: heading, fontWeight: 700, fontSize: 14, padding: '10px 18px 10px 12px', borderRadius: 999, textDecoration: 'none' }}
        >
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#F0A45B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="las la-play" style={{ fontSize: 13, color: color.panelTo, marginLeft: 2 }} /></span>
          Watch full demo
        </a>
      )}
    </div>
  );
}
