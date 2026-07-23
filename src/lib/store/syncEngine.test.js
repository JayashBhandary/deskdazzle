import { describe, it, expect, beforeEach } from 'vitest';
import { SyncedStore } from './syncEngine';
import { fromEnvelope } from './merge';

// Local-path integration (no signed-in user → no RTDB). Verifies the store
// maintains the merge envelope for collection stores and persists it across a
// reload, and leaves scalar stores on plain last-write-wins.
describe('SyncedStore — collection envelope (local)', () => {
  beforeEach(() => window.localStorage.clear());

  it('builds an envelope for a collection store and reflects the value', () => {
    const s = new SyncedStore('notes', []);
    s.set([{ id: 'a', t: 1 }, { id: 'b', t: 2 }]);
    expect(s.getSnapshot()).toEqual([{ id: 'a', t: 1 }, { id: 'b', t: 2 }]);
    expect(s.env).toBeTruthy();
    expect(Object.keys(s.env.items).sort()).toEqual(['a', 'b']);
    expect(fromEnvelope(s.env)).toEqual(s.getSnapshot());
    s.dispose();
  });

  it('tombstones a removed item and persists env across reload', () => {
    const key = 'flashcards';
    const s = new SyncedStore(key, []);
    s.set([{ id: 'a' }, { id: 'b' }]);
    s.set([{ id: 'a' }]); // remove b
    expect(s.env.tombstones.b).toBeGreaterThan(0);
    s.dispose();

    // A fresh instance (simulating reload) rehydrates value + envelope.
    const s2 = new SyncedStore(key, []);
    expect(s2.getSnapshot()).toEqual([{ id: 'a' }]);
    expect(s2.env.tombstones.b).toBeGreaterThan(0);
    s2.dispose();
  });

  it('keeps scalar stores on plain value (no envelope)', () => {
    const s = new SyncedStore('theme', true);
    s.set(false);
    expect(s.getSnapshot()).toBe(false);
    expect(s.env).toBeNull();
    s.dispose();
  });

  it('treats arrays of primitives as scalars (no envelope)', () => {
    const s = new SyncedStore('tags', []);
    s.set(['x', 'y']);
    expect(s.env).toBeNull();
    expect(s.getSnapshot()).toEqual(['x', 'y']);
    s.dispose();
  });
});
