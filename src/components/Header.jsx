import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../App';
import { useSettings } from '../lib/settings/useSettings';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle, signOutUser } from '../auth';
import { NAV_LINKS } from '../toolsData';
import { ChevronDown, LayoutGrid, LogIn, LogOut, Menu, Moon, Plus, Search, Settings, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import WorkspaceManager from './WorkspaceManager';
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
  const {
    theme, setTheme, isLoggedIn, user, profile,
    workspaces = [], activeWorkspaceId, switchWorkspace,
  } = useContext(ThemeContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // When true, the manager dialog opens with the "create" field focused.
  const [manageCreate, setManageCreate] = useState(false);
  const location = useLocation();
  const { settings } = useSettings();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // ----- Collapsible header (Workspace only, desktop/tablet) -----
  // Auto-hide the header on the Workspace so widgets get its height back. We
  // publish the reserved header height as a CSS var (`--header-h`) that the
  // Workspace consumes, and flip the header from sticky (reserves space) to
  // fixed (overlays) while auto-hide is active.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const autoHide = location.pathname === '/' && settings.collapsibleHeader && isDesktop;
  const [headerRevealed, setHeaderRevealed] = useState(false);
  const headerShown = !autoHide || headerRevealed;
  // Collapse the header a moment after the pointer leaves it.
  useEffect(() => {
    if (!autoHide) setHeaderRevealed(false);
  }, [autoHide]);
  // Reserve 0 height while auto-hiding (header overlays); otherwise the default.
  useEffect(() => {
    const root = document.documentElement;
    if (autoHide) root.style.setProperty('--header-h', '0px');
    else root.style.removeProperty('--header-h');
    return () => root.style.removeProperty('--header-h');
  }, [autoHide]);

  const handleThemeChange = () => setTheme(theme === false ? true : false);

  const openManager = (focusCreate) => {
    setManageCreate(focusCreate);
    setManageOpen(true);
  };

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  // Shared workspace-switcher items, used by both the profile menu and the
  // dedicated workspace chip so they never drift apart.
  const workspaceMenuItems = (
    <>
      <DropdownMenuRadioGroup value={activeWorkspaceId} onValueChange={switchWorkspace}>
        {workspaces.map((ws) => (
          <DropdownMenuRadioItem key={ws.id} value={ws.id}>
            <span className='mr-1'>{ws.emoji}</span>
            <span className='truncate'>{ws.name}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuItem onSelect={() => openManager(true)}>
        <Plus /> New workspace
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => openManager(false)}>
        <LayoutGrid /> Manage workspaces…
      </DropdownMenuItem>
    </>
  );

  const profileSlot = isLoggedIn
    ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type='button'
            aria-label='Account menu'
            className='rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50'
          >
            <img
              alt='profile'
              src={profile?.photoURL || user?.photoURL}
              referrerPolicy='no-referrer'
              className='size-8 rounded-full border object-cover'
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-60'>
          <DropdownMenuLabel className='flex flex-col gap-0.5'>
            <span className='truncate text-sm'>{profile?.displayName || user?.displayName || 'Account'}</span>
            {user?.email && <span className='truncate text-xs font-normal text-muted-foreground'>{user.email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to='/profile'><User /> Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to='/settings'><Settings /> Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>Workspaces</DropdownMenuLabel>
          {workspaceMenuItems}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleThemeChange}>
            {theme ? <Moon /> : <Sun />} Toggle theme
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onSelect={() => signOutUser()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    : (
      <Button variant='outline' size='sm' onClick={signInWithGoogle} aria-label='Sign in'>
        <LogIn /> Sign in
      </Button>
    );

  return (
    <>
      {/* Top reveal strip — pointing here slides the hidden header back down. */}
      {autoHide && !headerShown && (
        <div
          className='fixed inset-x-0 top-0 z-50 h-4'
          onMouseEnter={() => setHeaderRevealed(true)}
          onPointerEnter={() => setHeaderRevealed(true)}
        />
      )}

      <header
        onMouseEnter={autoHide ? () => setHeaderRevealed(true) : undefined}
        onMouseLeave={autoHide ? () => setHeaderRevealed(false) : undefined}
        className={cn(
          'top-0 z-40 w-full border-b bg-background/80 backdrop-blur transition-transform duration-300 ease-out supports-[backdrop-filter]:bg-background/60',
          autoHide ? 'fixed' : 'sticky',
          autoHide && !headerShown && '-translate-y-full',
        )}
      >
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

            {isLoggedIn && workspaces.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='hidden max-w-[11rem] gap-1.5 md:inline-flex'
                    title={`Current workspace: ${activeWs?.name || ''} — press W to switch`}
                    aria-label={`Current workspace: ${activeWs?.name || ''}. Switch workspace`}
                  >
                    <span aria-hidden='true'>{activeWs?.emoji || '🗂️'}</span>
                    <span className='truncate'>{activeWs?.name || 'Workspace'}</span>
                    <ChevronDown className='size-3.5 shrink-0 opacity-60' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-56'>
                  <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
                    Switch workspace
                  </DropdownMenuLabel>
                  {workspaceMenuItems}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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

            {isLoggedIn && workspaces.length > 0 && (
              <div className='mt-3'>
                <p className='px-3 pb-1 text-xs font-medium text-muted-foreground'>Workspaces</p>
                <div className='flex flex-col gap-1'>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      type='button'
                      onClick={() => switchWorkspace(ws.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                        ws.id === activeWorkspaceId
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                      )}
                    >
                      <span aria-hidden='true'>{ws.emoji}</span>
                      <span className='truncate'>{ws.name}</span>
                    </button>
                  ))}
                  <button
                    type='button'
                    onClick={() => { setDrawerOpen(false); openManager(false); }}
                    className='flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                  >
                    <LayoutGrid className='size-4' /> Manage workspaces…
                  </button>
                </div>
              </div>
            )}
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
            {isLoggedIn ? (
              <Button
                variant='ghost'
                className='justify-start gap-2 text-destructive hover:text-destructive'
                onClick={() => { setDrawerOpen(false); signOutUser(); }}
              >
                <LogOut /> Sign out
              </Button>
            ) : (
              <Button onClick={() => { setDrawerOpen(false); signInWithGoogle(); }}>
                <LogIn /> Sign in with Google
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <WorkspaceManager open={manageOpen} onOpenChange={setManageOpen} focusCreate={manageCreate} />
    </>
  )
}

export default Header
