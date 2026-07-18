// Countdown-timers engine — a list of independent timers, each anchored to a
// wall-clock end timestamp so they stay exact and resume after a reload. A
// single global interval fires any that reach zero (toast + notification +
// chime), regardless of which page is open. Per-second display is the view's
// job (useNow); nothing is persisted on each tick.
//
// A timer: { id, label, totalMs, endMs, running, remainingMs, done }
//   running  → counting down; remainingMs = endMs - now
//   paused   → running:false, endMs:null, remainingMs frozen
//   done     → reached zero; running:false, remainingMs:0 (kept for restart)

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store/WorkspaceProvider';
import { uid, fmtDuration } from './format';
import { notify, playChime, requestNotifyPermission } from './chime';

export const remainingOf = (t, nowMs) =>
  t.running && t.endMs != null ? Math.max(0, t.endMs - nowMs) : t.remainingMs;

export function useTimersEngine() {
  const [timers, setTimers] = useStore('timers', []);
  const ref = useRef(timers);
  ref.current = timers;
  const firedRef = useRef(new Set());

  // Global firing loop.
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      let changed = false;
      const next = ref.current.map((t) => {
        if (t.running && t.endMs != null && t.endMs - now <= 0) {
          if (!firedRef.current.has(t.id)) {
            firedRef.current.add(t.id);
            const msg = t.label ? `Timer "${t.label}" finished` : 'Timer finished';
            toast.success(msg);
            notify(msg);
            playChime(3);
          }
          changed = true;
          return { ...t, running: false, endMs: null, remainingMs: 0, done: true };
        }
        return t;
      });
      if (changed) setTimers(next);
    };
    const id = setInterval(check, 250);
    return () => clearInterval(id);
  }, [setTimers]);

  const add = useCallback((totalMs, label = '') => {
    if (!totalMs || totalMs <= 0) return;
    requestNotifyPermission();
    const t = { id: uid(), label, totalMs, endMs: Date.now() + totalMs, running: true, remainingMs: totalMs, done: false };
    firedRef.current.delete(t.id);
    setTimers((list) => [...list, t]);
  }, [setTimers]);

  const pause = useCallback((id) => {
    setTimers((list) =>
      list.map((t) =>
        t.id === id && t.running
          ? { ...t, running: false, endMs: null, remainingMs: Math.max(0, t.endMs - Date.now()) }
          : t,
      ),
    );
  }, [setTimers]);

  const resume = useCallback((id) => {
    requestNotifyPermission();
    setTimers((list) =>
      list.map((t) => {
        if (t.id !== id || t.running || t.remainingMs <= 0) return t;
        firedRef.current.delete(t.id);
        return { ...t, running: true, endMs: Date.now() + t.remainingMs, done: false };
      }),
    );
  }, [setTimers]);

  const restart = useCallback((id) => {
    requestNotifyPermission();
    setTimers((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        firedRef.current.delete(t.id);
        return { ...t, running: true, endMs: Date.now() + t.totalMs, remainingMs: t.totalMs, done: false };
      }),
    );
  }, [setTimers]);

  const remove = useCallback((id) => {
    firedRef.current.delete(id);
    setTimers((list) => list.filter((t) => t.id !== id));
  }, [setTimers]);

  return useMemo(
    () => ({ timers, add, pause, resume, restart, remove }),
    [timers, add, pause, resume, restart, remove],
  );
}

export { fmtDuration };
