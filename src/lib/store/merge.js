// M-7 — per-item conflict-free merge for COLLECTION stores.
//
// Problem: the sync engine currently does whole-store last-write-wins, so two
// devices editing different items offline lose one side's work when they sync.
//
// Solution: for stores whose value is an array of `{ id, ... }` objects, keep a
// metadata "envelope" alongside the data:
//
//   {
//     items:      { [id]: { v: <item>, m: <updatedMs> } },  // live items + stamp
//     tombstones: { [id]: <deletedMs> },                     // soft-deletes
//     order:      [id, ...],                                 // display order
//     orderMs:    <number>                                   // when order changed
//   }
//
// Merging two envelopes is per-item last-writer-wins on `m` (with tombstones
// competing on the same clock), so:
//   • edits to DIFFERENT items on two devices both survive
//   • a delete survives a merge (tombstone) instead of being resurrected
//   • only a genuine SAME-item concurrent edit resolves by timestamp
//
// This module is PURE and deterministic (no clocks/IO): callers pass `now`.
// It is intentionally NOT yet wired into SyncedStore — the wiring is a separate,
// reviewed step. Prove the core here first.

// Deleting tombstones eventually so they don't grow forever. A tombstone older
// than this (relative to the newest timestamp in the envelope) is pruned; any
// device that hasn't synced in this long will re-add the item, which is an
// acceptable trade for bounded metadata.
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const eq = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

// Is this value a collection the merge engine can handle?
export function isCollection(value) {
  return Array.isArray(value)
    && value.every((x) => x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string');
}

// Reconstruct the plain array from an envelope (order preserved, tombstoned and
// dangling ids skipped).
export function fromEnvelope(env) {
  if (!env || !env.items) return [];
  const tomb = env.tombstones || {};
  return (env.order || [])
    .filter((id) => env.items[id] && !(id in tomb))
    .map((id) => env.items[id].v);
}

// Build/refresh an envelope from the current array, diffing against `prev` so
// only genuinely changed/new items get a fresh `m` stamp. Removed items become
// tombstones. `now` is the timestamp to stamp changes with.
export function toEnvelope(array, prev, now) {
  const prevItems = (prev && prev.items) || {};
  const items = {};
  const tombstones = { ...((prev && prev.tombstones) || {}) };
  const order = [];
  const seen = new Set();

  for (const el of array) {
    const id = el.id;
    if (seen.has(id)) continue; // ignore duplicate ids
    seen.add(id);
    order.push(id);
    delete tombstones[id]; // present again → resurrected, clear tombstone
    const prevEntry = prevItems[id];
    items[id] = (prevEntry && eq(prevEntry.v, el)) ? prevEntry : { v: el, m: now };
  }

  // Anything present before but gone now → tombstone at `now`.
  for (const id of Object.keys(prevItems)) {
    if (!seen.has(id) && !(id in tombstones)) tombstones[id] = now;
  }

  const prevOrder = (prev && prev.order ? prev.order : []).filter((id) => seen.has(id));
  const orderChanged = prevOrder.length !== order.length || prevOrder.some((id, i) => id !== order[i]);
  const orderMs = orderChanged ? now : ((prev && prev.orderMs) || now);

  return prune({ items, tombstones, order, orderMs });
}

// Merge two envelopes. Per-item LWW; the item/tombstone with the highest `m`
// wins (tie → keep the item, never lose data). Order comes from whichever side
// changed order most recently, with the other side's extra ids appended.
export function mergeEnvelopes(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  const aItems = a.items || {}, bItems = b.items || {};
  const aTomb = a.tombstones || {}, bTomb = b.tombstones || {};
  const ids = new Set([
    ...Object.keys(aItems), ...Object.keys(bItems),
    ...Object.keys(aTomb), ...Object.keys(bTomb),
  ]);

  const items = {};
  const tombstones = {};
  for (const id of ids) {
    const cands = [];
    if (aItems[id]) cands.push({ kind: 'item', m: aItems[id].m, v: aItems[id].v });
    if (bItems[id]) cands.push({ kind: 'item', m: bItems[id].m, v: bItems[id].v });
    if (aTomb[id] != null) cands.push({ kind: 'tomb', m: aTomb[id] });
    if (bTomb[id] != null) cands.push({ kind: 'tomb', m: bTomb[id] });
    // Highest m wins; on a tie prefer the live item over a tombstone.
    cands.sort((x, y) => (y.m - x.m) || (x.kind === 'item' ? -1 : 1));
    const win = cands[0];
    if (win.kind === 'item') items[id] = { v: win.v, m: win.m };
    else tombstones[id] = win.m;
  }

  // Order: base on the side whose order changed more recently.
  const base = (a.orderMs || 0) >= (b.orderMs || 0) ? a : b;
  const other = base === a ? b : a;
  const orderMs = Math.max(a.orderMs || 0, b.orderMs || 0);
  const order = [];
  const placed = new Set();
  const push = (id) => { if (items[id] && !placed.has(id)) { order.push(id); placed.add(id); } };
  for (const id of (base.order || [])) push(id);
  for (const id of (other.order || [])) push(id);
  for (const id of Object.keys(items)) push(id); // safety net

  return prune({ items, tombstones, order, orderMs });
}

// Drop tombstones older than TOMBSTONE_TTL_MS relative to the newest stamp.
function prune(env) {
  const stamps = [
    ...Object.values(env.items).map((e) => e.m),
    ...Object.values(env.tombstones),
    env.orderMs || 0,
  ];
  const newest = stamps.length ? Math.max(...stamps) : 0;
  const cutoff = newest - TOMBSTONE_TTL_MS;
  const tombstones = {};
  for (const [id, m] of Object.entries(env.tombstones)) {
    if (m >= cutoff) tombstones[id] = m;
  }
  return { items: env.items, tombstones, order: env.order, orderMs: env.orderMs };
}
