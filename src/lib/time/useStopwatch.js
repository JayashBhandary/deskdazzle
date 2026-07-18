// Stopwatch engine. Elapsed time is anchored to a wall-clock start timestamp
// plus accumulated paused time, so it stays exact across reloads and while the
// tab is backgrounded — no per-tick persistence needed. Smooth sub-second
// display is the view's job (useFastNow while running).

import { useCallback, useMemo, useRef } from 'react';
import { useStore } from '../store/WorkspaceProvider';

const DEFAULT = { running: false, startMs: null, accumMs: 0, laps: [] };

// Elapsed ms for a given state at a given instant.
export const elapsedOf = (sw, nowMs) =>
  sw.accumMs + (sw.running && sw.startMs != null ? Math.max(0, nowMs - sw.startMs) : 0);

export function useStopwatchEngine() {
  const [sw, setSw] = useStore('stopwatch', DEFAULT);
  const ref = useRef(sw);
  ref.current = sw;

  const start = useCallback(() => {
    const s = ref.current;
    if (s.running) return;
    setSw({ ...s, running: true, startMs: Date.now() });
  }, [setSw]);

  const stop = useCallback(() => {
    const s = ref.current;
    if (!s.running) return;
    setSw({ ...s, running: false, startMs: null, accumMs: elapsedOf(s, Date.now()) });
  }, [setSw]);

  const reset = useCallback(() => setSw(DEFAULT), [setSw]);

  const lap = useCallback(() => {
    const s = ref.current;
    const total = elapsedOf(s, Date.now());
    const prevTotal = s.laps.length ? s.laps[s.laps.length - 1].total : 0;
    setSw({ ...s, laps: [...s.laps, { total, split: total - prevTotal }] });
  }, [setSw]);

  return useMemo(
    () => ({
      running: sw.running,
      startMs: sw.startMs,
      accumMs: sw.accumMs,
      laps: sw.laps,
      hasStarted: sw.running || sw.accumMs > 0,
      start,
      stop,
      reset,
      lap,
    }),
    [sw.running, sw.startMs, sw.accumMs, sw.laps, start, stop, reset, lap],
  );
}
