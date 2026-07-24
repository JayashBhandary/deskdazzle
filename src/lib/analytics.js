// Product-analytics event layer — one typed home for every funnel event, built
// on the consent-gated `trackEvent` in firebaseConfig (no-op until the user opts
// in). Centralizing the names here keeps them from drifting across call sites
// and lets `activation` latch exactly once. See NEXT.md / SAAS_MASTER_PLAN.md
// for the funnel these feed.
//
// Funnel: tool_opened → file_opened / content_created → file_exported
//         (+ offline_session as the offline-USP proof, + activation as the
//         one-time North-Star "did real work" milestone).

import { trackEvent } from '../firebaseConfig';

const ACTIVATED_KEY = 'deskdazzle.activated.v1';

// One-time "activation": the user did real work (opened or produced a document,
// or captured content). Fires `activation` once per browser then latches, so the
// North-Star metric is never re-counted. `source` records what triggered it.
export function markActivated(source) {
  try {
    if (window.localStorage.getItem(ACTIVATED_KEY)) return;
    window.localStorage.setItem(ACTIVATED_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable — still emit the event; worst case it repeats.
  }
  trackEvent('activation', { source });
}

// A tool/app surface was opened (a route, or a desktop widget).
export function trackToolOpen(tool, surface = 'route') {
  trackEvent('tool_opened', { tool, surface });
}

// A real file was opened/imported and decoded on-device — the core value moment.
export function trackFileOpen(tool, ext) {
  trackEvent('file_opened', { tool, ext });
  markActivated(`open:${tool}`);
}

// A document was produced/exported on-device (docx/xlsx/pptx/pdf/csv/…).
export function trackFileExport(tool, format) {
  trackEvent('file_exported', { tool, format });
  markActivated(`export:${tool}`);
}

// User captured content (a note, task, …).
export function trackContentCreated(kind) {
  trackEvent('content_created', { kind });
  markActivated(`create:${kind}`);
}

// The app was used while offline — DeskDazzle's core promise in action. Latched
// per page-session so toggling the network doesn't spam duplicates.
let offlineLogged = false;
export function trackOfflineSession() {
  if (offlineLogged) return;
  offlineLogged = true;
  trackEvent('offline_session');
}

// Map a route pathname to a stable tool name for `tool_opened`. Returns null for
// non-tool routes (home, settings, legal…), which shouldn't count as tool use.
const PATH_TO_TOOL = {
  '/workspace': 'workspace',
  '/apps': 'apps',
  '/word': 'word',
  '/excel': 'excel',
  '/powerpoint': 'powerpoint',
  '/pdf': 'pdf',
  '/drive': 'drive',
  '/note-taking': 'notes',
  '/to-do-list': 'tasks',
  '/today': 'today',
  '/flashcards': 'flashcards',
  '/roadmap': 'roadmap',
  '/images': 'images',
  '/converters': 'converters',
  '/design': 'design',
  '/vault': 'vault',
  '/calculator': 'calculator',
  '/calender': 'calendar',
  '/clock': 'clock',
  '/budget-tracker': 'budget',
  '/qrcode-generator': 'qrcode',
  '/translation-tool': 'translation',
  '/text-to-speech': 'tts',
  '/weather': 'weather',
};

export function toolFromPath(pathname) {
  return PATH_TO_TOOL[pathname] || null;
}
