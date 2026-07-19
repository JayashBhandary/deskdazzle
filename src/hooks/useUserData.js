import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../firebaseConfig';
import { DEFAULT_WORKSPACE } from '../lib/store/syncEngine';

// Single source of truth for a user's fast-changing state (theme, todos, desktop
// layout, kanban projects, profile mirror). Uses:
//   - ONE shared Realtime Database listener per signed-in user (one connection),
//     attached only while the tab is visible and detached/flushed when hidden or
//     signed out, so we never hold live connections open needlessly.
//   - A debounced, batched, per-field writer so rapid changes (dragging windows,
//     toggling todos) collapse into a single write instead of one-per-change.
//
// State is split across two persistence scopes:
//   • GLOBAL (profile) — shared across every workspace, at `users/{uid}`.
//   • WORKSPACE (theme, todos, desktop, projects) — isolated per workspace
//     ("Space"), so each workspace remembers its own light/dark appearance.
//     The default workspace keeps the legacy root location (`users/{uid}` +
//     `deskdazzle.userdata`) so existing data carries over untouched; any other
//     workspace lives at `users/{uid}/workspaces/{ws}/data`.
//
// While signed out it behaves as a local-only store backed by localStorage.

const GLOBAL_CACHE = 'deskdazzle.userdata';
const WRITE_DEBOUNCE_MS = 600;

const isDefaultWs = (ws) => !ws || ws === DEFAULT_WORKSPACE;
const wsCacheKeyOf = (ws) => (isDefaultWs(ws) ? GLOBAL_CACHE : `deskdazzle.ws.${ws}.data`);
const globalPathOf = (uid) => `users/${uid}`;
const wsPathOf = (uid, ws) =>
  isDefaultWs(ws) ? `users/${uid}` : `users/${uid}/workspaces/${ws}/data`;

