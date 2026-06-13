import React, { useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from '../App';

// A draggable / resizable window hosting a single widget.
// Drag + resize are implemented with native pointer events (no external
// dependency) so it works reliably on React 19.
function DesktopWindow({ win, meta, isMobile, onFocus, onClose, onMinimize, onMaximize, onChange }) {
  const { theme } = useContext(ThemeContext);
  const [geo, setGeo] = useState({ x: win.x, y: win.y, width: win.width, height: win.height });
  const rootRef = useRef(null);
  const drag = useRef(null);
  const dragging = useRef(false);

  // Keep local geometry in sync when the window's saved geometry changes
  // externally (e.g. a layout loaded from Firestore), but never mid-drag.
  useEffect(() => {
    if (!dragging.current) {
      setGeo({ x: win.x, y: win.y, width: win.width, height: win.height });
    }
  }, [win.x, win.y, win.width, win.height]);

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
    if (e.target.closest('.dwin__btn')) return;
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
    const width = Math.max(240, drag.current.ow + (e.clientX - drag.current.px));
    const height = Math.max(190, drag.current.oh + (e.clientY - drag.current.py));
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

  return (
    <div
      ref={rootRef}
      className={`dwin ${theme ? 'dark' : 'light'}`}
      style={style}
      onMouseDown={() => onFocus(win.id)}
    >
      <div
        className='dwin__bar'
        onPointerDown={maximized ? undefined : onDragDown}
        onPointerMove={maximized ? undefined : onDragMove}
        onPointerUp={maximized ? undefined : onDragUp}
        style={{ cursor: maximized ? 'default' : 'move' }}
      >
        <span className='dwin__title'>{meta.icon} {meta.title}</span>
        <div className='dwin__controls'>
          <span className='dwin__btn' title='Minimize' onClick={() => onMinimize(win.id)}>–</span>
          {!isMobile && (
            <span className='dwin__btn' title={win.maximized ? 'Restore' : 'Maximize'} onClick={() => onMaximize(win.id)}>▢</span>
          )}
          <span className='dwin__btn dwin__btn--close' title='Close' onClick={() => onClose(win.id)}>×</span>
        </div>
      </div>

      <div className='dwin__body'>
        <Body />
      </div>

      {!maximized && (
        <div
          className='dwin__resize'
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
        />
      )}
    </div>
  );
}

export default DesktopWindow
