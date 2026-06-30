// App.tsx — shell. Screens get wired in here from Stage 3 (auth) onward.
// Stage 0 placeholder so the scaffold builds and renders.
import { color, font } from './design/tokens';

export function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color.appBg,
        color: color.ink,
        fontFamily: `${font.body}, sans-serif`,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: `${font.heading}, sans-serif`,
            fontWeight: 900,
            fontSize: 32,
            color: color.accentDeep,
          }}
        >
          QuoteForge
        </div>
        <div style={{ color: color.muted, marginTop: 8 }}>
          Scaffold ready — screens wire in from Stage 4.
        </div>
      </div>
    </div>
  );
}
