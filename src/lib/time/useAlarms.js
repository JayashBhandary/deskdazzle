// Alarms engine — a list of clock-time alarms that fire when the local time
// crosses their minute, app-wide. A one-shot alarm disables itself after firing;
// a repeating one stays armed for its selected weekdays. Firing is edge-triggered
// on the minute boundary, so opening the app partway through an alarm's minute
// won't retro-fire it.
//
// An alarm: { id, time: "HH:MM", label, enabled, days: number[] }
//   days = JS weekday indices it repeats on (0=Sun … 6=Sat). Empty = one-shot.
// Back-compat: older alarms carry a boolean `repeat` instead of `days`.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store/WorkspaceProvider';
import { uid } from './format';
import { notify, playChime, requestNotifyPermission } from './chime';

const hhmm = (d = new Date()) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Selected repeat days, tolerant of the legacy `repeat` boolean.
export const alarmDays = (a) =>
  Array.isArray(a.days) ? a.days : a.repeat ? [0, 1, 2, 3, 4, 5, 6] : [];

export function useAlarmsEngine() {
  const [alarms, setAlarms] = useStore('alarms', []);
  const ref = useRef(alarms);
  ref.current = alarms;
  // Start "primed" at the current minute so we only fire on a real transition.
  const lastMinute = useRef(hhmm());

  useEffect(() => {
    const check = () => {
      const d = new Date();
      const now = hhmm(d);
      if (now === lastMinute.current) return;
      lastMinute.current = now;
      const weekday = d.getDay();
      // Ring if the time matches AND either it's a one-shot (empty days) or
      // today is one of its selected weekdays.
      const due = ref.current.filter((a) => {
        if (!a.enabled || a.time !== now) return false;
        const days = alarmDays(a);
        return days.length === 0 || days.includes(weekday);
      });
      if (!due.length) return;
      for (const a of due) {
        const msg = a.label ? `${a.label} (${a.time})` : `Alarm — ${a.time}`;
        toast.success(msg);
        notify(msg, 'Alarm');
      }
      playChime(4);
      // One-shot alarms (no repeat days) switch off after ringing.
      setAlarms((list) =>
        list.map((a) => (due.includes(a) && alarmDays(a).length === 0 ? { ...a, enabled: false } : a)),
      );
    };
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [setAlarms]);

  const add = useCallback((time, label = '', days = []) => {
    if (!time) return;
    requestNotifyPermission();
    setAlarms((list) => [...list, { id: uid(), time, label, enabled: true, days }]);
  }, [setAlarms]);

  const update = useCallback((id, patch) => {
    if (patch.enabled) requestNotifyPermission();
    setAlarms((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, [setAlarms]);

  const toggle = useCallback((id) => {
    requestNotifyPermission();
    setAlarms((list) => list.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, [setAlarms]);

  const remove = useCallback((id) => setAlarms((list) => list.filter((a) => a.id !== id)), [setAlarms]);

  return useMemo(
    () => ({ alarms, add, update, toggle, remove }),
    [alarms, add, update, toggle, remove],
  );
}
