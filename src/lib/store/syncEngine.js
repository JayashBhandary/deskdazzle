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
    this.value = this._readLocal();
    this.updatedMs = this._readMeta();

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

  _writeLocal(value, updatedMs) {
    try {
      window.localStorage.setItem(this._localKey, JSON.stringify(value));
      window.localStorage.setItem(this._metaKey, String(updatedMs));
    } catch {
      // ignore quota / availability errors
    }
  }

  _reloadLocal() {
    this.value = this._readLocal();
    this.updatedMs = this._readMeta();
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
      json = JSON.stringify(this.value);
    } catch {
      return; // unserializable — nothing to sync
    }
    if (json.length > MAX_REMOTE_BYTES) {
      if (!this._warnedSize) {
        this._warnedSize = true;
        console.warn(
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
        if (this.updatedMs > 0) this._scheduleRemoteWrite();
        return;
      }
      const remoteMs = Number(val.updatedMs) || 0;
      if (remoteMs > this.updatedMs) {
        try {
          const remoteValue = JSON.parse(val.json);
          this.value = remoteValue;
          this.updatedMs = remoteMs;
          this._writeLocal(remoteValue, remoteMs);
          this._emit();
        } catch {
          // corrupt remote payload — keep local
        }
      } else if (this.updatedMs > remoteMs) {
        // Local is newer than the cloud → push it up.
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
