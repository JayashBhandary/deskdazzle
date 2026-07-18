import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../firebaseConfig';

// Single source of truth for a user's fast-changing state (theme, todos, desktop
// layout). Replaces the old scattered Firestore getDoc/updateDoc calls with:
//   - ONE shared Realtime Database listener per signed-in user (one connection),
//     attached only while the tab is visible and detached/flushed when hidden or
//     signed out, so we never hold live connections open needlessly.
//   - A debounced, batched, per-field writer so rapid changes (dragging windows,
//     toggling todos) collapse into a single write instead of one-per-change.
//
// While signed out it behaves as a local-only store backed by localStorage.

const CACHE_KEY = 'deskdazzle.userdata';
const WRITE_DEBOUNCE_MS = 600;

function readCache() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useUserData(user) {
  const initial = readCache();
  const [theme, setThemeState] = useState(
    typeof initial.theme === 'boolean' ? initial.theme : true
  );
  const [todos, setTodosState] = useState(
    Array.isArray(initial.todos) ? initial.todos : []
  );
  const [desktop, setDesktopState] = useState(
    Array.isArray(initial.desktop) ? initial.desktop : null
  );
  // Task projects (kanban): [{id, name, color, order}] — synced like todos.
  const [projects, setProjectsState] = useState(
    Array.isArray(initial.projects) ? initial.projects : []
  );
  // Thin profile mirror (displayName/email/photoURL/lastLogin). Read-only on the
  // client — it rides along in the same snapshot, so exposing it costs no extra
  // reads. Identity itself still comes from the Auth `user` object.
  const [profile, setProfileState] = useState(
    initial.profile && typeof initial.profile === 'object' ? initial.profile : null
  );

  // Full snapshot mirrored to localStorage so first paint is instant/offline.
  const cacheRef = useRef(initial);
  // uid of the currently signed-in user (null = local-only mode).
  const uidRef = useRef(null);
  // Pending field changes, coalesced and flushed on one debounce timer.
  const pending = useRef({});
  const timer = useRef(null);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const uid = uidRef.current;
    const data = pending.current;
    pending.current = {};
    if (uid && Object.keys(data).length) {
      update(ref(rtdb, `users/${uid}`), data).catch(() => {});
    }
  }, []);

  // Apply a local change: update state-cache + localStorage immediately, and
  // queue a single debounced RTDB write (only meaningful while signed in).
  const persist = useCallback((patch) => {
    cacheRef.current = { ...cacheRef.current, ...patch };
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(cacheRef.current));
    } catch {
      // ignore quota/availability errors
    }
    Object.assign(pending.current, patch);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
  }, [flush]);

  // Public setters — accept a value or an updater fn, mirror React's setState.
  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persist({ theme: value });
      return value;
    });
  }, [persist]);

  const setTodos = useCallback((next) => {
    setTodosState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persist({ todos: value });
      return value;
    });
  }, [persist]);

  const setDesktop = useCallback((next) => {
    setDesktopState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persist({ desktop: value });
      return value;
    });
  }, [persist]);

  const setProjects = useCallback((next) => {
    setProjectsState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      persist({ projects: value });
      return value;
    });
  }, [persist]);

  // One shared live listener, attached only while signed in AND tab visible.
  useEffect(() => {
    if (!user) {
      uidRef.current = null;
      setProfileState(null);
      return;
    }
    uidRef.current = user.uid;
    const userRef = ref(rtdb, `users/${user.uid}`);
    let unsub = null;

    const attach = () => {
      if (unsub) return;
      // onValue delivers the current value immediately, then live deltas — so
      // this single subscription covers both the initial read and live sync.
      unsub = onValue(userRef, (snap) => {
        const val = snap.val() || {};
        // Apply via the raw state setters (not the public writers) so remote
        // values are never echoed back as a write.
        if (typeof val.theme === 'boolean') setThemeState(val.theme);
        setTodosState(Array.isArray(val.todos) ? val.todos : []);
        if (Array.isArray(val.desktop)) setDesktopState(val.desktop);
        if (Array.isArray(val.projects)) setProjectsState(val.projects);
        setProfileState(val.profile && typeof val.profile === 'object' ? val.profile : null);
        cacheRef.current = { ...cacheRef.current, ...val };
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(cacheRef.current));
        } catch {
          // ignore
        }
      });
    };

    const detach = () => {
      if (unsub) {
        unsub();
        unsub = null;
      }
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
  }, [user, flush]);

  return { theme, setTheme, todos, setTodos, desktop, setDesktop, projects, setProjects, profile };
}
