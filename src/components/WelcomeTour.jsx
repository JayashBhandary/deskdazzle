import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

// First-run welcome carousel. Auto-shows once per browser (localStorage flag),
// then never again on its own — replay it anywhere by dispatching
// `deskdazzle:open-tour` (see Docs "Take the tour"). Curated highlights only;
// the full catalogue lives on /apps and /docs.
export const WELCOME_SEEN_KEY = 'deskdazzle:welcome-seen:v1';
export const OPEN_TOUR_EVENT = 'deskdazzle:open-tour';

function Kbd({ children }) {
  return (
    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
      {children}
    </kbd>
  );
}

// Each slide is a big glyph, a headline, a one-line pitch, and a few concrete
// highlights so a first-timer sees what's actually possible, not marketing.
const SLIDES = [
  {
    icon: '👋',
    title: 'Welcome to DeskDazzle',
    lead: 'Your swiss-army-knife web app — 20+ tools in one place, no install required.',
    points: [
      'Documents, spreadsheets, notes, tasks, a file drive and a widget desktop.',
      'The heavy lifting runs on your device (Rust → WebAssembly), not a server.',
      'Works on phone, tablet and desktop, in light or dark.',
    ],
  },
  {
    icon: '🖥️',
    title: 'Your Workspace',
    lead: 'The home screen is a desktop you arrange yourself.',
    points: [
      'Open widgets from the dock; drag title bars to move, drag edges to resize.',
      'It’s an infinite canvas — drag empty space to pan, zoom with the corner control.',
      <>Press <Kbd>1</Kbd>–<Kbd>9</Kbd> to pop open a widget instantly.</>,
    ],
  },
  {
    icon: '⌘',
    title: 'One shortcut to rule them all',
    lead: 'The command palette jumps you anywhere — and searches your own content.',
    points: [
      <>Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> (or <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>) anywhere.</>,
      'Find any tool, and search across your notes and tasks in one box.',
      <>Press <Kbd>Shift</Kbd> <Kbd>?</Kbd> to see every keyboard shortcut.</>,
    ],
  },
  {
    icon: '🧰',
    title: 'A real office, on your device',
    lead: 'Open and save genuine files — no upload, no cloud round-trip.',
    points: [
      'Word (.docx), Excel (.xlsx/.csv, ~70 formulas), PowerPoint (.pptx), export to PDF.',
      'PDF tools: merge, reorder, rotate, delete and extract pages.',
      'Drive: a file explorer with folders, .zip compress/extract and file conversion.',
    ],
  },
  {
    icon: '🗂️',
    title: 'Plan, study and create',
    lead: 'The everyday tools you reach for, all in one workspace.',
    points: [
      <>Tasks with natural-language quick-add — type <em>“pay rent friday !high #finance every month”</em>.</>,
      'Notes with [[wiki links]], backlinks and instant full-text search.',
      'Flashcards (spaced repetition), Roadmaps, Images, Converters, a Vault and more.',
    ],
  },
  {
    icon: '🔒',
    title: 'Private, offline, yours',
    lead: 'Your data stays with you. Signing in is optional.',
    points: [
      'Everything works offline after the first visit — install it as an app.',
      'Sign in with Google to sync across your devices; stay signed out to keep it all local.',
      <>Use <strong>Spaces</strong> for separate workspaces, and switch theme with <Kbd>T</Kbd>.</>,
    ],
  },
];

function WelcomeTour({ blocked = false }) {
  const [seen, setSeen] = useLocalStorage(WELCOME_SEEN_KEY, false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef(null);

  // Auto-open on first run, but only once the splash has cleared so the two
  // covers never stack.
  useEffect(() => {
    if (!seen && !blocked) setOpen(true);
  }, [seen, blocked]);

  // Replay from anywhere (Docs, help, etc.).
  useEffect(() => {
    const replay = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, replay);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, replay);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSeen(true); // never auto-show again, whether finished or skipped
  }, [setSeen]);

  const last = SLIDES.length - 1;
  const next = useCallback(() => {
    setStep((s) => (s >= last ? (close(), s) : s + 1));
  }, [last, close]);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Keyboard: Esc skips, arrows navigate. Move focus into the dialog on open.
  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, back, close]);

  if (!open) return null;

  const slide = SLIDES[step];
  const isLast = step === last;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Skip"
          className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Skip <X className="size-3.5" aria-hidden="true" />
        </button>

        <div className="flex flex-col gap-5 px-6 pb-6 pt-12 sm:px-8">
          <div
            className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-3xl"
            aria-hidden="true"
          >
            {slide.icon}
          </div>

          <div className="space-y-2">
            <h2 id="welcome-tour-title" className="text-xl font-semibold tracking-tight">
              {slide.title}
            </h2>
            <p className="text-sm text-muted-foreground">{slide.lead}</p>
          </div>

          <ul className="space-y-2 text-sm leading-6">
            {slide.points.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-4 border-t bg-muted/40 px-6 py-4 sm:px-8">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Tour progress">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setStep(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60',
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={back}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" asChild onClick={close}>
                <Link to="/apps">Explore the apps</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={next}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeTour;
