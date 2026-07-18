// Per-store sync engine — the heart of the Desk Dazzle "kernel".
//
// Each store is one named slice of workspace state (notes, flashcards, …).
// Every store is persisted the same way, at the root:
//   • localStorage (`deskdazzle.<name>`) — instant first paint + offline truth
//   • Firebase RTDB mirror at `users/<uid>/stores/<name>` when signed in
//   • BroadcastChannel — live sync across this browser's open tabs
//   • last-write-wins on a millisecond `updatedMs` stamp
//
// The RTDB payload is `{ json: "<stringified value>", updatedMs }`. Stringifying
// sidesteps RTDB's array/null coercion, so ANY JSON value round-trips losslessly.

import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../../firebaseConfig';
import { bus, TAB_ID } from '../broadcast';

const keyOf = (name) => `deskdazzle.${name}`;
const metaOf = (name) => `deskdazzle.${name}.meta`;
const WRITE_DEBOUNCE_MS = 600;

export class SyncedStore {
  constructor(name, initial) {
    this.name = name;
    this.initial = initial;
    this.subs = new Set();
    this.uid = null;
    this.detach = null;
    this.timer = null;
    this.value = this._readLocal();
    this.updatedMs = this._readMeta();

    // Another tab mutated the same store → adopt its localStorage value.
    this.offBus = bus.on((msg) => {
      if (msg.kind === 'data-changed' && msg.store === keyOf(this.name) && msg.tabId !== TAB_ID) {
        this._reloadLocal();
      }
    });
  }

  _readLocal() {
    try {
      const raw = window.localStorage.getItem(keyOf(this.name));
      return raw !== null ? JSON.parse(raw) : this.initial;
    } catch {
      return this.initial;
    }
  }

  _readMeta() {
    try {
      return Number(window.localStorage.getItem(metaOf(this.name))) || 0;
    } catch {
      return 0;
    }
  }

  _writeLocal(value, updatedMs) {
    try {
      window.localStorage.setItem(keyOf(this.name), JSON.stringify(value));
      window.localStorage.setItem(metaOf(this.name), String(updatedMs));
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
    bus.dataChanged(keyOf(this.name));
    this._scheduleRemoteWrite();
    this._emit();
  };

  _scheduleRemoteWrite() {
    if (!this.uid) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._flush(), WRITE_DEBOUNCE_MS);
  }

  _flush() {
    this.timer = null;
    if (!this.uid) return;
    update(ref(rtdb, `users/${this.uid}/stores/${this.name}`), {
      json: JSON.stringify(this.value),
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
    if (this.detach) {
      this.detach();
      this.detach = null;
    }
    this.uid = uid;
    if (!uid) return;

    const r = ref(rtdb, `users/${uid}/stores/${this.name}`);
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

  dispose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this._flush();
    }
    if (this.detach) this.detach();
    this.offBus?.();
  }
}
