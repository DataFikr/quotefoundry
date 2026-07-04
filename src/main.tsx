import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Error tracking — only when a DSN is configured (production). Dynamic import
// keeps Sentry out of the bundle for mock/dev/e2e runs.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
if (SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({ dsn: SENTRY_DSN, environment: 'production' });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
