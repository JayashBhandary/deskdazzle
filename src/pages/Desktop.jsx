import React, { useContext, useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import DesktopWindow from '../components/DesktopWindow';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

// Every desktop widget is just its app component rendered inside a small,
// resizable window. Apps live in src/apps/<name>/ and adapt to their container
// via container queries — the same component powers the full page and the
// widget, so there's no separate widget code to maintain.
import ClockApp from '../apps/clock/ClockApp';
import TodoApp from '../apps/todo/TodoApp';
import NotesApp from '../apps/notes/NotesApp';
import CalculatorApp from '../apps/calculator/CalculatorApp';
import WeatherApp from '../apps/weather/WeatherApp';
import BudgetApp from '../apps/budget/BudgetApp';
import CalendarApp from '../apps/calendar/CalendarApp';
import ColorPicker from '../apps/design/parts/ColorPicker';
import MediaApp from '../apps/media/MediaApp';

// Registry of every widget that can live on the desktop. `w`/`h` are the
// opening size; `minW`/`minH` are the "safe area" — the window can't be shrunk
// smaller than this, so a widget's content never gets cropped.
const WIDGETS = {
  clock: { title: 'Clock', icon: '🕐', component: ClockApp, w: 300, h: 380, minW: 260, minH: 300 },
  todo: { title: 'To-Do', icon: '✅', component: TodoApp, w: 320, h: 380, minW: 260, minH: 280 },
  notes: { title: 'Notes', icon: '📝', component: NotesApp, w: 320, h: 380, minW: 260, minH: 260 },
  calculator: { title: 'Calculator', icon: '🧮', component: CalculatorApp, w: 280, h: 380, minW: 250, minH: 340 },
  weather: { title: 'Weather', icon: '🌦️', component: WeatherApp, w: 300, h: 320, minW: 260, minH: 260 },
  budget: { title: 'Budget', icon: '💳', component: BudgetApp, w: 300, h: 380, minW: 270, minH: 300 },
  calendar: { title: 'Calendar', icon: '📅', component: CalendarApp, w: 300, h: 340, minW: 270, minH: 300 },
  color: { title: 'Color Picker', icon: '🎨', component: ColorPicker, w: 300, h: 400, minW: 260, minH: 340 },
  media: { title: 'Media', icon: '🎧', component: MediaApp, w: 300, h: 140, minW: 260, minH: 120 },
};

const ORDER = ['clock', 'todo', 'notes', 'calculator', 'weather', 'budget', 'calendar', 'color', 'media'];

// The workspace starts empty — the user opens whatever widgets they want from
// the dock. Closing them all returns to this clean state (and stays there).
const DEFAULT_LAYOUT = [];

function Desktop() {
  const {
    isLoggedIn, desktop, setDesktop,
    workspaces = [], activeWorkspaceId, switchWorkspace,
  } = useContext(ThemeContext);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const cycleWorkspace = () => {
    if (workspaces.length < 2) return;
    const idx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
    const next = workspaces[((idx < 0 ? 0 : idx) + 1) % workspaces.length];
    if (next) switchWorkspace(next.id);
  };
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

  // Windows are multi-instance: a widget can have several windows open at once,
  // each with a unique id (decoupled from its `type`). Legacy layouts where
  // id === type keep working — they're just the first instance of that type.
  const newWinId = (type) =>
    `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const topZ = (arr) => arr.reduce((m, w) => Math.max(m, w.z || 0), 0);

  const addWindow = (prev, type) => {
    const meta = WIDGETS[type];
    const offset = prev.length * 28;
    return [...prev, {
      id: newWinId(type),
      type,
      x: 60 + offset,
      y: 40 + offset,
      width: meta.w,
      height: meta.h,
      z: topZ(prev) + 1,
      minimized: false,
      maximized: false,
    }];
  };

  // Dock left-click: focus/restore the front-most existing window of a type, or
  // open the first one if none exist yet.
  const openOrFocus = (type) => setWindows((prev) => {
    const mine = prev.filter((w) => w.type === type);
    if (!mine.length) return addWindow(prev, type);
    const target = mine.reduce((a, b) => ((b.z || 0) > (a.z || 0) ? b : a));
    const top = topZ(prev) + 1;
    return prev.map((w) => (w.id === target.id ? { ...w, minimized: false, z: top } : w));
  });

  // Dock right-click: always spawn a fresh, independent window.
  const openNew = (type) => setWindows((prev) => addWindow(prev, type));

  const showAll = (type) => setWindows((prev) => {
    let top = topZ(prev);
    return prev.map((w) => (w.type === type ? { ...w, minimized: false, z: ++top } : w));
  });
  const closeAll = (type) => setWindows((prev) => prev.filter((w) => w.type !== type));

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

  // Number keys 1–9 open (or focus/restore) the matching widget. Ignored while
  // the user is typing into a widget input.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      const idx = parseInt(e.key, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= ORDER.length) return;
      openOrFocus(ORDER[idx]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [windows]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTypes = new Set(windows.map((w) => w.type));
  const visibleCount = windows.filter((w) => !w.minimized).length;

  // Suppress the native context menu across the desktop workspace + dock, but
  // keep it inside text fields so copy/paste/spellcheck still work.
  const onRootContextMenu = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
  };

  return (
    <div
      className="relative min-h-screen w-full bg-background pb-[120px] pt-[84px] text-foreground"
      onContextMenu={onRootContextMenu}
    >
      {isLoggedIn && workspaces.length > 1 && (
        <button
          type="button"
          onClick={cycleWorkspace}
          title="Tap to switch workspace (W)"
          className="fixed left-1/2 top-[68px] z-[10] flex max-w-[80vw] -translate-x-1/2 items-center gap-1.5 rounded-full border bg-popover/80 px-3 py-1 text-sm text-popover-foreground shadow-sm backdrop-blur-md md:hidden"
        >
          <span aria-hidden="true">{activeWs?.emoji || '🗂️'}</span>
          <span className="truncate font-medium">{activeWs?.name || 'Workspace'}</span>
        </button>
      )}

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
          const mine = windows.filter((w) => w.type === type);
          const isOpen = openTypes.has(type);
          const allMinimized = mine.length > 0 && mine.every((w) => w.minimized);
          return (
            <ContextMenu key={type}>
              <ContextMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'relative flex min-w-11 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground sm:min-w-14',
                    allMinimized && 'opacity-55',
                  )}
                  title={`${meta.title} — right-click for options`}
                  onClick={() => openOrFocus(type)}
                >
                  <span className="text-2xl leading-none sm:text-[26px]">{meta.icon}</span>
                  <span className="whitespace-nowrap text-[10px] max-sm:hidden">{meta.title}</span>
                  {isOpen && (
                    <span className="absolute bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {mine.slice(0, 3).map((w) => (
                        <span key={w.id} className="size-1 rounded-full bg-foreground" />
                      ))}
                    </span>
                  )}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuLabel>{meta.icon} {meta.title}</ContextMenuLabel>
                <ContextMenuItem onSelect={() => openNew(type)}>
                  Open new window
                </ContextMenuItem>
                {mine.length > 0 && (
                  <ContextMenuItem onSelect={() => showAll(type)}>
                    Show all ({mine.length})
                  </ContextMenuItem>
                )}
                {mine.length > 0 && <ContextMenuSeparator />}
                {mine.length > 0 && (
                  <ContextMenuItem variant="destructive" onSelect={() => closeAll(type)}>
                    Close {mine.length > 1 ? `all (${mine.length})` : 'window'}
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {/* Settings is a full page, not a widget — the dock icon links to it. */}
        <Link
          to="/settings"
          title="Settings"
          className="relative flex min-w-11 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground sm:min-w-14"
        >
          <span className="text-2xl leading-none sm:text-[26px]">⚙️</span>
          <span className="whitespace-nowrap text-[10px] max-sm:hidden">Settings</span>
        </Link>
      </div>
    </div>
  )
}

export default Desktop
