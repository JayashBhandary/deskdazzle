import React from 'react'
import { Link } from 'react-router-dom';
import { ArrowUpRight, Command, Globe, Heart, WifiOff } from 'lucide-react';
import { openCommandPalette } from './Header';
import { cn } from '@/lib/utils';

// lucide dropped its brand glyphs, so ship the GitHub mark inline.
function GithubIcon({ className }) {
  return (
    <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden className={className}>
      <path d='M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.31-.54-1.53.12-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.19.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z' />
    </svg>
  );
}

const GITHUB_URL = 'https://github.com/JayashBhandary/deskdazzle';
const AUTHOR_URL = 'https://jayashbhandary.github.io';

// Grouped footer navigation. External links carry `external: true` so we can
// render them as <a> with an affordance instead of a client-side <Link>.
const LINK_GROUPS = [
  {
    title: 'Explore',
    links: [
      { label: 'Workspace', to: '/workspace' },
      { label: 'All apps', to: '/apps' },
      { label: 'Docs & shortcuts', to: '/docs' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Profile', to: '/profile' },
      { label: 'Support the project', to: '/donate' },
      { label: 'Privacy', to: '/privacy' },
      { label: 'Terms', to: '/terms' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: GITHUB_URL, external: true },
      { label: 'Report an issue', href: `${GITHUB_URL}/issues`, external: true },
    ],
  },
];

// Small on-brand capability chips — DeskDazzle's whole pitch in three words.
const BADGES = [
  { label: 'Offline-first', icon: WifiOff },
  { label: 'Rust → WASM core', icon: null },
  { label: 'Installable PWA', icon: null },
];

const linkClass =
  'group inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground';

function FooterLink({ link }) {
  if (link.external) {
    return (
      <a className={linkClass} href={link.href} target='_blank' rel='noreferrer'>
        {link.label}
        <ArrowUpRight className='h-3.5 w-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0' />
      </a>
    );
  }
  return (
    <Link className={linkClass} to={link.to}>
      {link.label}
    </Link>
  );
}

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className='relative border-t bg-background'>
      {/* Hairline gradient accent riding the top border. */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent'
      />

      <div className='mx-auto max-w-6xl px-4 py-14'>
        <div className='grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]'>
          {/* Brand + pitch + capability chips */}
          <section className='flex flex-col gap-4'>
            <Link to='/' className='inline-flex items-center gap-2.5 w-fit'>
              <img
                src='/logo512.png'
                alt='DeskDazzle logo'
                width={36}
                height={36}
                className='h-9 w-9 rounded-xl shadow-sm'
              />
              <span className='text-base font-semibold tracking-tight text-foreground'>
                DeskDazzle
              </span>
            </Link>
            <p className='max-w-xs text-sm leading-relaxed text-muted-foreground'>
              Your offline-first, all-in-one workspace. A Swiss-army knife of
              tools that opens instantly and keeps working with zero network.
            </p>
            <div className='flex flex-wrap gap-2'>
              {BADGES.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className='inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground'
                >
                  {Icon ? <Icon className='h-3 w-3' /> : null}
                  {label}
                </span>
              ))}
            </div>
          </section>

          {/* Link columns */}
          {LINK_GROUPS.map((group) => (
            <nav key={group.title} className='flex flex-col gap-3'>
              <h6 className='text-xs font-semibold uppercase tracking-wider text-foreground/70'>
                {group.title}
              </h6>
              <ul className='flex flex-col gap-2.5'>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink link={link} />
                  </li>
                ))}
                {/* The command palette isn't a route — surface it here too. */}
                {group.title === 'Explore' && (
                  <li>
                    <button
                      type='button'
                      onClick={openCommandPalette}
                      className={cn(linkClass, 'cursor-pointer')}
                    >
                      <Command className='h-3.5 w-3.5' />
                      Search everything
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className='mt-12 flex flex-col-reverse items-start gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-sm text-muted-foreground'>
            © {year} DeskDazzle · Built with{' '}
            ❤️
            for the {' '}
            🌏
            by{' '}
            <a
              className='font-medium text-foreground underline-offset-4 hover:underline'
              href={AUTHOR_URL}
              target='_blank'
              rel='noreferrer'
            >
              Jayash Bhandary
            </a>
          </p>
          <a
            href={GITHUB_URL}
            target='_blank'
            rel='noreferrer'
            aria-label='DeskDazzle on GitHub'
            className='inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
          >
            <GithubIcon className='h-4 w-4' />
          </a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
