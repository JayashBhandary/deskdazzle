import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { loadCore } from './lib/wasm';
import { logger } from './lib/logger';

// Offline/PWA support is provided by vite-plugin-pwa, which auto-injects the
// service-worker registration at build time (see vite.config.js).

// Prefetch + instantiate the Rust/WASM core so tools are instant on first use,
// but do it during idle time rather than on the critical path — every `core.*`
// call already awaits loadCore() itself, so nothing breaks if a tool is used
// before this finishes. The service worker precaches the .wasm for offline use.
const prefetchCore = () =>
  loadCore().catch((err) => logger.error('wasm core failed to load', err));
if (typeof requestIdleCallback === 'function') requestIdleCallback(prefetchCore);
else setTimeout(prefetchCore, 1);
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);