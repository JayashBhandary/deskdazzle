import React from 'react'
import { Link } from 'react-router-dom';
import { TOOLS, SHORTCUT_GROUPS } from '../toolsData';
import { OPEN_TOUR_EVENT } from '../components/WelcomeTour';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const SECTIONS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'workspace', label: 'The Workspace' },
  { id: 'tools', label: 'Tools' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'accounts', label: 'Accounts & Sync' },
  { id: 'install', label: 'Install the App' },
  { id: 'themes', label: 'Themes' },
  { id: 'faq', label: 'FAQ' },
];

const LINK = 'text-primary underline underline-offset-4 hover:opacity-80';

function Kbd({ children }) {
  return (
    <kbd className='rounded border bg-muted px-1.5 py-0.5 font-mono text-xs'>{children}</kbd>
  );
}

// Render one shortcut row from the shared SHORTCUT_GROUPS data.
function ShortcutKeys({ keys, alt }) {
  const render = (list) => list.map((k, i) => (
    (k === 'then' || k === '–')
      ? <span className='text-xs text-muted-foreground' key={i}>{k}</span>
      : <Kbd key={i}>{k}</Kbd>
  ));
  return (
    <span className='flex shrink-0 flex-wrap items-center gap-1'>
      {render(keys)}
      {alt && <><span className='text-xs text-muted-foreground'>or</span>{render(alt)}</>}
    </span>
  );
}

