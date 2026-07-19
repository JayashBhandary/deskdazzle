import React, { useEffect, useRef, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// A draggable / resizable window hosting a single widget.
// Drag + resize are implemented with native pointer events (no external
// dependency) so it works reliably on React 19.
function DesktopWindow({ win, meta, isMobile, onFocus, onClose, onMinimize, onMaximize, onChange }) {
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

  if (win.minimized) return null;

  const maximized = win.maximized || isMobile;
  const Body = meta.component;

  const surfaceSize = () => {
    const surface = rootRef.current?.parentElement;
    return {
      w: surface?.clientWidth ?? window.innerWidth,
      h: surface?.clientHeight ?? window.innerHeight,
    };
  };

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
    const { w, h } = surfaceSize();
    let x = drag.current.ox + (e.clientX - drag.current.px);
    let y = drag.current.oy + (e.clientY - drag.current.py);
    x = Math.max(0, Math.min(x, w - geo.width));
    y = Math.max(0, Math.min(y, h - 40));
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
    const width = Math.max(minW, drag.current.ow + (e.clientX - drag.current.px));
    const height = Math.max(minH, drag.current.oh + (e.clientY - drag.current.py));
    setGeo((g) => ({ ...g, width, height }));
  };
  const onResizeUp = (e) => {
    if (!drag.current) return;
    drag.current = null;
    dragging.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setGeo((g) => { onChange(win.id, { width: g.width, height: g.height }); return g; });
  };

  const style = maximized
    ? { position: 'absolute', inset: 0, zIndex: win.z }
    : { position: 'absolute', left: geo.x, top: geo.y, width: geo.width, height: geo.height, zIndex: win.z };

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

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <Body />
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
