import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Offline/PWA support is provided by vite-plugin-pwa, which auto-injects the
// service-worker registration at build time (see vite.config.js).
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);