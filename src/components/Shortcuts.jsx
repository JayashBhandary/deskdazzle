import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../App';
import { useSettings } from '../lib/settings/useSettings';
import { SHORTCUT_GROUPS } from '../toolsData';
import CommandPalette from './CommandPalette';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Owns every app-wide keyboard shortcut and the two overlays they drive:
// the command palette (⌘K) and the shortcut-help sheet (?). Mounted once,
// inside the router so it can navigate.
const GO_TARGETS = { h: '/', a: '/apps', d: '/docs' };
const CHORD_WINDOW_MS = 1200;

function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function Shortcuts() {
  const { setTheme, workspaces = [], activeWorkspaceId, switchWorkspace } = useContext(ThemeContext);
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const gAt = useRef(0);

  // Let the header (and anything else) open the palette without prop drilling.
  useEffect(() => {
    const openPalette = () => setPaletteOpen(true);
    window.addEventListener('deskdazzle:open-palette', openPalette);
    return () => window.removeEventListener('deskdazzle:open-palette', openPalette);
  }, []);

  const onKeyDown = useCallback((e) => {
    // ⌘K / Ctrl+K — works even while typing.
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      setPaletteOpen((v) => !v);
      return;
    }

    // ⌘/Ctrl+Shift+D / +H — toggle the collapsible dock / header setting.
    // Works even while typing, like ⌘K.
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === 'd') {
        e.preventDefault();
        update({ collapsibleDock: !settings.collapsibleDock });
        return;
      }
      if (k === 'h') {
        e.preventDefault();
        update({ collapsibleHeader: !settings.collapsibleHeader });
        return;
      }
    }

    if (e.key === 'Escape') {
      setHelpOpen(false);
      // The palette closes itself via its own input handler; this covers the
      // case where focus has left the palette input.
      setPaletteOpen(false);
      return;
    }

    // The palette captures its own navigation keys while open.
    if (paletteOpen) return;

    // Don't hijack typing or modifier combos for single-key shortcuts.
    if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;

    const now = Date.now();

    // G-chord navigation: press G, then a destination key.
    if (gAt.current && now - gAt.current < CHORD_WINDOW_MS) {
      const target = GO_TARGETS[e.key.toLowerCase()];
      gAt.current = 0;
      if (target) {
        e.preventDefault();
        navigate(target);
        return;
      }
    }

    if (e.key === 'g' || e.key === 'G') {
      gAt.current = now;
      return;
    }

    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      setTheme((prev) => (prev === false ? true : false));
      return;
    }

    // W / Shift+W — cycle to the next / previous workspace (Space). With two
    // workspaces this is a straight toggle between them.
    if (e.key === 'w' || e.key === 'W') {
      if (workspaces.length > 1 && switchWorkspace) {
        e.preventDefault();
        const dir = e.key === 'W' ? -1 : 1;
        const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        const from = idx < 0 ? 0 : idx;
        const next = workspaces[(from + dir + workspaces.length) % workspaces.length];
        if (next && next.id !== activeWorkspaceId) switchWorkspace(next.id);
      }
      return;
    }

    if (e.key === '?') {
      e.preventDefault();
      setHelpOpen((v) => !v);
    }
  }, [navigate, paletteOpen, setTheme, workspaces, activeWorkspaceId, switchWorkspace, settings.collapsibleDock, settings.collapsibleHeader, update]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-md' aria-label='Keyboard shortcuts'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Keyboard className='size-4' aria-hidden='true' /> Keyboard shortcuts
            </DialogTitle>
            <DialogDescription className='sr-only'>
              Every keyboard shortcut available in DeskDazzle.
            </DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-6'>
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h4 className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>{group.title}</h4>
                <div className='flex flex-col gap-1.5'>
                  {group.items.map((item, idx) => (
                    <div className='flex items-center justify-between gap-4 text-sm' key={idx}>
                      <span className='text-muted-foreground'>{item.desc}</span>
                      <span className='flex shrink-0 items-center gap-1'>
                        {item.keys.map((k, i) => (
                          k === 'then' || k === '–'
                            ? <span className='text-xs text-muted-foreground' key={i}>{k}</span>
                            : <kbd className='rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground' key={i}>{k}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Shortcuts
