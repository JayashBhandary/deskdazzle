// Per-store sync engine — the heart of the Desk Dazzle "kernel".
//
// Each store is one named slice of workspace state (notes, flashcards, …).
// Every store is persisted the same way:
//   • localStorage (`deskdazzle.<name>`) — instant first paint + offline truth
//   • Firebase RTDB mirror at `users/<uid>/stores/<name>` when signed in
//   • BroadcastChannel — live sync across this browser's open tabs
//   • last-write-wins on a millisecond `updatedMs` stamp
//
// Each store is scoped to the active *workspace* (like a macOS Space): the
// default workspace keeps the original un-prefixed keys so existing on-device
// and cloud data carry over untouched, while any other workspace lives under an
// isolated namespace (`deskdazzle.ws.<ws>.<name>` locally,
// `users/<uid>/workspaces/<ws>/stores/<name>` remotely).
//
// The RTDB payload is `{ json: "<stringified value>", updatedMs }`. Stringifying
// sidesteps RTDB's array/null coercion, so ANY JSON value round-trips losslessly.

import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../../firebaseConfig';
import { bus, TAB_ID } from '../broadcast';
import { getSyncDebounceMs } from './syncConfig';
import { isPageVisible, onVisibilityChange } from './visibility';
import { logger } from '../logger';
import { isCollection, toEnvelope, fromEnvelope, mergeEnvelopes } from './merge';

// Cheap structural check: does a parsed remote payload look like a merge
// envelope (vs a plain value / legacy array)?
const isEnvelope = (x) =>
  x && typeof x === 'object' && !Array.isArray(x)
  && x.items && typeof x.items === 'object' && Array.isArray(x.order);

const eq = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

export const DEFAULT_WORKSPACE = 'default';

// Never push more than this to the cloud in one store. A store that grows past
// it (e.g. a huge imported spreadsheet) stays local-only rather than hammering
// RTDB / the network on every debounced write. localStorage writes are already
// wrapped in try/catch, so oversize data degrades gracefully instead of crashing.
const MAX_REMOTE_BYTES = 900 * 1024;

// The default workspace maps to the legacy (un-prefixed) locations for backward
// compatibility; every other workspace gets its own isolated namespace.
const isDefault = (ws) => !ws || ws === DEFAULT_WORKSPACE;
const localKeyOf = (ws, name) =>
  isDefault(ws) ? `deskdazzle.${name}` : `deskdazzle.ws.${ws}.${name}`;
const remotePathOf = (ws, uid, name) =>
  isDefault(ws)
    ? `users/${uid}/stores/${name}`
    : `users/${uid}/workspaces/${ws}/stores/${name}`;

export class SyncedStore {
  constructor(name, initial, workspaceId = DEFAULT_WORKSPACE) {
    this.name = name;
    this.initial = initial;
    this.workspaceId = workspaceId;
    this.subs = new Set();
    this.uid = null;
    this.detach = null;
    this.timer = null;
    this._localKey = localKeyOf(workspaceId, name);
    this._metaKey = `${this._localKey}.meta`;
    this._envKey = `${this._localKey}.env`;
    this.value = this._readLocal();
    this.updatedMs = this._readMeta();
    // Merge envelope for COLLECTION stores (arrays of {id} objects). null for
    // scalar/object stores, which keep whole-value last-write-wins. See merge.js.
    this.env = this._readEnv();

    // Another tab mutated the same store → adopt its localStorage value.
    this.offBus = bus.on((msg) => {
      if (msg.kind === 'data-changed' && msg.store === this._localKey && msg.tabId !== TAB_ID) {
        this._reloadLocal();
      }
    });

    // Release / re-attach the live listener as the tab is hidden / shown, so a
    // backgrounded tab doesn't hold an RTDB connection needlessly.
    this.offVis = onVisibilityChange(() => this._syncListener());
  }

  _readLocal() {
    try {
      const raw = window.localStorage.getItem(this._localKey);
      return raw !== null ? JSON.parse(raw) : this.initial;
    } catch {
      return this.initial;
    }
  }

  _readMeta() {
    try {
      return Number(window.localStorage.getItem(this._metaKey)) || 0;
    } catch {
      return 0;
    }
  }

