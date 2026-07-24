import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Migrated from Create React App to Vite. JSX lives in `.jsx` files; plain
// logic/config stays in `.js`. The Rust→WASM core (core/pkg) and shadcn/ui
// components are TypeScript — Vite transpiles both side by side.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not 'autoUpdate'): for an always-open desktop app, silently
      // swapping the service worker mid-session can break the running tab. We
      // surface a "new version — reload" toast instead (see PwaUpdatePrompt).
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png'],
      manifest: {
        // `id` pins the app's identity independent of start_url, so changing
        // start_url later never spawns a "new" installed app.
        id: '/',
        short_name: 'Desk Dazzle',
        name: 'Desk Dazzle — offline-first workspace',
        description:
          'Offline-first productivity suite — Office, PDF, Notes, Tasks and a file Drive, powered by an on-device Rust → WebAssembly core. No backend; optional sync.',
        // Open the installed app straight into the Workspace surface.
        start_url: '/workspace',
        scope: '/',
        display: 'standalone',
        // Prefer a chromeless window where supported, fall back to standalone.
        display_override: ['standalone', 'minimal-ui'],
        // Focus/reuse an already-open window instead of spawning another.
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        orientation: 'any',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'utilities', 'business'],
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        icons: [
          { src: 'favicon.ico', sizes: '64x64 32x32 24x24 16x16', type: 'image/x-icon' },
          { src: 'logo192.png', type: 'image/png', sizes: '192x192', purpose: 'any' },
          { src: 'logo512.png', type: 'image/png', sizes: '512x512', purpose: 'any' },
          // Maskable variant so Android draws the icon inside its adaptive mask
          // instead of letterboxing it on a white plate.
          { src: 'maskable_icon_x192.png', type: 'image/png', sizes: '192x192', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Workspace', short_name: 'Workspace', url: '/workspace' },
          { name: 'All apps', short_name: 'Apps', url: '/apps' },
          { name: 'Documentation', short_name: 'Docs', url: '/docs' },
          { name: 'Settings', short_name: 'Settings', url: '/settings' },
        ],
        // OS "Open with DeskDazzle" for office/PDF files. The browser launches
        // the app at `action`, then delivers the file handles to the in-app
        // `launchQueue` consumer (src/components/FileHandler.jsx), which reads
        // the bytes on-device and routes them to the owning app. `action` points
        // at /workspace (not an app route) so the target app fresh-mounts and
        // imports reliably — see FileHandler for the rationale.
        file_handlers: [
          {
            action: '/workspace',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
          {
            action: '/workspace',
            accept: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls', '.xlsb'],
              'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
              'text/csv': ['.csv'],
            },
          },
          {
            action: '/workspace',
            accept: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
            },
          },
          {
            action: '/workspace',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
        // Android/desktop share sheet → "Share to DeskDazzle" for text/links.
        // GET keeps it SW-free: the browser navigates to the notes route with
        // the shared fields as query params, which NotesApp turns into a note.
        share_target: {
          action: '/note-taking',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        // Install-dialog previews. `wide` drives the richer desktop install card
        // (Chrome/Edge); `narrow` the mobile sheet. First of each form_factor
        // shows largest, so lead with the signature Workspace surface.
        screenshots: [
          { src: 'screenshots/desktop-workspace.png', sizes: '1865x956', type: 'image/png', form_factor: 'wide', label: 'Your widget workspace' },
          { src: 'screenshots/desktop-excel.png', sizes: '1865x956', type: 'image/png', form_factor: 'wide', label: 'Real spreadsheets, on-device' },
          { src: 'screenshots/mobile-workspace.png', sizes: '402x864', type: 'image/png', form_factor: 'narrow', label: 'Works offline, on any device' },
          { src: 'screenshots/mobile-today.png', sizes: '402x864', type: 'image/png', form_factor: 'narrow', label: 'One agenda across everything' },
        ],
      },
      workbox: {
        // Precache the shell *including the wasm core* so every tool keeps
        // working with no network after the first visit.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Don't let the SPA fallback swallow Firebase's reserved paths — the
        // Auth OAuth helper lives at /__/auth/handler and must hit Hosting, not
        // be served the cached app shell (otherwise sign-in silently breaks).
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Rust/WASM output generated by wasm-pack into core/pkg (prebuilt +
      // committed, so plain `npm run build` needs no Rust toolchain).
      '@core': path.resolve(__dirname, './core/pkg'),
      // Second, independent WASM module: office document engine (docx/xlsx).
      // Built via `npm run wasm:office`, also prebuilt + committed.
      '@office': path.resolve(__dirname, './office/pkg'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
