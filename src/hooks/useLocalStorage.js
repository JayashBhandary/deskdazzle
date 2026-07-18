import { useState, useEffect, useRef } from 'react';
import { bus, TAB_ID } from '../lib/broadcast';

// Persists a piece of state to localStorage under `key`, surviving reloads,
// and keeps every open tab in sync: writes announce themselves on the
// cross-tab bus (BroadcastChannel), and other tabs holding the same key
// reload it. The native `storage` event is handled too as a fallback.
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Distinguish "this tab changed the value" (persist + broadcast) from
  // "another tab changed it" (just adopt it — echoing back would loop).
  const remote = useRef(false);

  useEffect(() => {
    if (remote.current) {
      remote.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      bus.dataChanged(key);
    } catch {
      // Ignore write errors (e.g. storage full or disabled).
    }
  }, [key, value]);

  useEffect(() => {
    const reload = () => {
      try {
        const stored = window.localStorage.getItem(key);
        if (stored !== null) {
          remote.current = true;
          setValue(JSON.parse(stored));
        }
      } catch {
        // Unreadable — keep current state.
      }
    };
    const offBus = bus.on((msg) => {
      if (msg.kind === 'data-changed' && msg.store === key && msg.tabId !== TAB_ID) reload();
    });
    const onStorage = (e) => {
      if (e.key === key) reload();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      offBus();
      window.removeEventListener('storage', onStorage);
    };
  }, [key]);

  return [value, setValue];
}
