// Shift+B toggles an app's sidebar. Shared by the apps that have a collapsible
// sidebar (Excel, Word, Notes, PPT).
//
// Implemented as a window-level keydown listener (so it fires even before the
// user has clicked into the app), but scoped: it only toggles when focus is
// inside this app's root — or nowhere (document body) so the full-page tool view
// works on load. It is ignored while typing in a field, since Shift+B is an
// ordinary character.

import { useEffect } from 'react';

export function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useSidebarShortcut(rootRef, setSidebarOpen) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key !== 'B' && e.key !== 'b') || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      const ae = document.activeElement;
      if (isTypingTarget(ae)) return;
      const root = rootRef.current;
      if (!root) return;
      const focusInside = root.contains(ae);
      const noFocus = !ae || ae === document.body || ae === document.documentElement;
      if (!focusInside && !noFocus) return;
      e.preventDefault();
      setSidebarOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rootRef, setSidebarOpen]);
}
