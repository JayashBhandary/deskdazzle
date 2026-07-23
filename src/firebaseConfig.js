import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getConsent, onConsentChange } from "./lib/analyticsConsent";

const firebaseConfig = {
  apiKey: "AIzaSyBx3URRwSSTKZivSXs24AoTat8etj6qa-0",
  authDomain: "deskdazzle.firebaseapp.com",
  databaseURL: "https://deskdazzle-default-rtdb.firebaseio.com",
  projectId: "deskdazzle",
  storageBucket: "deskdazzle.appspot.com",
  messagingSenderId: "428181540252",
  appId: "1:428181540252:web:4d7bbf922fc8dfeec2cc59",
  measurementId: "G-LD790BD89S"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Realtime Database is the single per-user store: a thin profile mirror plus all
// fast-changing state (theme, todos, desktop layout). Everything under
// users/{uid}; live-synced through one shared listener (see useUserData).
export const rtdb = getDatabase(app);

// Analytics is only supported in browser contexts served over http(s); guard
// with isSupported() so it never throws in unsupported envs (SSR, some PWAs).
// CRITICAL: it must NOT initialize until the user has opted in (GDPR/CCPA), so
// init is deferred behind consent and runs at most once.
let analytics = null;
let initStarted = false;

function initAnalytics() {
  if (initStarted) return;
  initStarted = true;
  isSupported()
    .then((ok) => { if (ok) analytics = getAnalytics(app); })
    .catch(() => {});
}

// Init immediately if consent was granted in a previous session, and (re)init
// the moment consent flips to 'granted' this session.
if (getConsent() === 'granted') initAnalytics();
onConsentChange((value) => { if (value === 'granted') initAnalytics(); });

// Safe event logger — no-ops without consent or before analytics initializes.
export function trackEvent(name, params) {
  if (getConsent() !== 'granted') return;
  try {
    if (analytics) logEvent(analytics, name, params);
  } catch {
    // ignore analytics failures
  }
}
