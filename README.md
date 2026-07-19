<div align="center">

<a href="https://deskdazzle.web.app/">
  <img src="./public/logo512.png" alt="DeskDazzle logo" width="128" height="128" />
</a>

# Desk Dazzle — Your Swiss-Army-Knife Web App

### 🚀 [**deskdazzle.web.app**](https://deskdazzle.web.app/)

**Version 0.2.0** · by Jayash Bhandary

</div>

---

## Description

**Desk Dazzle** is an offline-first, all-in-one "swiss army knife" web app. It
opens instantly, installs as a PWA, and keeps working with **no network**: the
heavy lifting (markdown rendering, data conversion, full-text search,
natural-language task parsing) runs in a **Rust → WebAssembly core** on your
device, wrapped in a clean **shadcn/ui + Tailwind CSS v4** interface. Sign in
with Firebase (when online) to sync your to-dos, theme and desktop layout
across devices — everything else never leaves your machine.

---

## Features

- **Offline-first PWA** — the app shell *and* the WASM core are precached by
  the service worker (Workbox via `vite-plugin-pwa`). After the first visit,
  every on-device tool works with zero connectivity.
- **Rust → WebAssembly core** (~540 KB, loaded eagerly on first page load):
  - **Data Converter** — Markdown→HTML, CSV→JSON, JSON↔YAML, Base64 and
    URL encode/decode, run in a Web Worker so big inputs never block the UI.
  - **Markdown Previewer** — rendered by the Rust core (pulldown-cmark),
    sanitized with DOMPurify.
  - **Full-text search** — the ⌘K command palette searches your notes and
    to-dos with the Rust search engine, instantly, offline.
  - **Tasks** — a full task manager: projects, subtasks, a drag-and-drop
    kanban board, natural-language quick-add
    (`pay rent friday !high #finance every month`), automatic
    Overdue/Today/Upcoming/Someday buckets, and recurring tasks whose next
    occurrence is computed in Rust.
  - **Image Resizer / Optimizer / Batch Converter** — transcode + resize
    PNG/JPEG/WebP via OffscreenCanvas in the worker (Canvas fallback), single
    files or whole batches zipped for download. 100% on-device.
- **Study & planning suite** — markdown **Notes** with `[[wiki links]]`,
  backlinks and instant search; **Flashcards** with SM-2 spaced repetition;
  a **Pomodoro** focus timer with daily stats; and a **Roadmap Planner** with
  startup / research-paper / exam-prep templates.
- **Cross-tab sync & backup** — open tabs stay in sync over BroadcastChannel,
  a now-playing **Media widget** mirrors audio (e.g. Text-to-Speech) across
  tabs with remote play/pause, and the whole workspace exports/imports as a
  single JSON file from the Profile page.
- **shadcn/ui + Tailwind CSS v4** interface — consistent, accessible,
  keyboard-first, with dark/light themes.
- **Desktop workspace** — draggable widget windows (clock, to-dos, notes,
  calculator, weather) whose layout is saved to your account.
- **Firebase (online-optional)** — sign up / log in to sync to-dos, profile,
  theme and desktop layout via the Realtime Database. When offline, the app
  keeps working locally and network-only tools (Weather, Translation, Currency
  rates, URL Shortener, Recipe Finder) show a friendly offline state.
- Plus the classic toolbox: QR codes, password generator, text encryptor,
  color picker, gradient generator, unit converter, calculator, calendar,
  budget tracker, text-to-speech, notes and more.

---

## Tech stack

| Layer | Choice |
|------|--------|
| Build | Vite + React 19 (JSX app code, TS libraries) |
| UI | shadcn/ui + Tailwind CSS v4 + lucide-react + sonner |
| Core logic | Rust → WebAssembly (`wasm-bindgen` + `wasm-pack`), prebuilt into `core/pkg` |
| Offline | `vite-plugin-pwa` (Workbox) — full precache incl. the `.wasm` |
| Cloud (optional) | Firebase Auth + Realtime Database + Hosting |

### What runs where

**Rust core (`/core`)** — task model + natural-language quick-add parser,
smart-view bucketing, recurrence date math, cross-document full-text search,
and the text/data conversions. Prebuilt WASM is committed at `core/pkg`, so
`npm run build` needs **no Rust toolchain**.

**JS/React** — rendering, routing, Firebase sync, Canvas image work, and
browser APIs. Conversions and image processing run in a Web Worker.

---

## Getting started

### Prerequisites

- **Node.js** ≥ 20 and npm
- *(Optional, only to rebuild the WASM core)* Rust toolchain + `wasm-pack`:

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
npm run build      # bundles to dist/ (uses the committed core/pkg wasm)
npm run preview    # serve the production build — install it, then go offline
```

### Rebuild the Rust core (optional)

```bash
npm run wasm       # wasm-pack build core --target web → core/pkg
```

### Deploy

```bash
npm run deploy     # npm run build && firebase deploy
```

---

## Keyboard shortcuts

`⌘K` / `Ctrl-K` command palette (tools **and** your content) · `T` theme ·
`?` shortcut help · `G` then `H`/`A`/`D` to jump to Workspace/Apps/Docs.

## Offline & data

After the first load the service worker precaches everything, including the
WASM core — tasks, notes, converters, markdown, search and image tools all
work with the network off. Notes live in local storage; to-dos, profile,
theme and desktop layout sync through Firebase **when you're signed in and
online**, and fall back to local state otherwise.

## Contributing

Contributions are welcome! Open an issue or submit a pull request.

## License

MIT — see the LICENSE file.
