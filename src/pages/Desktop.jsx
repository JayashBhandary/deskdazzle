import React, { useContext, useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import DesktopWindow from '../components/DesktopWindow';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import ClockWidget from '../widgets/ClockWidget';
import TodoWidget from '../widgets/TodoWidget';
import NotesWidget from '../widgets/NotesWidget';
import CalculatorWidget from '../widgets/CalculatorWidget';
import WeatherWidget from '../widgets/WeatherWidget';
import BudgetWidget from '../widgets/BudgetWidget';
import CalendarWidget from '../widgets/CalendarWidget';
import ColorWidget from '../widgets/ColorWidget';
import MediaWidget from '../widgets/MediaWidget';

// Registry of every widget that can live on the desktop.
const WIDGETS = {
  clock: { title: 'Clock', icon: '🕐', component: ClockWidget, w: 300, h: 360 },
  todo: { title: 'To-Do', icon: '✅', component: TodoWidget, w: 300, h: 360 },
  notes: { title: 'Notes', icon: '📝', component: NotesWidget, w: 300, h: 360 },
  calculator: { title: 'Calculator', icon: '🧮', component: CalculatorWidget, w: 280, h: 380 },
  weather: { title: 'Weather', icon: '🌦️', component: WeatherWidget, w: 280, h: 300 },
  budget: { title: 'Budget', icon: '💳', component: BudgetWidget, w: 330, h: 420 },
  calendar: { title: 'Calendar', icon: '📅', component: CalendarWidget, w: 320, h: 320 },
  color: { title: 'Color Picker', icon: '🎨', component: ColorWidget, w: 300, h: 360 },
  media: { title: 'Media', icon: '🎧', component: MediaWidget, w: 300, h: 180 },
};

const ORDER = ['clock', 'todo', 'notes', 'calculator', 'weather', 'budget', 'calendar', 'color', 'media'];

// The workspace starts empty — the user opens whatever widgets they want from
// the dock. Closing them all returns to this clean state (and stays there).
const DEFAULT_LAYOUT = [];

function Desktop() {
  const { isLoggedIn, desktop, setDesktop } = useContext(ThemeContext);
  // Desktop layout is loaded/persisted centrally (useUserData → Realtime DB).
  // `desktop` is null until loaded, then an array (possibly empty). An empty
  // array is a real state — the user closed everything — so we must NOT fall
  // back to defaults for it, or closed widgets would respawn.
  const windows = Array.isArray(desktop) ? desktop : DEFAULT_LAYOUT;
  const setWindows = useCallback((updater) => {
    setDesktop((prev) => {
      const base = Array.isArray(prev) ? prev : DEFAULT_LAYOUT;
      return typeof updater === 'function' ? updater(base) : updater;
    });
  }, [setDesktop]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const open = (type) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === type);
      const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0) + 1;
      if (existing) {
        return prev.map((w) => (w.id === type ? { ...w, minimized: false, z: top } : w));
      }
      const meta = WIDGETS[type];
      const offset = prev.length * 28;
      return [...prev, {
        id: type,
        type,
        x: 60 + offset,
        y: 40 + offset,
        width: meta.w,
        height: meta.h,
        z: top,
        minimized: false,
        maximized: false,
      }];
    });
  };

  const focus = (id) => setWindows((prev) => {
    const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0);
    const target = prev.find((w) => w.id === id);
    if (target && target.z === top) return prev;
    return prev.map((w) => (w.id === id ? { ...w, z: top + 1 } : w));
  });

  const close = (id) => setWindows((prev) => prev.filter((w) => w.id !== id));
  const minimize = (id) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const maximize = (id) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)));
  const change = (id, partial) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...partial } : w)));

  const restore = (id) => setWindows((prev) => {
    const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0) + 1;
    return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: top } : w));
  });

  // Number keys 1–9 open (or restore) the matching widget. Ignored while the
  // user is typing into a widget input.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const idx = parseInt(e.key, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= ORDER.length) return;
      const type = ORDER[idx];
      const win = windows.find((w) => w.id === type);
      if (win?.minimized) restore(type); else open(type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [windows]); // eslint-disable-line react-hooks/exhaustive-deps

  const openIds = new Set(windows.map((w) => w.id));
  const visibleCount = windows.filter((w) => !w.minimized).length;

  return (
    <div className="relative min-h-screen w-full bg-background pb-[120px] pt-[84px] text-foreground">
      <div className="relative h-[calc(100vh-204px)] min-h-[440px] w-full">
        {visibleCount === 0 && (
          <div className="absolute left-1/2 top-1/2 flex w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3.5 text-center">
            <h2 className="text-3xl font-bold">🖥️ Your workspace</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Open widgets from the dock below. Drag the title bars to move them, drag edges to resize. Your layout is saved{isLoggedIn ? ' to your account' : ' on this device'}.
            </p>
            <Button asChild variant="outline">
              <Link to="/apps">Browse all tools →</Link>
            </Button>
          </div>
        )}

        {windows.map((win) => {
          const meta = WIDGETS[win.type];
          if (!meta) return null;
          return (
            <DesktopWindow
              key={win.id}
              win={win}
              meta={meta}
              isMobile={isMobile}
              onFocus={focus}
              onClose={close}
              onMinimize={minimize}
              onMaximize={maximize}
              onChange={change}
            />
          );
        })}
      </div>

      <div className="fixed bottom-4 left-1/2 z-[5000] flex max-w-[94vw] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-3xl border bg-popover/80 px-3.5 py-2.5 text-popover-foreground shadow-lg backdrop-blur-md">
        {ORDER.map((type) => {
          const meta = WIDGETS[type];
          const win = windows.find((w) => w.id === type);
          const isOpen = openIds.has(type);
          return (
            <button
              key={type}
              type="button"
              className={cn(
                'relative flex min-w-11 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground sm:min-w-14',
                win?.minimized && 'opacity-55',
              )}
              title={meta.title}
              onClick={() => (win?.minimized ? restore(type) : open(type))}
            >
              <span className="text-2xl leading-none sm:text-[26px]">{meta.icon}</span>
              <span className="whitespace-nowrap text-[10px] max-sm:hidden">{meta.title}</span>
              {isOpen && (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-foreground" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  )
}

export default Desktop
