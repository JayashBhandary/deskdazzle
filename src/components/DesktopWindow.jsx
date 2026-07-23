import React, { useEffect, useRef, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// A draggable / resizable window hosting a single widget.
// Drag + resize are implemented with native pointer events (no external
// dependency) so it works reliably on React 19.
function DesktopWindow({ win, meta, isMobile, view = { x: 0, y: 0 }, zoom = 1, onFocus, onClose, onMinimize, onMaximize, onChange }) {
  // Never render (or persist) a window smaller than its widget's safe area, so
  // layouts saved under an older, smaller floor snap up instead of cropping.
  const minW = meta.minW ?? 240;
  const minH = meta.minH ?? 190;
  const [geo, setGeo] = useState({
    x: win.x, y: win.y,
    width: Math.max(win.width, minW), height: Math.max(win.height, minH),
  });
  const rootRef = useRef(null);
  const drag = useRef(null);
  const dragging = useRef(false);

  // Keep local geometry in sync when the window's saved geometry changes
  // externally (e.g. a layout loaded from Firestore), but never mid-drag.
  useEffect(() => {
    if (!dragging.current) {
      setGeo({
        x: win.x, y: win.y,
        width: Math.max(win.width, minW), height: Math.max(win.height, minH),
      });
    }
  }, [win.x, win.y, win.width, win.height, minW, minH]);

  // A minimised window stays mounted (so its app keeps its state) but hidden;
  // never early-return null, or React would tear the subtree down.
  const maximized = win.maximized || isMobile;
  const Body = meta.component;

  // ----- Dragging (title bar) -----
  const onDragDown = (e) => {
    if (e.target.closest('[data-win-btn]')) return;
    onFocus(win.id);
    dragging.current = true;
    drag.current = { px: e.clientX, py: e.clientY, ox: geo.x, oy: geo.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e) => {
    if (!drag.current) return;
    // Canvas coordinates are unbounded (the desktop is an infinite, pannable
    // surface), so the pointer delta maps straight through with no clamping —
    // a window pushed off-screen is always reachable again by panning. Divide
    // the screen-space delta by the zoom so a drag tracks the cursor 1:1.
    const x = drag.current.ox + (e.clientX - drag.current.px) / zoom;
    const y = drag.current.oy + (e.clientY - drag.current.py) / zoom;
    setGeo((g) => ({ ...g, x, y }));
  };
  const onDragUp = (e) => {
    if (!drag.current) return;
    drag.current = null;
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setGeo((g) => { onChange(win.id, { x: g.x, y: g.y }); return g; });
  };

  // ----- Resizing (bottom-right handle) -----
  const onResizeDown = (e) => {
    e.stopPropagation();
    onFocus(win.id);
    dragging.current = true;
    drag.current = { px: e.clientX, py: e.clientY, ow: geo.width, oh: geo.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e) => {
    if (!drag.current) return;
    // Clamp to the widget's "safe area" so its content can never be cropped.
    // Screen-space delta is divided by zoom so the handle tracks the cursor.
    const width = Math.max(minW, drag.current.ow + (e.clientX - drag.current.px) / zoom);
    const height = Math.max(minH, drag.current.oh + (e.clientY - drag.current.py) / zoom);
    setGeo((g) => ({ ...g, width, height }));
  };
  const onResizeUp = (e) => {
    if (!drag.current) return;
    drag.current = null;
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setGeo((g) => { onChange(win.id, { width: g.width, height: g.height }); return g; });
  };

  // Maximized (and all mobile) windows fill the whole VIEWPORT and sit above the
  // header and dock: `position: fixed` (viewport-relative — no transformed
  // ancestor traps it, and it escapes the surface's `overflow-hidden`) with a
  // z-index above all page chrome. The header is z-40 and the dock / zoom
  // controls are z-[5000], so we base maximized windows well above that; `win.z`
  // still layers multiple maximized windows relative to each other. Floating
  // windows apply pan + zoom themselves: the element sits at (0,0) and a
  // top-left-origin transform places its canvas coordinate on screen and scales
  // it — screen top-left = view + zoom·geo. Doing this per-window (instead of via
  // a shared transformed parent) lets every window keep a single, stable place
  // in the tree across maximise/minimise.
  const MAXIMIZED_Z_BASE = 100000; // above header (z-40) and dock/controls (z-5000)
  const style = maximized
    ? { position: 'fixed', inset: 0, zIndex: MAXIMIZED_Z_BASE + (win.z || 0) }
    : {
        position: 'absolute', left: 0, top: 0,
        width: geo.width, height: geo.height,
        transformOrigin: '0 0',
        transform: `translate(${view.x + geo.x * zoom}px, ${view.y + geo.y * zoom}px) scale(${zoom})`,
        zIndex: win.z,
      };
  // Minimised: keep it mounted but out of sight and non-interactive.
  if (win.minimized) style.display = 'none';

  const trafficBtn = 'group flex size-3.5 items-center justify-center rounded-full transition-colors [&_svg]:opacity-0 [&_svg]:transition-opacity hover:[&_svg]:opacity-100';

  return (
    <div
      ref={rootRef}
      className={cn(
        'flex flex-col overflow-hidden border bg-card text-card-foreground shadow-lg',
        maximized ? 'rounded-none' : 'rounded-lg',
      )}
      style={style}
      onMouseDown={() => onFocus(win.id)}
    >
      <div
        className="relative flex shrink-0 touch-none select-none items-center gap-3 border-b bg-muted/50 px-3 py-2"
        onPointerDown={maximized ? undefined : onDragDown}
        onPointerMove={maximized ? undefined : onDragMove}
        onPointerUp={maximized ? undefined : onDragUp}
        style={{ cursor: maximized ? 'default' : 'move' }}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-win-btn
            title="Close"
            aria-label="Close"
            onClick={() => onClose(win.id)}
            className={cn(trafficBtn, 'bg-red-500 text-red-950 hover:bg-red-400')}
          >
            <X className="size-2.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            data-win-btn
            title="Minimize"
            aria-label="Minimize"
            onClick={() => onMinimize(win.id)}
            className={cn(trafficBtn, 'bg-amber-400 text-amber-950 hover:bg-amber-300')}
          >
            <Minus className="size-2.5" strokeWidth={3} />
          </button>
          {!isMobile && (
            <button
              type="button"
              data-win-btn
              title={win.maximized ? 'Restore' : 'Maximize'}
              aria-label={win.maximized ? 'Restore' : 'Maximize'}
              onClick={() => onMaximize(win.id)}
              className={cn(trafficBtn, 'bg-green-500 text-green-950 hover:bg-green-400')}
            >
              <Square className="size-2" strokeWidth={3} />
            </button>
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-0 mx-auto max-w-[60%] truncate text-center text-sm font-semibold">
          {meta.icon} {meta.title}
        </span>
      </div>

      {/* `select-none` keeps a drag across the desktop from highlighting a
          widget's labels, buttons, headings and displays. Real text entry
          (inputs/textareas), editable content, and anything explicitly marked
          `[data-selectable]` opts back in — see index.css. */}
      <div className="desk-window-body min-h-0 flex-1 select-none overflow-auto p-3">
        <React.Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          <Body />
        </React.Suspense>
      </div>

      {!maximized && (
        <div
          className="absolute bottom-0 right-0 size-4 cursor-nwse-resize touch-none opacity-60 hover:opacity-100 bg-[linear-gradient(135deg,transparent_0_50%,var(--muted-foreground)_50%_60%,transparent_60%_70%,var(--muted-foreground)_70%_80%,transparent_80%)]"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
    </div>
  );
}

export default DesktopWindow
