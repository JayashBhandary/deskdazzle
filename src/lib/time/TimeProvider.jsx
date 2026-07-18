// The central "time" layer for Desk Dazzle — one place that owns everything
// time-related so the Clock app and the desktop widget are just views:
//
//   • focus / pomodoro  (usePomodoroEngine)
//   • stopwatch         (useStopwatchEngine)
//   • countdown timers  (useTimersEngine)
//   • alarms            (useAlarmsEngine)
//
// Every engine runs here, at the root, so sessions keep ticking and alarms /
// timers fire no matter which page is open. Each is exposed through its own
// context+hook so a consumer only re-renders for the slice it reads (e.g. the
// world-clock tab doesn't re-render every time the focus countdown changes).
//
// World clocks are plain persisted data (a list of timezones) with no engine —
// the Clock app reads them directly via useStore and renders off the shared
// ticker.

import React, { createContext, useContext } from 'react';
import { usePomodoroEngine } from './usePomodoro';
import { useStopwatchEngine } from './useStopwatch';
import { useTimersEngine } from './useTimers';
import { useAlarmsEngine } from './useAlarms';

const PomodoroContext = createContext(null);
const StopwatchContext = createContext(null);
const TimersContext = createContext(null);
const AlarmsContext = createContext(null);

export function TimeProvider({ children }) {
  const pomodoro = usePomodoroEngine();
  const stopwatch = useStopwatchEngine();
  const timers = useTimersEngine();
  const alarms = useAlarmsEngine();

  return (
    <PomodoroContext.Provider value={pomodoro}>
      <StopwatchContext.Provider value={stopwatch}>
        <TimersContext.Provider value={timers}>
          <AlarmsContext.Provider value={alarms}>{children}</AlarmsContext.Provider>
        </TimersContext.Provider>
      </StopwatchContext.Provider>
    </PomodoroContext.Provider>
  );
}

const useCtx = (Ctx, name) => {
  const v = useContext(Ctx);
  if (!v) throw new Error(`${name} must be used within <TimeProvider>`);
  return v;
};

/** Focus / pomodoro timer — state + actions. */
export const useTimer = () => useCtx(PomodoroContext, 'useTimer');
/** Stopwatch — state + actions (compute live elapsed with elapsedOf). */
export const useStopwatch = () => useCtx(StopwatchContext, 'useStopwatch');
/** Countdown timers list — state + actions. */
export const useTimers = () => useCtx(TimersContext, 'useTimers');
/** Alarms list — state + actions. */
export const useAlarms = () => useCtx(AlarmsContext, 'useAlarms');

// Re-exports so existing importers of these from TimeProvider keep working.
export { PHASES } from './usePomodoro';
export { fmt, dayKey } from './format';
