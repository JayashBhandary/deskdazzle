import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { loadCore } from './lib/wasm';

// Offline/PWA support is provided by vite-plugin-pwa, which auto-injects the
// service-worker registration at build time (see vite.config.js).

// Eagerly fetch + instantiate the Rust/WASM core on first page load so every
// tool is instant afterwards; the service worker precaches the .wasm, making
// all later visits fully offline.
loadCore().catch((err) => console.error('wasm core failed to load', err));
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);