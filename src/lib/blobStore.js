// A tiny IndexedDB blob store for the Drive app — the one place in the app that
// keeps real file bytes at rest. localStorage/RTDB (used by useStore) are JSON
// and capped (~5 MB local, 900 KB synced), so binaries live here instead; only
// lightweight file metadata goes through useStore (which handles workspace
// isolation + sync).
//
// Records are keyed by a globally-unique file id (uuid). Workspace isolation is
// enforced at the metadata layer: each workspace's useStore('driveNodes') lists
// only its own ids, so it can only ever read/delete its own blobs.

const DB_NAME = 'deskdazzle-drive';
const STORE = 'files';
const VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const wrap = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

// Store a Blob under `id`. Blobs are stored natively (structured clone), so no
// base64 bloat.
export function putBlob(id, blob) {
  return tx('readwrite', (s) => wrap(s.put(blob, id)));
}

// Get a Blob by id, or null if missing.
export function getBlob(id) {
  return tx('readonly', (s) => wrap(s.get(id))).then((v) => v || null);
}

export function deleteBlob(id) {
  return tx('readwrite', (s) => wrap(s.delete(id)));
}

export function deleteBlobs(ids) {
  return tx('readwrite', (s) => Promise.all(ids.map((id) => wrap(s.delete(id)))));
}

// Sum of all stored blob sizes (bytes) — for a storage-usage indicator. Iterates
// values; fine for a personal drive.
export function totalBytes() {
  return tx('readonly', (s) => new Promise((resolve, reject) => {
    let sum = 0;
    const req = s.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(sum); return; }
      const v = cur.value;
      sum += (v && typeof v.size === 'number') ? v.size : 0;
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  }));
}