function readCache(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Read-modify-write a cache object so two scopes that share a cache key (the
// default workspace) never clobber each other's fields.
function mergeCache(key, patch) {
  const next = { ...readCache(key), ...patch };
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota / availability errors
  }
  return next;
}

export function useUserData(user, workspaceId = DEFAULT_WORKSPACE) {
  const globalInit = readCache(GLOBAL_CACHE);
  const wsInit = readCache(wsCacheKeyOf(workspaceId));

  const [theme, setThemeState] = useState(
    typeof wsInit.theme === 'boolean' ? wsInit.theme : true
  );
  const [profile, setProfileState] = useState(
    globalInit.profile && typeof globalInit.profile === 'object' ? globalInit.profile : null
  );
  const [todos, setTodosState] = useState(
    Array.isArray(wsInit.todos) ? wsInit.todos : []
  );
  const [desktop, setDesktopState] = useState(
    Array.isArray(wsInit.desktop) ? wsInit.desktop : null
  );
  // Task projects (kanban): [{id, name, color, order}] — synced like todos.
  const [projects, setProjectsState] = useState(
    Array.isArray(wsInit.projects) ? wsInit.projects : []
  );

  // `hydrated` = the first cloud snapshot for the signed-in user has been
  // applied (or we're signed out and local cache is the truth). App uses this
  // to hold a splash until theme/layout are settled, avoiding a visible flip.
  const [hydrated, setHydrated] = useState(false);
  const hydrateUidRef = useRef(null);

  const uidRef = useRef(null);
  const wsRef = useRef(workspaceId);
  wsRef.current = workspaceId;
  // Pending field changes per scope, coalesced and flushed on one debounce timer.
  // Workspace writes remember the workspace they were queued for, so a mid-debounce
  // switch can still route them to the correct node instead of the new workspace.
  const pendingGlobal = useRef({});
  const pendingWs = useRef({ ws: workspaceId, patch: {} });
  const timer = useRef(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const uid = uidRef.current;
    if (!uid) return;
    const g = pendingGlobal.current;
    pendingGlobal.current = {};
    if (Object.keys(g).length) {
      update(ref(rtdb, globalPathOf(uid)), g).catch(() => {});
    }
    const w = pendingWs.current;
    pendingWs.current = { ws: wsRef.current, patch: {} };
    if (Object.keys(w.patch).length) {
      update(ref(rtdb, wsPathOf(uid, w.ws)), w.patch).catch(() => {});
    }
  }, []);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
  }, [flush]);

  const persistGlobal = useCallback((patch) => {
    mergeCache(GLOBAL_CACHE, patch);
    Object.assign(pendingGlobal.current, patch);
    schedule();
  }, [schedule]);

  const persistWs = useCallback((patch) => {
    const ws = wsRef.current;
    mergeCache(wsCacheKeyOf(ws), patch);
    // Queued writes belong to a different workspace → flush them to it first.
    if (pendingWs.current.ws !== ws && Object.keys(pendingWs.current.patch).length) {
      flush();
    }
    pendingWs.current.ws = ws;
    Object.assign(pendingWs.current.patch, patch);
    schedule();
  }, [flush, schedule]);

  // Public setters — accept a value or an updater fn, mirror React's setState.
  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistWs({ theme: value });
      return value;
    });
  }, [persistWs]);

  const setTodos = useCallback((next) => {
    setTodosState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistWs({ todos: value });
      return value;
    });
  }, [persistWs]);

  const setDesktop = useCallback((next) => {
    setDesktopState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistWs({ desktop: value });
      return value;
    });
  }, [persistWs]);

  const setProjects = useCallback((next) => {
    setProjectsState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persistWs({ projects: value });
      return value;
    });
  }, [persistWs]);

  // Switching workspace: flush any pending writes for the old workspace, then
  // repaint the per-workspace slices from the new workspace's local cache. The
  // live listener (below) re-attaches to the new node and reconciles with cloud.
  useEffect(() => {
    flush();
    const ws = readCache(wsCacheKeyOf(workspaceId));
    // Only adopt a stored theme; a fresh workspace inherits the current one.
    if (typeof ws.theme === 'boolean') setThemeState(ws.theme);
    setTodosState(Array.isArray(ws.todos) ? ws.todos : []);
    setDesktopState(Array.isArray(ws.desktop) ? ws.desktop : null);
    setProjectsState(Array.isArray(ws.projects) ? ws.projects : []);
  }, [workspaceId, flush]);

  // One shared live listener pair (global + workspace), attached only while
  // signed in AND the tab is visible.
  useEffect(() => {
    if (!user) {
      uidRef.current = null;
      setProfileState(null);
      return;
    }
    uidRef.current = user.uid;
    // A new sign-in (uid changed) must re-wait for the first cloud snapshot
    // before revealing; a workspace switch (same uid) keeps hydration.
    if (hydrateUidRef.current !== user.uid) {
      hydrateUidRef.current = user.uid;
      setHydrated(false);
    }
    const uid = user.uid;
    const ws = workspaceId;
    const globalRef = ref(rtdb, globalPathOf(uid));
    const wsRef2 = ref(rtdb, wsPathOf(uid, ws));
    const wsCacheKey = wsCacheKeyOf(ws);
    let unsubGlobal = null;
    let unsubWs = null;

    const attach = () => {
      if (unsubGlobal || unsubWs) return;
      // Global scope: profile mirror.
      unsubGlobal = onValue(globalRef, (snap) => {
        const val = snap.val() || {};
        setProfileState(val.profile && typeof val.profile === 'object' ? val.profile : null);
        mergeCache(GLOBAL_CACHE, {
          profile: val.profile && typeof val.profile === 'object' ? val.profile : null,
        });
      });
      // Workspace scope: theme + todos + desktop + projects.
      unsubWs = onValue(wsRef2, (snap) => {
        const val = snap.val() || {};
        setHydrated(true); // first snapshot applied → safe to reveal
        if (typeof val.theme === 'boolean') setThemeState(val.theme);
        setTodosState(Array.isArray(val.todos) ? val.todos : []);
        if (Array.isArray(val.desktop)) setDesktopState(val.desktop);
        if (Array.isArray(val.projects)) setProjectsState(val.projects);
        mergeCache(wsCacheKey, {
          ...(typeof val.theme === 'boolean' ? { theme: val.theme } : {}),
          todos: Array.isArray(val.todos) ? val.todos : [],
          ...(Array.isArray(val.desktop) ? { desktop: val.desktop } : {}),
          ...(Array.isArray(val.projects) ? { projects: val.projects } : {}),
        });
      });
    };

    const detach = () => {
      if (unsubGlobal) { unsubGlobal(); unsubGlobal = null; }
      if (unsubWs) { unsubWs(); unsubWs = null; }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        attach();
      } else {
        flush();   // don't lose a pending debounced write when leaving
        detach();
      }
    };

    if (document.visibilityState === 'visible') attach();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
      detach();
    };
  }, [user, workspaceId, flush]);

  return { theme, setTheme, todos, setTodos, desktop, setDesktop, projects, setProjects, profile, hydrated };
}
