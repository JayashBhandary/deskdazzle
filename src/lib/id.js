// Collision-resistant id generator shared across the app. Prefers the platform
// UUID (crypto.randomUUID) and falls back to a timestamp + random suffix only on
// engines that lack it. Pass an optional short prefix for readability
// (e.g. newId('x') → "x-<uuid>").
export function newId(prefix = '') {
  const base = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return prefix ? `${prefix}-${base}` : base;
}
