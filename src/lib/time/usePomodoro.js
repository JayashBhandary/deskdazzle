// The focus (pomodoro) engine. Runs at the provider level so a session keeps
// ticking across navigation; runtime persists via useStore('timer') so a reload
// resumes an in-flight session (the countdown is anchored to a wall-clock end
// timestamp). Settings + daily history live in useStore('pomodoro').

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store/WorkspaceProvider';
import { useNow } from './useNow';
import { dayKey, fmt } from './format';
import { notify, playChime, requestNotifyPermission } from './chime';

export const PHASES = {
  work: { label: 'Focus', emoji: '🎯' },
  short: { label: 'Short break', emoji: '☕' },
  long: { label: 'Long break', emoji: '🌴' },
};

const DEFAULT_SETTINGS = { work: 25, shortBreak: 5, longBreak: 15, longEvery: 4, history: {} };
const DEFAULT_TIMER = { phase: 'work', running: false, endMs: null, remaining: 25 * 60_000, cycleCount: 0 };

export function usePomodoroEngine() {
  const [settings, setSettings] = useStore('pomodoro', DEFAULT_SETTINGS);
  const [timer, setTimer] = useStore('timer', DEFAULT_TIMER);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const firedRef = useRef(false);
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : 'Desk Dazzle');

  const longEvery = Math.max(1, Number(settings.longEvery) || 4);

  const minutesOf = (phase, s = settingsRef.current) =>
    phase === 'work' ? s.work : phase === 'short' ? s.shortBreak : s.longBreak;
  const durationMs = (phase) => Math.max(1, Number(minutesOf(phase)) || 1) * 60_000;

  const advance = useCallback((completed) => {
    const prev = timerRef.current;
    let cycleCount = prev.cycleCount;
    let next;
    if (prev.phase === 'work') {
      if (completed) {
        const key = dayKey();
        setSettings((d) => ({
          ...d,
          history: { ...(d.history ?? {}), [key]: (d.history?.[key] ?? 0) + 1 },
        }));
      }
      cycleCount = prev.cycleCount + 1;
      next = cycleCount % longEvery === 0 ? 'long' : 'short';
    } else {
      if (prev.phase === 'long') cycleCount = 0;
      next = 'work';
    }
    setTimer({ phase: next, running: false, endMs: null, remaining: durationMs(next), cycleCount });
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [longEvery, setSettings, setTimer]);

  const handleComplete = useCallback(() => {
    const finished = PHASES[timerRef.current.phase].label;
    const wasWork = timerRef.current.phase === 'work';
    const next = advance(true);
    const msg = wasWork
      ? `Focus session complete — time for a ${PHASES[next].label.toLowerCase()}!`
      : `${finished} over — ready to focus?`;
    toast.success(msg);
    notify(msg);
    playChime(2);
  }, [advance]);

  // Fire completion against the stored end-timestamp, reliably and promptly,
  // regardless of which page is mounted.
  useEffect(() => {
    if (!timer.running || timer.endMs == null) return undefined;
    firedRef.current = false;
    const check = () => {
      if (timerRef.current.endMs - Date.now() <= 0 && !firedRef.current) {
        firedRef.current = true;
        handleComplete();
      }
    };
    check();
    const id = setInterval(check, 250);
    return () => clearInterval(id);
  }, [timer.running, timer.endMs, handleComplete]);

  // First run only: adopt the saved focus length if the runtime is untouched.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const t = timerRef.current;
    const full = durationMs(t.phase);
    if (!t.running && t.endMs == null && t.remaining === DEFAULT_TIMER.remaining && full !== t.remaining) {
      setTimer({ ...t, remaining: full });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    requestNotifyPermission();
    firedRef.current = false;
    const t = timerRef.current;
    setTimer({ ...t, running: true, endMs: Date.now() + t.remaining });
  }, [setTimer]);

  const pause = useCallback(() => {
    const t = timerRef.current;
    const remaining = t.endMs != null ? Math.max(0, t.endMs - Date.now()) : t.remaining;
    setTimer({ ...t, running: false, endMs: null, remaining });
  }, [setTimer]);

  const reset = useCallback(() => {
    const t = timerRef.current;
    setTimer({ ...t, running: false, endMs: null, remaining: durationMs(t.phase) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTimer]);

  const skip = useCallback(() => {
    const next = advance(false);
    toast(`Skipped to ${PHASES[next].label.toLowerCase()}`);
  }, [advance]);

  const setSetting = useCallback((field, rawValue, affectedPhase) => {
    const value = rawValue === '' ? '' : Math.max(1, Math.min(999, Math.floor(Number(rawValue)) || 1));
    setSettings((d) => ({ ...d, [field]: value }));
    const t = timerRef.current;
    if (!t.running && affectedPhase === t.phase && value !== '') {
      setTimer({ ...t, remaining: value * 60_000 });
    }
  }, [setSettings, setTimer]);

  const nowMs = useNow();
  const remaining =
    timer.running && timer.endMs != null ? Math.max(0, timer.endMs - nowMs) : timer.remaining;

  // Show the live focus countdown in the tab title while running; restore after.
  useEffect(() => {
    document.title = timer.running
      ? `${fmt(remaining)} · ${PHASES[timer.phase].label} — Desk Dazzle`
      : baseTitle.current;
  }, [timer.running, remaining, timer.phase]);
  useEffect(() => {
    const title = baseTitle.current;
    return () => {
      document.title = title;
    };
  }, []);

  return useMemo(
    () => ({
      phase: timer.phase,
      running: timer.running,
      remaining,
      cycleCount: timer.cycleCount,
      longEvery,
      settings,
      history: settings.history ?? {},
      todayCount: settings.history?.[dayKey()] ?? 0,
      label: PHASES[timer.phase].label,
      emoji: PHASES[timer.phase].emoji,
      start,
      pause,
      reset,
      skip,
      setSetting,
    }),
    [timer.phase, timer.running, remaining, timer.cycleCount, longEvery, settings, start, pause, reset, skip, setSetting],
  );
}

export { fmt, dayKey };
