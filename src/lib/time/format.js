// Time formatting + small helpers shared across the Clock app and widgets.

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// mm:ss, rounding up — focus timer and short countdowns.
export const fmt = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// H:MM:SS (or MM:SS when under an hour), rounding up — countdown timers.
export const fmtDuration = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// MM:SS.cs (or H:MM:SS.cs), flooring — stopwatch, shows hundredths.
export const fmtStopwatch = (ms) => {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const cs = Math.floor((clamped % 1000) / 10);
  const base =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${base}.${String(cs).padStart(2, '0')}`;
};

// Best-effort unique id for list items (alarms, timers, laps).
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
