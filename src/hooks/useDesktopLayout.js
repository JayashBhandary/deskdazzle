import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const KEY = 'deskdazzle.desktop';

// Manages the desktop window layout. Persists to localStorage instantly and,
// when signed in, syncs to the user's Firestore document so it follows them
// across devices.
export function useDesktopLayout(user, initial) {
  const [windows, setWindows] = useState(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      return stored !== null ? JSON.parse(stored) : initial;
    } catch {
      return initial;
    }
  });

  // Don't push to Firestore until we've had a chance to read the remote layout,
  // so a fresh local default can't clobber a saved cloud layout.
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    async function load() {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (!cancelled && snap.exists() && Array.isArray(snap.data().desktop)) {
            setWindows(snap.data().desktop);
          }
        } catch {
          // ignore – fall back to local layout
        }
      }
      if (!cancelled) readyRef.current = true;
    }
    load();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(windows));
    } catch {
      // ignore
    }
    if (user && readyRef.current && auth.currentUser) {
      updateDoc(doc(db, 'users', auth.currentUser.uid), { desktop: windows }).catch(() => {});
    }
  }, [windows, user]);

  return [windows, setWindows];
}
