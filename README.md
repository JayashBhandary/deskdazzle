<div align="center">

<a href="https://deskdazzle.web.app/">
  <img src="./public/logo512.png" alt="Desk Dazzle logo" width="128" height="128" />
</a>

# Desk Dazzle — Your Swiss-Army-Knife Web App

### 🚀 [**deskdazzle.web.app**](https://deskdazzle.web.app/)

**Version 0.2.0** · by Jayash Bhandary

*An offline-first productivity suite — 20+ tools, a Rust → WebAssembly core, and no application backend.*

</div>

---

## What is it?

**Desk Dazzle** is an offline-first, install-as-a-PWA "swiss army knife" for the
browser. Documents, spreadsheets, notes, tasks, a file drive, study tools and a
draggable widget desktop — all in one app. The heavy lifting (office document
read/write, markdown, PDF, full-text search, natural-language parsing, image
transcoding) runs **on your device** in a **Rust → WebAssembly** core. There is
**no application server**: the only cloud piece is optional Firebase, used solely
to sync your own data across your own devices. Sign out and everything still
works locally.

- ⚡ **Instant + offline** — after the first visit, every on-device tool works
  with the network off.
- 🔒 **Private by default** — your files and notes stay on your machine; sync is
  opt-in and scoped to your account only.
- 🦀 **Rust-powered** — real document engines and a search/NLP core compiled to
  WASM, not thin wrappers around cloud APIs.

---

## Tools

**Office & documents**
- **Word** — write documents, save `.docx`, export PDF (on-device)
- **Excel** — open `.xlsx/.xls/.ods/.csv`, a real formula engine (~70 functions), save `.xlsx/.csv` or PDF
- **PowerPoint** — slide decks, save `.pptx` or PDF
- **PDF** — compose from text, merge, reorder / rotate / delete / extract pages
- **Drive** — file explorer with folders, `.zip` compress/extract and file conversion, isolated per workspace (stored in IndexedDB)

**Notes, tasks & study**
- **Notes** — markdown with `[[wiki links]]`, backlinks and instant full-text search (sanitized with DOMPurify)
- **Tasks** — projects, subtasks, drag-and-drop kanban, natural-language quick-add (`pay rent friday !high #finance every month`), auto Overdue/Today/Upcoming buckets, recurring tasks
- **Today** — one agenda across everything due today and this week
- **Flashcards** — SM-2 spaced repetition
- **Roadmap Planner** — goals → milestones → steps, with startup / research / exam templates

**Utilities**
- **Images** — resize, optimize, batch-convert PNG/JPEG/WebP (OffscreenCanvas in a worker)
- **Converters** — data formats + units (on-device), live currency rates (online)
- **Design** — color picker + CSS gradient builder
- **Vault** — CSPRNG password generator + **real AES-GCM text encryption** with your own passphrase (PBKDF2, 100% on-device)
- **QR Code**, **Calculator**, **Calendar**, **Budget Tracker**, **Clock** (world clock / alarms / stopwatch / timers / focus), **Text-to-Speech**
- **Weather** & **Translation** (online tools with a graceful offline state)

**Workspace**
- **Desktop** — draggable, resizable widget windows; layout saved to your account
- **Workspaces ("Spaces")** — multiple isolated workspaces, each with its own data and theme
- **⌘K command palette** — searches tools *and* your own content (notes, tasks) via the Rust search engine

---

## Architecture — no backend

```
Browser (the whole app)
├── React 19 + Vite + shadcn/ui + Tailwind v4       UI, routing, state
├── Rust → WASM  core/pkg    (pocketknife_core)      tasks, NLP quick-add,
│                                                    recurrence, search, converters
├── Rust → WASM  office/pkg  (office_core)           .docx/.xlsx/.pptx/.pdf read+write
├── IndexedDB                                        Drive file bytes
├── localStorage                                     all app state (offline truth)
└── Firebase (optional)   Auth · Realtime DB · Hosting   cross-device sync only
```

**What runs where**
- **`core/` (Rust)** — task model + natural-language parser, smart-view bucketing, recurrence math, cross-document full-text search, text/data conversions. Prebuilt WASM committed at `core/pkg` → `npm run build` needs **no Rust toolchain**.
- **`office/` (Rust)** — a second, independent WASM module: Word ↔ `.docx` (`docx-rs`), Excel ↔ `.xlsx/.xls/.ods/.csv` (`rust_xlsxwriter`, `calamine`), PowerPoint ↔ `.pptx` (OOXML over `zip`), PDF compose/edit (`pdf-writer`, `lopdf`), and PDF export from every office app. Committed at `office/pkg`, **lazy-loaded** only when an office app opens.
- **JS/React** — rendering, routing, Firebase sync, Canvas image work. Conversions and image processing run in a **Web Worker** so big inputs never block the UI.

