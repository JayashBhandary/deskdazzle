import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, onValue, update, remove } from 'firebase/database';
import { rtdb } from '../../firebaseConfig';
import { DEFAULT_WORKSPACE } from './syncEngine';
import { getSyncDebounceMs } from './syncConfig';
import { isPageVisible, onVisibilityChange } from './visibility';

// The workspace registry — the list of "Spaces" and which one is active.
//
// This is deliberately NOT a workspace-scoped store (it's the metadata that
// *selects* the workspace). The list of workspaces syncs to the cloud so new
// Spaces appear across devices; the *active* workspace stays device-local, so
// each device/tab can sit on a different Space (just like OS virtual desktops).
//
// Sync is last-write-wins on a millisecond stamp persisted alongside the list
// (mirroring SyncedStore): the stamp survives reloads, so a just-created Space
// isn't clobbered by an older cloud snapshot before its debounced write lands.

const LIST_KEY = 'deskdazzle.workspaces';
const META_KEY = 'deskdazzle.workspaces.meta';
const ACTIVE_KEY = 'deskdazzle.activeWorkspace';

const DEFAULT_LIST = [{ id: DEFAULT_WORKSPACE, name: 'Main', emoji: '🖥️' }];

function readList() {
  try {
    const raw = window.localStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    /* ignore */
  }
  return DEFAULT_LIST;
}

function readMeta() {
  try {
    return Number(window.localStorage.getItem(META_KEY)) || 0;
  } catch {
    return 0;
  }
}

function readActive(list) {
  try {
    const id = window.localStorage.getItem(ACTIVE_KEY);
    if (id && list.some((w) => w.id === id)) return id;
  } catch {
    /* ignore */
  }
  return DEFAULT_WORKSPACE;
}

function writeList(list, ms) {
  try {
    window.localStorage.setItem(LIST_KEY, JSON.stringify(list));
    window.localStorage.setItem(META_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

function writeActive(id) {
  try { window.localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

const newId = () =>
  `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useWorkspaces(user) {
  const initialList = readList();
  const [workspaces, setWorkspaces] = useState(initialList);
  const [activeWorkspaceId, setActiveId] = useState(() => readActive(initialList));

  const uidRef = useRef(null);
  const updatedRef = useRef(readMeta());
  // Latest list, kept current so cloud seeding/flushing never reads stale state.
  const listRef = useRef(initialList);
  listRef.current = workspaces;
  const timer = useRef(null);

  const flushCloud = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const uid = uidRef.current;
    if (!uid) return;
    update(ref(rtdb, `users/${uid}/workspaceMeta`), {
      json: JSON.stringify(listRef.current),
      updatedMs: updatedRef.current,
    }).catch(() => {});
  }, []);

  const scheduleCloud = useCallback(() => {
    if (!uidRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flushCloud, getSyncDebounceMs());
  }, [flushCloud]);

  // Persist the list locally (with a fresh stamp) + mirror to the cloud.
  const persistList = useCallback((list) => {
    updatedRef.current = Date.now();
    listRef.current = list;
    writeList(list, updatedRef.current);
    scheduleCloud();
  }, [scheduleCloud]);

  // Live cloud mirror of the workspace list (last-write-wins). The listener is
  // held only while the tab is visible, so a backgrounded tab releases its RTDB
  // connection.
  useEffect(() => {
    if (!user) {
      uidRef.current = null;
      return undefined;
    }
    uidRef.current = user.uid;
    const r = ref(rtdb, `users/${user.uid}/workspaceMeta`);
    let unsub = null;

    const attach = () => {
      if (unsub) return;
      unsub = onValue(r, (snap) => {
        const val = snap.val();
        if (!val || typeof val.json !== 'string') {
          // Remote empty but we have a real local list → seed the cloud copy.
          if (updatedRef.current > 0) scheduleCloud();
          return;
        }
        const remoteMs = Number(val.updatedMs) || 0;
        if (remoteMs > updatedRef.current) {
          try {
            const list = JSON.parse(val.json);
            if (!Array.isArray(list) || !list.length) return;
            updatedRef.current = remoteMs;
            listRef.current = list;
            writeList(list, remoteMs);
            setWorkspaces(list);
            // If the active workspace vanished remotely, fall back to default.
            setActiveId((cur) => (list.some((w) => w.id === cur) ? cur : DEFAULT_WORKSPACE));
          } catch {
            /* ignore corrupt payload */
          }
        } else if (updatedRef.current > remoteMs) {
          // Local is newer than the cloud → push it up.
          scheduleCloud();
        }
      });
    };
    const detach = () => { if (unsub) { unsub(); unsub = null; } };

    if (isPageVisible()) attach();
    const offVis = onVisibilityChange((visible) => {
      if (visible) attach();
      else { flushCloud(); detach(); }
    });

    return () => {
      offVis();
      flushCloud();
      detach();
    };
  }, [user, scheduleCloud, flushCloud]);

  const switchWorkspace = useCallback((id) => {
    setActiveId((cur) => {
      if (id === cur) return cur;
      writeActive(id);
      return id;
    });
  }, []);

  const createWorkspace = useCallback((name, emoji = '🗂️') => {
    const id = newId();
    const trimmed = (name || '').trim() || 'New workspace';
    const next = [...listRef.current, { id, name: trimmed, emoji }];
    setWorkspaces(next);
    persistList(next);
    switchWorkspace(id);
    return id;
  }, [persistList, switchWorkspace]);

  // Live edits are stored verbatim (so multi-word names can be typed); callers
  // normalise on blur. Passing name/emoji `undefined` leaves that field as-is.
  const renameWorkspace = useCallback((id, name, emoji) => {
    const next = listRef.current.map((w) =>
      w.id === id ? { ...w, name: name ?? w.name, emoji: emoji ?? w.emoji } : w,
    );
    setWorkspaces(next);
    persistList(next);
  }, [persistList]);

  const deleteWorkspace = useCallback((id) => {
    if (id === DEFAULT_WORKSPACE) return; // the default workspace is permanent
    const remaining = listRef.current.filter((w) => w.id !== id);
    const next = remaining.length ? remaining : DEFAULT_LIST;
    setWorkspaces(next);
    persistList(next);
    // Leave the deleted workspace if we're standing on it.
    setActiveId((cur) => {
      if (cur !== id) return cur;
      writeActive(DEFAULT_WORKSPACE);
      return DEFAULT_WORKSPACE;
    });
    // Purge its local data.
    try {
      const prefix = `deskdazzle.ws.${id}.`;
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    // Purge its cloud node AFTER the debounce window, so any in-flight write
    // flushed by the store teardown (SyncedStore.dispose / useUserData cleanup)
    // lands first and is then removed — no resurrected orphan node.
    const uid = uidRef.current;
    if (uid) {
      setTimeout(() => {
        remove(ref(rtdb, `users/${uid}/workspaces/${id}`)).catch(() => {});
      }, getSyncDebounceMs() + 400);
    }
  }, [persistList]);

  return {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  };
}
