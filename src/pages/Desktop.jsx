import React, { useContext, useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import DesktopWindow from '../components/DesktopWindow';
import { LayoutGrid, Maximize, Minus, Plus } from 'lucide-react';
import { useStore } from '../lib/store/WorkspaceProvider';
import { useSettings } from '../lib/settings/useSettings';
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
import { newId as genId } from '@/lib/id';

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
import ColorStudio from '../apps/design/parts/ColorStudio';
import TodayApp from '../apps/today/TodayApp';

// Heavy document/media apps are code-split (React.lazy): their code is only
// fetched when a user actually opens that window, keeping the initial desktop
// bundle small. DesktopWindow renders them inside a <Suspense> boundary.
const WordApp = React.lazy(() => import('../apps/word/WordApp'));
const ExcelApp = React.lazy(() => import('../apps/excel/ExcelApp'));
const PptApp = React.lazy(() => import('../apps/ppt/PptApp'));
const PdfApp = React.lazy(() => import('../apps/pdf/PdfApp'));
const DriveApp = React.lazy(() => import('../apps/drive/DriveApp'));
const MediaApp = React.lazy(() => import('../apps/media/MediaApp'));

// Registry of every widget that can live on the desktop. `w`/`h` are the
// opening size; `minW`/`minH` are the "safe area" — the window can't be shrunk
// smaller than this, so a widget's content never gets cropped.
const WIDGETS = {
  today: { title: 'Today', icon: '🌅', component: TodayApp, w: 320, h: 400, minW: 260, minH: 300 },
  clock: { title: 'Clock', icon: '🕐', component: ClockApp, w: 300, h: 380, minW: 260, minH: 300 },
  todo: { title: 'Tasks', icon: '✅', component: TodoApp, w: 320, h: 380, minW: 260, minH: 280 },
  notes: { title: 'Notes', icon: '📝', component: NotesApp, w: 320, h: 380, minW: 260, minH: 260 },
  calculator: { title: 'Calculator', icon: '🧮', component: CalculatorApp, w: 280, h: 380, minW: 250, minH: 340 },
  weather: { title: 'Weather', icon: '🌦️', component: WeatherApp, w: 300, h: 320, minW: 260, minH: 260 },
  budget: { title: 'Budget', icon: '💳', component: BudgetApp, w: 300, h: 380, minW: 270, minH: 300 },
  calendar: { title: 'Calendar', icon: '📅', component: CalendarApp, w: 300, h: 340, minW: 270, minH: 300 },
  color: { title: 'Color Studio', icon: '🎨', component: ColorStudio, w: 340, h: 560, minW: 300, minH: 420 },
  media: { title: 'Media', icon: '🎧', component: MediaApp, w: 380, h: 520, minW: 300, minH: 380 },
  word: { title: 'Word', icon: '📄', component: WordApp, w: 560, h: 460, minW: 320, minH: 320 },
  excel: { title: 'Excel', icon: '📊', component: ExcelApp, w: 620, h: 460, minW: 340, minH: 320 },
  powerpoint: { title: 'PowerPoint', icon: '📽️', component: PptApp, w: 720, h: 480, minW: 380, minH: 340 },
  pdf: { title: 'PDF', icon: '📕', component: PdfApp, w: 560, h: 460, minW: 320, minH: 320 },
  drive: { title: 'Drive', icon: '🗂️', component: DriveApp, w: 560, h: 460, minW: 320, minH: 320 },
};

const ORDER = ['today', 'clock', 'todo', 'notes', 'word', 'excel', 'powerpoint', 'pdf', 'drive', 'calculator', 'weather', 'budget', 'calendar', 'color', 'media'];

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

  // The workspace is a fixed-viewport surface (like a desktop OS) — the page
  // itself must never scroll, or panning/widgets fight a scrollbar. Lock body
  // scroll while mounted and restore it on the way out.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ----- Infinite canvas: pan + zoom -----
  // The desktop is a pannable, zoomable surface: drag empty space to move around
  // a large virtual area, and use the bottom-right control to zoom. The view
  // {x, y, zoom} is persisted per workspace (its own synced store), so reopening
  // a Space restores where you left the canvas. Windows store fixed *canvas*
  // coordinates; the transformed layer applies pan + zoom.
  const surfaceRef = useRef(null);
  const dockRef = useRef(null);
  const [viewStore, setViewStore] = useStore('desktopPan', { x: 0, y: 0, zoom: 1 });
  const readView = (v) => ({ x: v?.x || 0, y: v?.y || 0, zoom: v?.zoom || 1 });
  const [view, setView] = useState(() => readView(viewStore));
  const panDrag = useRef(null);
  // Adopt the persisted/synced view (e.g. after a workspace switch), but never
  // yank the canvas out from under an in-progress pan.
  useEffect(() => {
    if (!panDrag.current) setView(readView(viewStore));
  }, [viewStore]);

  const onPanDown = (e) => {
    if (isMobile || e.button === 2) return; // no panning on mobile / right-click
    e.preventDefault(); // don't start a native text selection while panning
    panDrag.current = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPanMove = (e) => {
    // Snapshot the drag ref: the setView updater runs deferred inside React's
    // reducer, and onPanUp can null panDrag.current before it does — reading the
    // ref inside the updater would then throw on null.
    const d = panDrag.current;
    if (!d) return;
    setView((v) => ({
      ...v,
      x: d.ox + (e.clientX - d.px),
      y: d.oy + (e.clientY - d.py),
    }));
  };
  const onPanUp = (e) => {
    if (!panDrag.current) return;
    panDrag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setView((v) => { setViewStore(v); return v; }); // commit final view once
  };

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.25;
  // Zoom toward the viewport centre so content doesn't drift off-screen.
  const zoomTo = useCallback((nextZoom) => {
    setView((v) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(nextZoom * 100) / 100));
      if (z === v.zoom) return v;
      const rect = surfaceRef.current?.getBoundingClientRect();
      const cx = rect ? rect.width / 2 : 0;
      const cy = rect ? rect.height / 2 : 0;
      const ratio = z / v.zoom;
      const nv = { x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio, zoom: z };
      setViewStore(nv);
      return nv;
    });
  }, [setViewStore]);

  // Frame an explicit set of canvas boxes ({x,y,w,h}) in the view. Shared by
  // zoom-to-fit and arrange-and-fit — the latter passes the boxes it's about to
  // move windows into, so the fit is computed from the *new* layout without
  // waiting for a state round-trip. With no boxes, recentre at 100%.
  const fitBoxesToView = useCallback((boxes) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const w = rect?.width || window.innerWidth;
    const h = rect?.height || window.innerHeight;
    // Reserve the strip the dock overlays at the bottom so fitted content isn't
    // framed behind it. Read the dock's live rect: when collapsed it's
    // translated off-screen, so the overlap naturally computes to 0. The header
    // needs no handling here — it's already excluded from the surface height
    // (via --header-h: pinned it pushes the surface down, collapsed it reclaims
    // the space), so `h` is header-aware already.
    let bottomInset = 0;
    if (rect && dockRef.current) {
      const dr = dockRef.current.getBoundingClientRect();
      bottomInset = Math.max(0, rect.bottom - dr.top + 12); // dock overlap + gap
    }
    const availH = Math.max(1, h - bottomInset);
    if (!boxes.length) {
      const nv = { x: 0, y: 0, zoom: 1 };
      setView(nv); setViewStore(nv);
      return;
    }
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const pad = 48;
    const zoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min((w - pad * 2) / (maxX - minX), (availH - pad * 2) / (maxY - minY))),
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Centre within the dock-free region (top of the surface to availH).
    const nv = { x: w / 2 - cx * zoom, y: availH / 2 - cy * zoom, zoom };
    setView(nv); setViewStore(nv);
  }, [setViewStore]);

  // The safe-area box of a floating window (never smaller than its widget's
  // minimum, matching how DesktopWindow renders it).
  const winBox = (win) => {
    const meta = WIDGETS[win.type];
    return {
      x: win.x, y: win.y,
      w: Math.max(win.width, meta.minW ?? 240),
      h: Math.max(win.height, meta.minH ?? 190),
    };
  };

  // Zoom-to-fit: frame every open (non-minimised) floating window in view,
  // leaving positions untouched. With nothing open, recentre at 100%.
  const fitView = useCallback(() => {
    const boxes = windows
      .filter((win) => WIDGETS[win.type] && !win.minimized && !win.maximized)
      .map(winBox);
    fitBoxesToView(boxes);
  }, [windows, fitBoxesToView]);

  // Arrange-and-fit: lay out every visible window in a non-overlapping grid so
  // all of them are fully visible, then zoom-to-fit the new layout. Overlapping
  // / stacked / maximised windows get spread out; sizes are preserved. Windows
  // keep their rough reading-order (top-left → bottom-right) so the result feels
  // like a tidy-up of the current arrangement rather than a random reshuffle.
  const arrangeAndFit = useCallback(() => {
    const visible = windows.filter((win) => WIDGETS[win.type] && !win.minimized);
    if (!visible.length) { fitView(); return; }
    const ordered = [...visible].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const GAP = 28;
    const cols = Math.ceil(Math.sqrt(ordered.length));
    const pos = {};
    const boxes = [];
    let curX = 0, curY = 0, rowH = 0, col = 0;
    for (const win of ordered) {
      const b = winBox(win);
      pos[win.id] = { x: curX, y: curY };
      boxes.push({ x: curX, y: curY, w: b.w, h: b.h });
      curX += b.w + GAP;
      rowH = Math.max(rowH, b.h);
      if (++col >= cols) { curX = 0; curY += rowH + GAP; rowH = 0; col = 0; }
    }
    setWindows((prev) => prev.map((win) => (
      pos[win.id]
        ? { ...win, x: pos[win.id].x, y: pos[win.id].y, minimized: false, maximized: false }
        : win
    )));
    fitBoxesToView(boxes);
  }, [windows, fitView, fitBoxesToView, setWindows]);

  // Keyboard: ⌘/Ctrl + +/-/0 drive OUR zoom (and pre-empt the browser's page
  // zoom). Native pinch / ctrl-wheel zoom is suppressed below so only this
  // system ever scales the canvas.
  useEffect(() => {
    if (isMobile) return undefined;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      // Shift+0 arranges every visible window into a non-overlapping grid before
      // fitting. Match by code (Digit0) as well as key ('0'/')') so it fires
      // regardless of whether the layout reports the shifted glyph.
      const isZero = e.key === '0' || e.key === ')' || e.code === 'Digit0';
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(view.zoom + ZOOM_STEP); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(view.zoom - ZOOM_STEP); }
      else if (isZero && e.shiftKey) { e.preventDefault(); arrangeAndFit(); }
      else if (isZero) { e.preventDefault(); fitView(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, view.zoom, zoomTo, fitView, arrangeAndFit]);

  // Suppress native zoom on the workspace: trackpad pinch + ctrl-wheel arrive as
  // wheel events with ctrlKey; Safari fires gesture* events. Block them so the
  // page never zooms — only our control/shortcuts do.
  useEffect(() => {
    if (isMobile) return undefined;
    const onWheel = (e) => { if (e.ctrlKey) e.preventDefault(); };
    const onGesture = (e) => e.preventDefault();
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('gesturestart', onGesture);
    window.addEventListener('gesturechange', onGesture);
    window.addEventListener('gestureend', onGesture);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('gesturestart', onGesture);
      window.removeEventListener('gesturechange', onGesture);
      window.removeEventListener('gestureend', onGesture);
    };
  }, [isMobile]);

  // ----- Collapsible dock -----
  // Opt-in via Settings → Appearance. When on, the dock hides and slides up only
  // while the pointer is at the bottom edge (or over the dock itself).
  const { settings } = useSettings();
  const collapsibleDock = settings.collapsibleDock;
  const [dockShown, setDockShown] = useState(false);
  const dockVisible = !collapsibleDock || dockShown;

  // Windows are multi-instance: a widget can have several windows open at once,
  // each with a unique id (decoupled from its `type`). Legacy layouts where
  // id === type keep working — they're just the first instance of that type.
  const newWinId = (type) => genId(type);
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
      className="relative h-[calc(100vh-var(--header-h,3.5rem))] w-full select-none overflow-hidden bg-background text-foreground"
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

      <div ref={surfaceRef} className="absolute inset-0 overflow-hidden">
        {/* Empty canvas layer — catches drags on blank space to pan the surface.
            Sits behind every window (z-0); windows carry z ≥ 1. */}
        <div
          className={cn(
            'absolute inset-0 z-0',
            !isMobile && ['touch-none', panDrag.current ? 'cursor-grabbing' : 'cursor-grab'],
          )}
          onPointerDown={onPanDown}
          onPointerMove={onPanMove}
          onPointerUp={onPanUp}
          onPointerCancel={onPanUp}
        />

        {visibleCount === 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3.5 text-center">
            <h2 className="text-3xl font-bold">🖥️ Your workspace</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Open widgets from the dock below. Drag the title bars to move them, drag edges to resize, drag the empty desktop to pan around. Your layout is saved{isLoggedIn ? ' to your account' : ' on this device'}.
            </p>
            <Button asChild variant="outline" className="pointer-events-auto">
              <Link to="/apps">Browse all tools →</Link>
            </Button>
          </div>
        )}

        {/* Every window is rendered exactly once and stays mounted for its whole
            life — minimise hides it, maximise restyles it, but the React subtree
            (and each app's in-memory state, e.g. the open Excel workbook) never
            unmounts. Pan + zoom is applied per floating window via its own
            transform rather than a wrapping layer, so toggling maximise/minimise
            can't move a window between parents and force a remount. Floating
            windows carry z ≥ 1 so empty-space clicks fall through to the pan
            layer (z-0) below. */}
        {windows.map((win) => {
          const meta = WIDGETS[win.type];
          if (!meta) return null;
          return (
            <DesktopWindow
              key={win.id}
              win={win}
              meta={meta}
              isMobile={isMobile}
              view={view}
              zoom={view.zoom}
              onFocus={focus}
              onClose={close}
              onMinimize={minimize}
              onMaximize={maximize}
              onChange={change}
            />
          );
        })}
      </div>

      {/* Zoom control — desktop & tablet only (panning/zoom disabled on mobile). */}
      {!isMobile && (
        <div className="fixed bottom-4 right-4 z-[5000] flex items-center gap-0.5 rounded-full border bg-popover/80 p-1 text-popover-foreground shadow-lg backdrop-blur-md">
          <button
            type="button"
            title="Zoom out (⌘/Ctrl + −)"
            aria-label="Zoom out"
            onClick={() => zoomTo(view.zoom - ZOOM_STEP)}
            disabled={view.zoom <= ZOOM_MIN}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            title="Reset zoom to 100%"
            aria-label="Reset zoom"
            onClick={() => zoomTo(1)}
            className="min-w-12 rounded-full px-1 text-center text-xs font-medium tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <button
            type="button"
            title="Zoom in (⌘/Ctrl + +)"
            aria-label="Zoom in"
            onClick={() => zoomTo(view.zoom + ZOOM_STEP)}
            disabled={view.zoom >= ZOOM_MAX}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            title="Zoom to fit (⌘/Ctrl + 0)"
            aria-label="Zoom to fit"
            onClick={fitView}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Maximize className="size-4" />
          </button>
          <button
            type="button"
            title="Tidy up & fit — arrange all windows so none overlap (⌘/Ctrl + Shift + 0)"
            aria-label="Tidy up and fit windows"
            onClick={arrangeAndFit}
            className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
      )}

      {/* Bottom hover strip: with a collapsed dock, pointing here slides it up. */}
      {collapsibleDock && !dockVisible && (
        <div
          className="fixed inset-x-0 bottom-0 z-[4998] h-6"
          onMouseEnter={() => setDockShown(true)}
          onPointerEnter={() => setDockShown(true)}
        />
      )}

      <div
        ref={dockRef}
        onMouseEnter={collapsibleDock ? () => setDockShown(true) : undefined}
        onMouseLeave={collapsibleDock ? () => setDockShown(false) : undefined}
        className={cn(
          'fixed bottom-4 left-1/2 z-[5000] flex max-w-[94vw] -translate-x-1/2 gap-1.5 overflow-x-auto rounded-3xl border bg-popover/80 px-3.5 py-2.5 text-popover-foreground shadow-lg backdrop-blur-md transition-[transform,opacity] duration-300 ease-out',
          !dockVisible && 'pointer-events-none translate-y-[160%] opacity-0',
        )}
      >
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
