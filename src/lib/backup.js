// Single-file JSON export/import of the whole workspace. Everything Desk
// Dazzle stores locally lives under `deskdazzle.*` localStorage keys —
// including the Firebase mirror (`deskdazzle.userdata`: theme, todos,
// projects, desktop, profile) — so a prefix scan captures it all.

import { ref, update } from 'firebase/database';
import { rtdb } from '../firebaseConfig';

const PREFIX = 'deskdazzle.';
const FORMAT = 'deskdazzle-backup';
const VERSION = 1;

export function exportWorkspace() {
  const stores = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    try {
      stores[key] = JSON.parse(window.localStorage.getItem(key));
    } catch {
      // Skip unparseable entries rather than corrupting the backup.
    }
  }
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

export function downloadWorkspace() {
  const data = exportWorkspace();
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `deskdazzle-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Replace the current workspace with `data` (a parsed backup file).
 * If `uid` is given (signed-in user), the synced fields are also pushed to
 * the Realtime Database so the imported state wins over the remote copy.
 * Resolves when done; the caller should reload the page afterwards so every
 * store rehydrates from the imported values.
 */
export async function importWorkspace(data, uid = null) {
  if (!data || data.format !== FORMAT || typeof data.stores !== 'object') {
    throw new Error('Not a Desk Dazzle backup file.');
  }
  for (const [key, value] of Object.entries(data.stores)) {
    if (!key.startsWith(PREFIX)) continue;
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  const userdata = data.stores[`${PREFIX}userdata`];
  if (uid && userdata && typeof userdata === 'object') {
    const synced = {};
    for (const field of ['theme', 'todos', 'projects', 'desktop']) {
      if (field in userdata) synced[field] = userdata[field];
    }
    if (Object.keys(synced).length) {
      await update(ref(rtdb, `users/${uid}`), synced);
    }
  }
}
