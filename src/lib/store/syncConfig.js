// The live sync-write debounce, shared by every persistence layer
// (SyncedStore, useUserData, useWorkspaces).
//
// The value is a user preference ("Sync latency" in Settings), but the sync
// engine can't read the settings *store* to decide how to write that store —
// so the chosen value is mirrored to a plain localStorage key that everything
// reads synchronously at write time. A longer debounce coalesces more changes
// into each cloud write, cutting write volume and egress cost at scale.

export const SYNC_LATENCY_KEY = 'deskdazzle.syncLatencyMs';
export const DEFAULT_SYNC_LATENCY_MS = 600;
const MIN_MS = 200;
const MAX_MS = 10_000;

const clampMs = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SYNC_LATENCY_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, n));
};

// Read the current debounce (ms). Called at the moment a write is scheduled, so
// changing the preference takes effect immediately — no reload needed.
export function getSyncDebounceMs() {
  try {
    const raw = window.localStorage.getItem(SYNC_LATENCY_KEY);
    if (raw !== null) return clampMs(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_SYNC_LATENCY_MS;
}

// Mirror the preferred latency to localStorage for the sync engine to read.
export function setSyncDebounceMs(ms) {
  try {
    window.localStorage.setItem(SYNC_LATENCY_KEY, String(clampMs(ms)));
  } catch {
    /* ignore */
  }
}