function Callout({ icon, children }) {
  return (
    <div className='flex items-start gap-2.5 rounded-lg border bg-muted/50 p-3 text-sm'>
      <span aria-hidden='true'>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Docs() {
  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-8 sm:px-6'>
      <header className='mb-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>🔧 Documentation</h1>
        <p className='mt-2 max-w-3xl text-muted-foreground'>
          Everything you need to get the most out of DeskDazzle — your all-in-one
          workspace of 20+ productivity tools, a draggable widget desktop, and
          keyboard shortcuts to move at speed.
        </p>
      </header>

      <div className='flex flex-col gap-10 lg:flex-row'>
        <aside className='lg:w-52 lg:shrink-0'>
          <nav className='flex flex-row flex-wrap gap-x-4 gap-y-1.5 lg:sticky lg:top-20 lg:flex-col'>
            <span className='w-full text-xs font-semibold uppercase tracking-wide text-muted-foreground'>On this page</span>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                className='text-sm text-muted-foreground transition-colors hover:text-foreground'
                href={`#${s.id}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className='min-w-0 flex-1 space-y-12'>
          {/* Welcome */}
          <section id='welcome' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>👋 Welcome</h2>
            <p>
              DeskDazzle bundles the small utilities you reach for every day —
              converters, generators, a calculator, notes, a to-do list and
              more — into a single, fast web app. Nothing to install (though
              you can), and your work follows you between devices when you sign in.
            </p>
            <p>It runs everywhere: phone, tablet and desktop, in light or dark.</p>
            <Callout icon='💡'>
              In a hurry? Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> (or <Kbd>Ctrl</Kbd>{' '}
              <Kbd>K</Kbd>) anywhere to search and jump straight to any tool.
            </Callout>
            <Button
              variant='outline'
              size='sm'
              className='mt-1'
              onClick={() => window.dispatchEvent(new Event(OPEN_TOUR_EVENT))}
            >
              <Sparkles className='size-4' aria-hidden='true' /> Take the tour
            </Button>
          </section>

          {/* Workspace */}
          <section id='workspace' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>🖥️ The Workspace</h2>
            <p>
              The home screen is your <strong>Workspace</strong> — a desktop you
              arrange yourself. Open widgets from the dock at the bottom, then
              move and resize them however you like.
            </p>
            <h3 className='pt-1 text-base font-medium'>Working with widgets</h3>
            <ul className='list-disc space-y-1 pl-5'>
              <li><strong>Open:</strong> tap a widget in the dock, or press its number key (see shortcuts).</li>
              <li><strong>Move:</strong> drag a window by its title bar.</li>
              <li><strong>Resize:</strong> drag the grip in the bottom-right corner.</li>
              <li><strong>Minimise / maximise / close:</strong> use the <Kbd>–</Kbd> <Kbd>▢</Kbd> <Kbd>×</Kbd> buttons on the title bar.</li>
            </ul>
            <p>
              Available widgets include Clock, To-Do, Notes, Calculator,
              Weather, Budget, Calendar and Color Picker. On phones each widget
              opens full-screen so it stays comfortable to use.
            </p>

            <h3 className='pt-1 text-base font-medium'>Navigating the canvas</h3>
            <p>
              The Workspace is an infinite canvas — you have far more room than
              one screen. On desktop and tablet you can:
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              <li><strong>Pan:</strong> drag any empty part of the desktop to move around the canvas.</li>
              <li><strong>Zoom:</strong> use the <Kbd>–</Kbd> <Kbd>%</Kbd> <Kbd>+</Kbd> control in the bottom-right corner, or press <Kbd>⌘</Kbd> <Kbd>+</Kbd> / <Kbd>⌘</Kbd> <Kbd>−</Kbd> (<Kbd>Ctrl</Kbd> on Windows/Linux). The <Kbd>%</Kbd> label resets to 100%.</li>
              <li><strong>Zoom to fit:</strong> the <Kbd>▢</Kbd> button (or <Kbd>⌘</Kbd>/<Kbd>Ctrl</Kbd> <Kbd>0</Kbd>) frames every open widget in view.</li>
            </ul>
            <Callout icon='🔍'>
              Only DeskDazzle's own zoom scales the canvas — browser pinch-to-zoom is intentionally disabled on the Workspace so widgets stay crisp and put. Panning and zoom are desktop/tablet only.
            </Callout>

            <h3 className='pt-1 text-base font-medium'>Spaces &amp; the dock</h3>
            <ul className='list-disc space-y-1 pl-5'>
              <li><strong>Spaces:</strong> keep separate desktops (each with its own layout, theme and data). Switch with <Kbd>W</Kbd> / <Kbd>Shift</Kbd> <Kbd>W</Kbd>, or manage them from the header menu.</li>
              <li><strong>Collapsible dock &amp; header:</strong> turn on <em>Collapsible dock</em> and/or <em>Collapsible header</em> in <Link className={LINK} to='/settings'>Settings → Appearance</Link> to auto-hide them and reveal on hover at the bottom / top edge — reclaiming the whole screen for the canvas.</li>
            </ul>

            <Callout icon='💾'>
              Your layout, zoom and pan position are saved automatically — to your account if you're signed in, otherwise to this device.
            </Callout>
          </section>

          {/* Tools */}
          <section id='tools' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>🧰 Tools</h2>
            <p>
              Every tool also has its own full page. Browse them all on the{' '}
              <Link className={LINK} to='/apps'>Apps</Link>{' '}
              screen, or open one directly below.
            </p>
            <div className='grid gap-3 pt-1 sm:grid-cols-2'>
              {TOOLS.map((t) => (
                <Link
                  key={t.path}
                  to={t.path}
                  className='flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/50'
                >
                  <span className='text-xl' aria-hidden='true'>{t.icon}</span>
                  <span className='min-w-0'>
                    <span className='block font-medium'>{t.name}</span>
                    <span className='block text-xs text-muted-foreground'>{t.desc}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Shortcuts */}
          <section id='shortcuts' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>⌨️ Keyboard Shortcuts</h2>
            <p>
              DeskDazzle is built to be driven from the keyboard. Press{' '}
              <Kbd>Shift</Kbd> <Kbd>?</Kbd>{' '}
              anywhere to pull up this same reference as an overlay.
            </p>
            <div className='grid gap-6 pt-1 md:grid-cols-2'>
              {SHORTCUT_GROUPS.map((group) => (
                <div className='rounded-lg border bg-card p-4' key={group.title}>
                  <h3 className='mb-2 text-base font-medium'>{group.title}</h3>
                  <div className='divide-y'>
                    {group.items.map((item, i) => (
                      <div className='flex items-center justify-between gap-4 py-2' key={i}>
                        <span className='text-muted-foreground'>{item.desc}</span>
                        <ShortcutKeys keys={item.keys} alt={item.alt} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Accounts */}
          <section id='accounts' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>👤 Accounts & Sync</h2>
            <p>
              Sign in with Google from the header (the <Kbd>🔑</Kbd>
              {' '}button, or the menu on mobile). Signing in is optional — every
              tool works while signed out.
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              <li><strong>Signed out:</strong> your theme, to-dos and workspace layout are stored locally in this browser.</li>
              <li><strong>Signed in:</strong> the same data syncs to your account and follows you to any device, in real time.</li>
            </ul>
            <p>
              Manage your session anytime from your{' '}
              <Link className={LINK} to='/profile'>Profile</Link>.
            </p>
            <p>
              You can tune how eagerly changes are pushed to the cloud with{' '}
              <em>Sync latency</em> in{' '}
              <Link className={LINK} to='/settings'>Settings → Appearance</Link> —{' '}
              <strong>Instant</strong>, <strong>Balanced</strong> (default) or{' '}
              <strong>Relaxed</strong> (batches edits into fewer writes). Changes
              always save locally first, so the app stays instant regardless.
            </p>
          </section>

          {/* Install */}
          <section id='install' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>⚙️ Install the App</h2>
            <p>
              DeskDazzle is a Progressive Web App (PWA), so you can install it
              to your home screen or dock for a full-screen, app-like experience
              that works offline.
            </p>
            <div className='grid gap-4 pt-1 sm:grid-cols-2'>
              <div className='rounded-lg border bg-card p-4'>
                <h3 className='mb-2 text-base font-medium'>📱 Android & Desktop</h3>
                <ol className='list-decimal space-y-1 pl-5'>
                  <li>Open DeskDazzle in Chrome or Edge.</li>
                  <li>Open the browser menu (⋮).</li>
                  <li>Choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li>
                  <li>Confirm — it now launches like a native app.</li>
                </ol>
              </div>
              <div className='rounded-lg border bg-card p-4'>
                <h3 className='mb-2 text-base font-medium'>🍎 iPhone & iPad</h3>
                <ol className='list-decimal space-y-1 pl-5'>
                  <li>Open DeskDazzle in Safari.</li>
                  <li>Tap the <strong>Share</strong> button.</li>
                  <li>Choose <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> to finish.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Themes */}
          <section id='themes' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>🌓 Themes</h2>
            <p>
              DeskDazzle ships with a clean light theme and an easy-on-the-eyes
              dark theme. Toggle between them in three ways:
            </p>
            <ul className='list-disc space-y-1 pl-5'>
              <li>Click the <Kbd>☀️</Kbd> / <Kbd>🌙</Kbd> switch in the header.</li>
              <li>Press <Kbd>T</Kbd> anywhere.</li>
              <li>Use the theme toggle in the mobile menu.</li>
            </ul>
            <p>Your choice is remembered and syncs with your account when signed in.</p>
          </section>

          {/* FAQ */}
          <section id='faq' className='scroll-mt-20 space-y-3 text-sm leading-6'>
            <h2 className='text-xl font-semibold tracking-tight'>❓ FAQ</h2>
            <h3 className='pt-1 text-base font-medium'>Is DeskDazzle free?</h3>
            <p>
              Yes, completely. If you'd like to support development you can{' '}
              <Link className={LINK} to='/donate'>donate</Link> — entirely optional.
            </p>
            <h3 className='pt-1 text-base font-medium'>Does it work offline?</h3>
            <p>
              Once installed as a PWA the app shell and most tools work offline.
              Tools that fetch live data (such as Weather or Translation) need a
              connection.
            </p>
            <h3 className='pt-1 text-base font-medium'>Where is my data stored?</h3>
            <p>
              Locally in your browser when signed out, and in your private
              account storage when signed in. See <a className={LINK} href='#accounts'>Accounts & Sync</a>.
            </p>
            <h3 className='pt-1 text-base font-medium'>I found a bug or have an idea.</h3>
            <p>
              Great — reach out via the links in the footer. Feedback is always welcome.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Docs
