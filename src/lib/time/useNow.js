// One shared clock for the whole app.
//
// Instead of every clock face and countdown spinning its own setInterval, they
// all subscribe to a single ticker here. The interval only runs while at least
// one component is mounted, and stops itself when the last one unmounts.
//
// `useNow()` re-renders the calling component roughly once a second and returns
// the current time in milliseconds (a stable value between ticks, so it plays
// nicely with useSyncExternalStore).

import { useEffect, useState, useSyncExternalStore } from 'react';

const subs = new Set();
let intervalId = null;
let now = Date.now();

function tick() {
  now = Date.now();
  for (const fn of subs) fn();
}

function subscribe(fn) {
  subs.add(fn);
  if (intervalId === null) {
    now = Date.now();
    intervalId = setInterval(tick, 1000);
  }
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

const getSnapshot = () => now;

/** Current time in ms, refreshed ~once per second from the shared ticker. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Current time in ms, refreshed every animation frame — but ONLY while `active`
 * is true and the component is mounted. For smooth sub-second displays like the
 * stopwatch, where per-second granularity isn't enough.
 */
export function useFastNow(active) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    let raf;
    const loop = () => {
      setT(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return t;
}
