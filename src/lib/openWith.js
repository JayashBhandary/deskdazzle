// Cross-app "Open with…" handoff. Drive stores a file's bytes in IndexedDB;
// when the user picks "Open in Word/Excel/PDF/PowerPoint", we stash the bytes in
// this in-memory channel and navigate to that app's route. The target app calls
// `consumeOpen(appKey)` on mount and imports the pending file.
//
// The payload lives only in memory (bytes can be large — never localStorage),
// which is fine because the app is a single-page app: client-side navigation
// keeps the module alive. It is one-shot: consuming clears it.

let pending = null; // { app, name, bytes }
const subs = new Set();

// appKey: 'word' | 'excel' | 'powerpoint' | 'pdf'
export function requestOpen(app, name, bytes) {
  pending = { app, name, bytes };
  subs.forEach((fn) => { try { fn(pending); } catch { /* ignore */ } });
}

// Called by a target app on mount. Returns + clears the pending payload if it is
// addressed to this app, else null.
export function consumeOpen(app) {
  if (pending && pending.app === app) {
    const payload = pending;
    pending = null;
    return payload;
  }
  return null;
}

// Subscribe to open-requests (so an already-mounted app can react without a
// remount). Returns an unsubscribe fn.
export function onOpenRequest(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

// Which app can open a given filename, by extension (null if none).
export function appForFile(name) {
  const ext = (name.lastIndexOf('.') >= 0 ? name.slice(name.lastIndexOf('.') + 1) : '').toLowerCase();
  if (/^docx?$/.test(ext)) return { app: 'word', route: '/word', label: 'Open in Word' };
  if (/^(xlsx?|xlsb|ods|csv)$/.test(ext)) return { app: 'excel', route: '/excel', label: 'Open in Excel' };
  if (/^pptx?$/.test(ext)) return { app: 'powerpoint', route: '/powerpoint', label: 'Open in PowerPoint' };
  if (ext === 'pdf') return { app: 'pdf', route: '/pdf', label: 'Open in PDF' };
  return null;
}
