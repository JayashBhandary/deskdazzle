import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../App';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle } from '../auth';
import { NAV_LINKS } from '../toolsData';
import { LogIn, Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// Fired by the header search button and consumed by the global Shortcuts
// component, which owns the command palette's open state.
export const openCommandPalette = () =>
  window.dispatchEvent(new CustomEvent('deskdazzle:open-palette'));

const navLinkClass = ({ isActive }) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  );

const drawerLinkClass = ({ isActive }) =>
  cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
  );

function Header() {
  const { theme, setTheme, isLoggedIn, user, profile } = useContext(ThemeContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handleThemeChange = () => setTheme(theme === false ? true : false);

  const profileSlot = isLoggedIn
    ? (
      <Link
        to='/profile'
        aria-label='Profile'
        className='rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50'
      >
        <img
          alt='profile'
          src={profile?.photoURL || user?.photoURL}
          referrerPolicy='no-referrer'
          className='size-8 rounded-full border object-cover'
        />
      </Link>
    )
    : (
      <Button variant='outline' size='sm' onClick={signInWithGoogle} aria-label='Sign in'>
        <LogIn /> Sign in
      </Button>
    );

  return (
    <>
      <header className='sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
        <div className='mx-auto flex h-14 max-w-6xl items-center gap-4 px-4'>
          <Link
            to='/'
            aria-label='DeskDazzle home'
            className='flex shrink-0 items-baseline gap-1.5 no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md'
          >
            <span className='text-lg font-bold tracking-tight text-foreground'>DƎSK</span>
            <span className='text-xs font-semibold tracking-[0.2em] text-muted-foreground'>DAZZLƎ</span>
          </Link>

          {/* Desktop navigation */}
          <nav className='hidden items-center gap-1 md:flex' aria-label='Primary'>
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={navLinkClass}
              >
                <span aria-hidden='true'>{link.icon}</span> {link.label}
              </NavLink>
            ))}
          </nav>

          <div className='ml-auto flex items-center gap-1.5'>
            <Button
              variant='outline'
              size='sm'
              onClick={openCommandPalette}
              aria-label='Search (Command or Ctrl + K)'
              title='Search — ⌘K / Ctrl+K'
              className='hidden gap-2 text-muted-foreground sm:inline-flex'
            >
              <Search />
              <span>Search</span>
              <kbd className='pointer-events-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground'>⌘K</kbd>
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={openCommandPalette}
              aria-label='Search (Command or Ctrl + K)'
              className='sm:hidden'
            >
              <Search />
            </Button>

            <Button
              variant='ghost'
              size='icon'
              onClick={handleThemeChange}
              aria-label='Toggle theme'
              title='Toggle theme (T)'
            >
              {theme ? <Moon /> : <Sun />}
            </Button>

            <div className='hidden md:flex'>{profileSlot}</div>

            <Button
              variant='ghost'
              size='icon'
              className='md:hidden'
              onClick={() => setDrawerOpen(true)}
              aria-label='Menu'
              aria-expanded={drawerOpen}
            >
              <Menu />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side='right' className='w-72'>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className='flex flex-1 flex-col gap-1 overflow-y-auto px-4'>
            <Button
              variant='outline'
              className='justify-start gap-2 text-muted-foreground'
              onClick={() => { setDrawerOpen(false); openCommandPalette(); }}
            >
              <Search /> Search tools…
            </Button>

            <nav className='mt-3 flex flex-col gap-1' aria-label='Mobile'>
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === '/'}
                  className={drawerLinkClass}
                >
                  <span aria-hidden='true'>{link.icon}</span> {link.label}
                </NavLink>
              ))}
              <NavLink to='/donate' className={drawerLinkClass}>
                <span aria-hidden='true'>🙌</span> Donate
              </NavLink>
              <NavLink to='/profile' className={drawerLinkClass}>
                <span aria-hidden='true'>👤</span> Profile
              </NavLink>
            </nav>
          </div>

          <SheetFooter>
            <Separator />
            <Button
              variant='ghost'
              className='justify-start gap-2'
              onClick={handleThemeChange}
            >
              {theme ? <Moon /> : <Sun />}
              {theme ? 'Dark theme' : 'Light theme'}
            </Button>
            {!isLoggedIn && (
              <Button onClick={() => { setDrawerOpen(false); signInWithGoogle(); }}>
                <LogIn /> Sign in with Google
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default Header
