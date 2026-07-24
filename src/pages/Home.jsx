import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, WifiOff, Cpu, Command, Sparkles,
  NotebookPen, ListTodo, Lock, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openCommandPalette } from '@/components/Header';

// The landing page ('/'). A cold visitor lands here; the Workspace lives at
// '/workspace'. Structure borrows Notion's playbook — a centered hero over a
// framed product shot, then alternating text/image feature rows, an honest
// stat grid and a closing CTA — kept in the app's monochrome, theme-aware token
// set. Every claim is true of the shipped app (offline-first PWA, Rust→WASM
// office/PDF core, no application backend, opt-in sync). Screenshots are the
// real ones committed under public/screenshots/.

const GITHUB_URL = 'https://github.com/JayashBhandary/deskdazzle';

// A subtle faux-browser frame so landscape screenshots read as "product", not
// decoration (Notion frames its shots the same way).
function WindowFrame({ src, alt, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-xl border bg-card shadow-2xl ${className}`}>
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  );
}

function PhoneFrame({ src, alt }) {
  return (
    <div className="mx-auto w-[240px] max-w-full overflow-hidden rounded-[2rem] border-4 border-foreground/10 bg-card shadow-2xl">
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  );
}

// One alternating feature row: text on one side, framed visual on the other.
function FeatureRow({ eyebrow, title, body, points, children, reverse }) {
  return (
    <div className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
      <div className={reverse ? 'lg:order-2' : ''}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{body}</p>
        <ul className="mt-5 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? 'lg:order-1' : ''}>{children}</div>
    </div>
  );
}

const PILLARS = [
  { icon: NotebookPen, title: 'Notes that link', body: 'Markdown with [[wiki links]], backlinks and instant full-text search.' },
  { icon: ListTodo, title: 'Tasks & agenda', body: 'Natural-language quick-add, a kanban, recurring tasks and a Today view across everything.' },
  { icon: Lock, title: 'A real vault', body: 'AES-GCM text encryption and a CSPRNG password generator — 100% on your device.' },
];

const STATS = [
  { n: '20+', label: 'tools in one tab' },
  { n: '0', label: 'application servers' },
  { n: '100%', label: 'on-device processing' },
  { n: 'MIT', label: 'open-source core' },
];

function Home() {
  return (
    <div className="w-full">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Offline-first · Rust → WASM · No backend
        </span>

        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          The private, offline office
          <span className="block text-muted-foreground">that runs in your browser.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Edit documents, spreadsheets and PDFs — plus notes, tasks and a file
          drive — all in one installable web app. The heavy lifting happens on
          your device, so your files never leave it. Sign in only if you want to
          sync your own devices.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link to="/workspace">Open the workspace <ArrowRight className="size-4" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/apps">Browse all tools</Link>
          </Button>
          <Button variant="ghost" size="lg" onClick={openCommandPalette} className="gap-2 text-muted-foreground">
            <Command className="size-4" /> Search
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No sign-up required. Add it to your home screen and it works offline.
        </p>

        <WindowFrame
          src="/screenshots/desktop-workspace.png"
          alt="DeskDazzle workspace with draggable widgets"
          className="mx-auto mt-14 max-w-4xl"
        />
      </section>

      {/* Capability strip (honest stand-in for a logo carousel) */}
      <section className="border-y bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <span className="inline-flex items-center gap-2"><Shield className="size-4" /> No file ever uploaded</span>
          <span className="inline-flex items-center gap-2"><WifiOff className="size-4" /> Works fully offline</span>
          <span className="inline-flex items-center gap-2"><Cpu className="size-4" /> Rust → WebAssembly core</span>
          <span className="inline-flex items-center gap-2"><Lock className="size-4" /> Opt-in, account-scoped sync</span>
        </div>
      </section>

      {/* Alternating feature rows */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <FeatureRow
          eyebrow="Office & PDF"
          title="Real spreadsheets and documents — computed on your device"
          body="Not screenshots of a cloud app: an actual Rust engine reads and writes .docx, .xlsx, .pptx and PDF locally, with a ~70-function formula engine."
          points={[
            'Open, edit and export .docx / .xlsx / .pptx / PDF — nothing uploaded',
            'Merge, reorder, rotate and extract PDF pages',
            'Open office & PDF files straight from your desktop ("Open with DeskDazzle")',
          ]}
        >
          <WindowFrame src="/screenshots/desktop-excel.png" alt="Spreadsheet with a live formula engine" />
        </FeatureRow>

        <FeatureRow
          eyebrow="Anywhere, offline"
          title="Works on every device — even with the network off"
          body="Install it as an app on phone, tablet or desktop. After the first load the whole toolbox — including the WASM cores — is cached, so you keep working on a plane or behind a firewall."
          points={[
            'Installable PWA; add it to your home screen',
            'Every on-device tool runs with zero network',
            'Optional sync keeps your own devices in step (conflict-free)',
          ]}
          reverse
        >
          <PhoneFrame src="/screenshots/mobile-today.png" alt="DeskDazzle on mobile showing the Today agenda" />
        </FeatureRow>
      </div>

      {/* Pillar grid — the rest of the toolbox */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-muted/50">
                <Icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid grid-cols-2 gap-6 rounded-2xl border bg-muted/30 p-8 text-center sm:grid-cols-4 sm:p-12">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold tracking-tight sm:text-4xl">{s.n}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust / how it works */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Shield className="mx-auto mb-4 size-8 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Nothing leaves your device</h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Open the network tab and watch: parsing a spreadsheet or merging a PDF
            sends zero requests. Your data lives in your browser. Sync is opt-in
            and scoped to your account, and the Vault uses real AES-GCM encryption
            with your passphrase. Sign out and everything still works.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/workspace">Get started — it's free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> View the source
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
