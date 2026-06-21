import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../App';
import { SHORTCUT_GROUPS } from '../toolsData';
import CommandPalette from './CommandPalette';

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
  const { theme, setTheme } = useContext(ThemeContext);
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

    if (e.key === '?') {
      e.preventDefault();
      setHelpOpen((v) => !v);
    }
  }, [navigate, paletteOpen, setTheme]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {helpOpen && (
        <div className='help-backdrop' onMouseDown={() => setHelpOpen(false)}>
          <div
            className={`help ${theme ? 'dark' : 'light'}`}
            role='dialog'
            aria-label='Keyboard shortcuts'
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='help__head'>
              <h3>⌨️ Keyboard shortcuts</h3>
              <button className='help__close' onClick={() => setHelpOpen(false)} aria-label='Close'>×</button>
            </div>
            <div className='help__groups'>
              {SHORTCUT_GROUPS.map((group) => (
                <div className='help__group' key={group.title}>
                  <h4>{group.title}</h4>
                  {group.items.map((item, idx) => (
                    <div className='help__row' key={idx}>
                      <span className='help__desc'>{item.desc}</span>
                      <span className='help__keys'>
                        {item.keys.map((k, i) => (
                          k === 'then' || k === '–'
                            ? <span className='help__sep' key={i}>{k}</span>
                            : <kbd key={i}>{k}</kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Shortcuts
