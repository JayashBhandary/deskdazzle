// Analytics consent state (GDPR/CCPA). Analytics must not initialize or send
// any event until the user explicitly opts in. The choice is persisted in
// localStorage and read synchronously so `trackEvent` can gate every call.
//
//   null        → undecided (show the consent banner)
//   'granted'   → user opted in; Analytics may initialize + send
//   'denied'    → user opted out; Analytics stays off

const KEY = 'deskdazzle.analyticsConsent';
const listeners = new Set();

export function getConsent() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// 'granted' | 'denied'. Notifies subscribers (e.g. firebaseConfig, which
// initializes Analytics lazily the moment consent flips to 'granted').
export function setConsent(value) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* ignore storage errors */
  }
  for (const fn of listeners) {
    try { fn(value); } catch { /* ignore listener errors */ }
  }
}

export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
