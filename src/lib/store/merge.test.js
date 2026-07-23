import { describe, it, expect } from 'vitest';
import { isCollection, toEnvelope, fromEnvelope, mergeEnvelopes, TOMBSTONE_TTL_MS } from './merge';

const item = (id, extra = {}) => ({ id, ...extra });

describe('isCollection', () => {
  it('accepts arrays of {id} objects', () => {
    expect(isCollection([{ id: 'a' }, { id: 'b', x: 1 }])).toBe(true);
    expect(isCollection([])).toBe(true);
  });
  it('rejects non-collections', () => {
    expect(isCollection([{ noId: 1 }])).toBe(false);
    expect(isCollection([1, 2, 3])).toBe(false);
    expect(isCollection({ id: 'x' })).toBe(false);
    expect(isCollection('str')).toBe(false);
    expect(isCollection([[{ id: 'a' }]])).toBe(false);
  });
});

describe('toEnvelope / fromEnvelope round-trip', () => {
  it('round-trips an array preserving order', () => {
    const arr = [item('a', { t: 1 }), item('b', { t: 2 }), item('c')];
    const env = toEnvelope(arr, null, 100);
    expect(fromEnvelope(env)).toEqual(arr);
    expect(env.order).toEqual(['a', 'b', 'c']);
  });

  it('only re-stamps changed items', () => {
    const env1 = toEnvelope([item('a', { t: 1 }), item('b', { t: 1 })], null, 100);
    const env2 = toEnvelope([item('a', { t: 1 }), item('b', { t: 2 })], env1, 200);
    expect(env2.items.a.m).toBe(100); // unchanged → keeps old stamp
    expect(env2.items.b.m).toBe(200); // changed → new stamp
  });

  it('tombstones removed items', () => {
    const env1 = toEnvelope([item('a'), item('b')], null, 100);
    const env2 = toEnvelope([item('a')], env1, 200);
    expect(env2.tombstones.b).toBe(200);
    expect(fromEnvelope(env2)).toEqual([item('a')]);
  });

  it('clears a tombstone when an id reappears', () => {
    let env = toEnvelope([item('a'), item('b')], null, 100);
    env = toEnvelope([item('a')], env, 200);            // delete b
    env = toEnvelope([item('a'), item('b', { r: 1 })], env, 300); // re-add b
    expect(env.tombstones.b).toBeUndefined();
    expect(fromEnvelope(env)).toEqual([item('a'), item('b', { r: 1 })]);
  });

  it('dedupes duplicate ids', () => {
    const env = toEnvelope([item('a'), item('a', { x: 2 })], null, 100);
    expect(env.order).toEqual(['a']);
  });
});

describe('mergeEnvelopes — the core guarantee', () => {
  it('edits to DIFFERENT items on two devices both survive', () => {
    const base = toEnvelope([item('a', { v: 0 }), item('b', { v: 0 })], null, 100);
    // Device A edits a; device B edits b — from the same base.
    const A = toEnvelope([item('a', { v: 1 }), item('b', { v: 0 })], base, 200);
    const B = toEnvelope([item('a', { v: 0 }), item('b', { v: 2 })], base, 300);
    const merged = mergeEnvelopes(A, B);
    const out = fromEnvelope(merged);
    expect(out).toContainEqual(item('a', { v: 1 }));
    expect(out).toContainEqual(item('b', { v: 2 }));
  });

  it('a delete survives a merge (not resurrected) when it is newer', () => {
    const base = toEnvelope([item('a'), item('b')], null, 100);
    const A = toEnvelope([item('a')], base, 300);      // A deletes b at 300
    const B = base;                                    // B still has b (stamp 100)
    const merged = mergeEnvelopes(A, B);
    expect(fromEnvelope(merged).find((x) => x.id === 'b')).toBeUndefined();
  });

  it('edit-after-delete resurrects (edit is newer than the delete)', () => {
    const base = toEnvelope([item('a'), item('b', { v: 0 })], null, 100);
    const A = toEnvelope([item('a')], base, 200);              // delete b @200
    const B = toEnvelope([item('a'), item('b', { v: 9 })], base, 300); // edit b @300
    const merged = mergeEnvelopes(A, B);
    expect(fromEnvelope(merged)).toContainEqual(item('b', { v: 9 }));
  });

  it('same-item concurrent edit → higher timestamp wins', () => {
    const base = toEnvelope([item('a', { v: 0 })], null, 100);
    const A = toEnvelope([item('a', { v: 1 })], base, 200);
    const B = toEnvelope([item('a', { v: 2 })], base, 300);
    expect(fromEnvelope(mergeEnvelopes(A, B))).toEqual([item('a', { v: 2 })]);
    // merge is commutative for the winner
    expect(fromEnvelope(mergeEnvelopes(B, A))).toEqual([item('a', { v: 2 })]);
  });

  it('is idempotent (merge with self = self)', () => {
    const env = toEnvelope([item('a', { v: 1 }), item('b', { v: 2 })], null, 100);
    expect(mergeEnvelopes(env, env)).toEqual(env);
  });

  it('handles a null side', () => {
    const env = toEnvelope([item('a')], null, 100);
    expect(mergeEnvelopes(env, null)).toEqual(env);
    expect(mergeEnvelopes(null, env)).toEqual(env);
  });

  it('takes the more-recent order and appends the other side\'s new ids', () => {
    const A = toEnvelope([item('a'), item('b')], null, 100);       // order a,b @100
    const B = toEnvelope([item('b'), item('a'), item('c')], null, 300); // order b,a,c @300
    const merged = mergeEnvelopes(A, B);
    expect(merged.order).toEqual(['b', 'a', 'c']); // B's order wins (newer), c present
  });
});

describe('tombstone pruning', () => {
  it('drops tombstones older than the TTL relative to newest stamp', () => {
    let env = toEnvelope([item('a'), item('old')], null, 1000);
    env = toEnvelope([item('a')], env, 2000); // tombstone 'old' @2000
    // Now a much newer edit pushes the horizon past the tombstone's TTL.
    env = toEnvelope([item('a', { v: 1 })], env, 2000 + TOMBSTONE_TTL_MS + 1);
    expect(env.tombstones.old).toBeUndefined();
  });

  it('keeps recent tombstones', () => {
    let env = toEnvelope([item('a'), item('b')], null, 1000);
    env = toEnvelope([item('a')], env, 2000);
    expect(env.tombstones.b).toBe(2000);
  });
});