  _readEnv() {
    try {
      const raw = window.localStorage.getItem(this._envKey);
      return raw !== null ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // localStorage always holds the PLAIN value (apps read it directly for first
  // paint); the merge envelope is persisted alongside under `.env` so tombstones
  // and per-item stamps survive a reload. Only the plain value emits to React.
  _writeLocal(value, updatedMs) {
    try {
      window.localStorage.setItem(this._localKey, JSON.stringify(value));
      window.localStorage.setItem(this._metaKey, String(updatedMs));
      if (this.env) window.localStorage.setItem(this._envKey, JSON.stringify(this.env));
      else window.localStorage.removeItem(this._envKey);
    } catch {
      // ignore quota / availability errors
    }
  }

  _reloadLocal() {
    this.value = this._readLocal();
    this.updatedMs = this._readMeta();
    this.env = this._readEnv();
    this._emit();
  }

  // --- React binding (useSyncExternalStore) ---
  getSnapshot = () => this.value;
  subscribe = (fn) => {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  };
  _emit() {
    for (const fn of this.subs) fn();
  }

  // Public setter — accepts a value or an updater fn, like React's setState.
  set = (next) => {
    const value = typeof next === 'function' ? next(this.value) : next;
    this.value = value;
    this.updatedMs = Date.now();
    // Maintain the merge envelope for collection stores; scalars clear it.
    this.env = isCollection(value) ? toEnvelope(value, this.env, this.updatedMs) : null;
    this._writeLocal(value, this.updatedMs);
    bus.dataChanged(this._localKey);
    this._scheduleRemoteWrite();
    this._emit();
  };

  _scheduleRemoteWrite() {
    if (!this.uid) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._flush(), getSyncDebounceMs());
  }

  _flush() {
    this.timer = null;
    if (!this.uid) return;
    let json;
    try {
      // Collection stores sync the envelope (per-item merge metadata); scalar /
      // object stores sync the plain value (whole-value last-write-wins).
      json = JSON.stringify(this.env ? this.env : this.value);
    } catch {
      return; // unserializable — nothing to sync
    }
    if (json.length > MAX_REMOTE_BYTES) {
      if (!this._warnedSize) {
        this._warnedSize = true;
        logger.warn(
          `[syncEngine] store "${this.name}" is ${(json.length / 1024) | 0}KB ` +
            `(> ${MAX_REMOTE_BYTES / 1024}KB) — keeping it local-only, not syncing to the cloud.`,
        );
      }
      return;
    }
    this._warnedSize = false;
    update(ref(rtdb, remotePathOf(this.workspaceId, this.uid, this.name)), {
      json,
      updatedMs: this.updatedMs,
    }).catch(() => {});
  }

  // Attach/detach the live RTDB mirror as the signed-in user changes.
  setUid(uid) {
    if (this.uid === uid) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this._flush(); // don't lose a pending write aimed at the previous uid
    }
    this._detach();
    this.uid = uid;
    this._syncListener();
  }

  // The live listener is held only while signed in AND the tab is visible.
  _syncListener() {
    const want = !!this.uid && isPageVisible();
    if (want && !this.detach) this._attach();
    else if (!want && this.detach) { this._flush(); this._detach(); }
  }

  _attach() {
    const r = ref(rtdb, remotePathOf(this.workspaceId, this.uid, this.name));
    // onValue (modular SDK) returns its own unsubscribe function.
    this.detach = onValue(r, (snap) => {
      const val = snap.val();
      if (!val || typeof val.json !== 'string') {
        // Remote empty but we have local data → seed the cloud copy.
        if (this.updatedMs > 0 || this.env) this._scheduleRemoteWrite();
        return;
      }
      const remoteMs = Number(val.updatedMs) || 0;
      let remoteData;
      try {
        remoteData = JSON.parse(val.json);
      } catch {
        return; // corrupt remote payload — keep local
      }

      const remoteIsEnv = isEnvelope(remoteData);
      const localIsColl = this.env != null || isCollection(this.value);

      // --- Collection path: per-item merge (no whole-store clobber) ---
      if (remoteIsEnv || (localIsColl && Array.isArray(remoteData))) {
        // Legacy remote (plain array from the old engine) → wrap into an envelope.
        const remoteEnv = remoteIsEnv ? remoteData : toEnvelope(remoteData, null, remoteMs);
        const localEnv =
          this.env || (isCollection(this.value) ? toEnvelope(this.value, null, this.updatedMs) : null);
        const merged = mergeEnvelopes(localEnv, remoteEnv);
        const newValue = fromEnvelope(merged);
        const changed = !eq(newValue, this.value);
        this.env = merged;
        this.value = newValue;
        this.updatedMs = Math.max(this.updatedMs, remoteMs) || Date.now();
        this._writeLocal(newValue, this.updatedMs);
        if (changed) { bus.dataChanged(this._localKey); this._emit(); }
        // If our merge produced anything the cloud doesn't already have, push it
        // back. Idempotent+commutative merge means this converges (no echo loop).
        if (!eq(merged, remoteEnv)) this._scheduleRemoteWrite();
        return;
      }

      // --- Scalar / object path: whole-value last-write-wins (unchanged) ---
      if (remoteMs > this.updatedMs) {
        this.value = remoteData;
        this.updatedMs = remoteMs;
        this.env = null;
        this._writeLocal(remoteData, remoteMs);
        this._emit();
      } else if (this.updatedMs > remoteMs) {
        this._scheduleRemoteWrite();
      }
    });
  }

  _detach() {
    if (this.detach) {
      this.detach();
      this.detach = null;
    }
  }

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this._flush();
    }
    this._detach();
    this.offBus?.();
    this.offVis?.();
  }
}
