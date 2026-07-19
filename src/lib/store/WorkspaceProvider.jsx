// The Desk Dazzle "kernel": a root-level provider that owns every workspace
// store behind one hook, `useStore(name, initial)`. Sync (localStorage +
// Firebase mirror + cross-tab) is handled centrally by SyncedStore — apps stay
// stateless views that just read/write a named slice.
//
// `useStore` mirrors `useLocalStorage`'s signature, so migrating a page is a
// one-line swap; for the default workspace the localStorage key
// (`deskdazzle.<name>`) is unchanged, so existing on-device data carries over
// untouched and simply starts syncing to the cloud the next time the user signs
// in. Every other workspace ("Space") lives in an isolated namespace, giving
// full per-workspace data isolation across all apps and widgets.

import React, { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { SyncedStore, DEFAULT_WORKSPACE } from './syncEngine';

const WorkspaceContext = createContext(null);

class StoreManager {
  constructor() {
    this.stores = new Map();
    this.uid = null;
    this.workspaceId = DEFAULT_WORKSPACE;
  }

  get(name, initial) {
    let s = this.stores.get(name);
    if (!s) {
      s = new SyncedStore(name, initial, this.workspaceId);
      s.setUid(this.uid);
      this.stores.set(name, s);
    }
    return s;
  }

  setUid(uid) {
    if (this.uid === uid) return;
    this.uid = uid;
    for (const s of this.stores.values()) s.setUid(uid);
  }

  // Switch the active workspace: tear every store down (flushing pending
  // writes + detaching its RTDB listener) and drop it, so the next `get`
  // recreates it against the new workspace's namespace.
  setWorkspace(workspaceId) {
    const ws = workspaceId || DEFAULT_WORKSPACE;
    if (this.workspaceId === ws) return;
    for (const s of this.stores.values()) s.dispose();
    this.stores.clear();
    this.workspaceId = ws;
  }
}

export function WorkspaceProvider({ user, workspaceId = DEFAULT_WORKSPACE, children }) {
  const mgrRef = useRef(null);
  if (!mgrRef.current) mgrRef.current = new StoreManager();
  const mgr = mgrRef.current;

  // Apply the active workspace synchronously during render so children that
  // call `useStore` in the same pass read the correct (re-keyed) store.
  if (mgr.workspaceId !== (workspaceId || DEFAULT_WORKSPACE)) {
    mgr.setWorkspace(workspaceId);
  }

  // uid changes attach/detach live RTDB listeners — a side effect, so it stays
  // in an effect. `get` already seeds each store with the current uid.
  useEffect(() => {
    mgr.setUid(user?.uid ?? null);
  }, [mgr, user]);

  // Re-key the context value on workspace change so consumers re-render and
  // re-subscribe to the freshly created store instances.
  const value = useMemo(() => ({ mgr, workspaceId }), [mgr, workspaceId]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Read/write a synced workspace store. Drop-in for useLocalStorage:
 *   const [notes, setNotes] = useStore('notes', []);
 * Persists locally immediately, syncs to Firebase when signed in, stays in sync
 * across open tabs, and is fully isolated to the active workspace.
 */
export function useStore(name, initial) {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useStore must be used within <WorkspaceProvider>');
  const store = ctx.mgr.get(name, initial);
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return [value, store.set];
}

/** Escape hatch for cross-app features (entity links, global context). */
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  return ctx.mgr;
}