---

## Security & privacy

Desk Dazzle has been through a production-readiness hardening pass:

- **Encryption that's real** — the Vault uses Web Crypto **AES-GCM + PBKDF2** with a user passphrase (no hardcoded keys); passwords use the **CSPRNG** (`crypto.getRandomValues`), not `Math.random`.
- **Strict response headers** — CSP (`frame-ancestors 'none'`, tight `connect-src`), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (`firebase.json`).
- **Database rules** — every user can read/write only their own `users/{uid}` node, with `.validate` schema + size caps and unknown-key rejection (`database.rules.json`). **App Check** wiring is ready (set `VITE_APPCHECK_SITE_KEY`).
- **Privacy & consent** — analytics is **off until you opt in** (GDPR/CCPA), there's a privacy policy page, and a **"Delete account & data"** action (right to erasure).
- **XSS defense-in-depth** — markdown is sanitized (DOMPurify, inline styles forbidden, `rel="noopener"` forced); imported backups and theme colors are validated before use.
- **Resilience** — global + per-route **Error Boundaries**, consent-gated error telemetry.

**Sync & conflicts** — collection stores use a **conflict-free per-item merge** (CRDT-style last-writer-wins with tombstones), so editing different items on two devices no longer silently loses one side.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Build | Vite 8 + React 19 (JSX app code, TS libraries) |
| UI | shadcn/ui + Tailwind CSS v4 + lucide-react + sonner |
| Core logic | Rust → WebAssembly (`wasm-bindgen` + `wasm-pack`) — `core/pkg` + `office/pkg` |
| Offline | `vite-plugin-pwa` (Workbox) — full precache incl. `.wasm`; update-on-prompt |
| Cloud (optional) | Firebase Auth + Realtime Database + Hosting + App Check |
| Tests | Vitest + Testing Library (jsdom) |

---

## Getting started

### Prerequisites
- **Node.js ≥ 20** and npm
- *(Optional, only to rebuild the WASM cores)* Rust + `wasm-pack`:
  ```bash
  rustup target add wasm32-unknown-unknown
  cargo install wasm-pack
  ```

### Install & run
```bash
git clone https://github.com/JayashBhandary/deskdazzle.git
cd deskdazzle
npm install
npm run dev        # dev server at http://localhost:3000
```

### Build & preview (PWA active here)
```bash
npm run build      # bundles to dist/ (uses the committed core/pkg + office/pkg wasm)
npm run preview    # serve the production build — install it, then go offline
```

### Test
```bash
npm test           # vitest (unit tests for crypto, sync-merge, formula engine, …)
```

### Rebuild the Rust cores (optional)
```bash
npm run wasm         # → core/pkg
npm run wasm:office  # → office/pkg
```

### Deploy
```bash
npm run deploy       # npm run build && firebase deploy
```

### Environment (optional, for hardening)
Copy `.env.example` → `.env.local` and set:
- `VITE_APPCHECK_SITE_KEY` — reCAPTCHA v3 site key to enable Firebase App Check.

---

## Configuration & deploy notes

- **RTDB rules** live in `database.rules.json` — deploy with `firebase deploy --only database`.
- **App Check** — register a reCAPTCHA v3 key in the Firebase console and set `VITE_APPCHECK_SITE_KEY`; without it App Check is skipped (fine for local dev).
- **Firebase config** — `src/firebaseConfig.js`; the web `apiKey` is public by design (pair it with App Check + API-key referrer restrictions in the Google Cloud console).

---

## Keyboard shortcuts

`⌘K` / `Ctrl-K` command palette (tools **and** your content) · `T` theme ·
`?` shortcut help · `G` then `H`/`A`/`D` → Workspace/Apps/Docs.

---

## Offline & data model

After the first load the service worker precaches everything (including the WASM
cores), so tasks, notes, converters, markdown, search, office and image tools
work with the network off. App state lives in **localStorage**; Drive file bytes
live in **IndexedDB**; to-dos, projects, theme, desktop layout and per-workspace
data **sync through Firebase only when signed in and online**, and fall back to
local state otherwise. Online-only tools (Weather, Translation, Currency) show a
friendly offline state.

---

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR: type-check
(`tsc --noEmit`) → tests (`vitest`) → build, plus an `npm audit` security gate.

---

## Contributing

Contributions welcome — open an issue or a pull request.

## License

MIT.
