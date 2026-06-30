// App.tsx — boots the data layer (mock in dev, live in Stage 8) then renders
// the app shell. Auth screens layer in alongside this in a later pass; for the
// daily-loop build the dev bootstrap signs in a demo shop.
import { useEffect, useState } from 'react';
import { color, font } from './design/tokens';
import { devBootstrap } from './app/devBootstrap';
import { AppShell } from './app/AppShell';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    devBootstrap().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: color.appBg, color: color.muted, fontFamily: `${font.body}, sans-serif` }}>
        Loading QuoteForge…
      </div>
    );
  }
  return <AppShell shopName="Ironside Fabrication" />;
}
