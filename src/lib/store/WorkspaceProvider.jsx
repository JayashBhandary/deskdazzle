// The Desk Dazzle "kernel": a root-level provider that owns every workspace
// store behind one hook, `useStore(name, initial)`. Sync (localStorage +
// Firebase mirror + cross-tab) is handled centrally by SyncedStore — apps stay
// stateless views that just read/write a named slice.
//
// `useStore` mirrors `useLocalStorage`'s signature, so migrating a page is a
// one-line swap; the localStorage key (`deskdazzle.<name>`) is unchanged, so
// existing on-device data carries over untouched and simply starts syncing to
// the cloud the next time the user signs in.

import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { SyncedStore } from './syncEngine';

const WorkspaceContext = createContext(null);

class StoreManager {
  constructor() {
    this.stores = new Map();
    this.uid = null;
  }

  get(name, initial) {
    let s = this.stores.get(name);
    if (!s) {
      s = new SyncedStore(name, initial);
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
}

export function WorkspaceProvider({ user, children }) {
  const mgrRef = useRef(null);
  if (!mgrRef.current) mgrRef.current = new StoreManager();

  useEffect(() => {
    mgrRef.current.setUid(user?.uid ?? null);
  }, [user]);

  return (
    <WorkspaceContext.Provider value={mgrRef.current}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Read/write a synced workspace store. Drop-in for useLocalStorage:
 *   const [notes, setNotes] = useStore('notes', []);
 * Persists locally immediately, syncs to Firebase when signed in, and stays in
 * sync across open tabs.
 */
export function useStore(name, initial) {
  const mgr = useContext(WorkspaceContext);
  if (!mgr) throw new Error('useStore must be used within <WorkspaceProvider>');
  const store = mgr.get(name, initial);
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return [value, store.set];
}

/** Escape hatch for cross-app features (entity links, global context). */
export function useWorkspace() {
  const mgr = useContext(WorkspaceContext);
  if (!mgr) throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  return mgr;
}
