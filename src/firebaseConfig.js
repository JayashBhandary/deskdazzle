import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from 'firebase/auth';
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported, logEvent } from "firebase/analytics";
import { getConsent, onConsentChange } from "./lib/analyticsConsent";
import { logger } from "./lib/logger";

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

// Reliability guard (L-3): fail loudly in dev if the RTDB URL was left at a
// placeholder / cleared — otherwise every sync silently no-ops in production.
if (!firebaseConfig.databaseURL || !/^https:\/\/.+\.firebaseio\.com/.test(firebaseConfig.databaseURL)) {
  logger.error('[firebase] databaseURL looks invalid — Realtime Database sync will not work:', firebaseConfig.databaseURL);
}

// App Check (L-2 / hardens C-2): attests requests come from the real app before
// RTDB will serve them, blunting scripted abuse of the open write rules. Enabled
// only when a reCAPTCHA v3 site key is provided (set VITE_APPCHECK_SITE_KEY in
// the deploy env + register the key in the Firebase console). No key → skipped,
// so local dev and tests are unaffected. For local testing against an
// App-Check-enforced backend, set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`
// before load to use a debug token.
const appCheckKey = import.meta.env?.VITE_APPCHECK_SITE_KEY;
if (appCheckKey) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    logger.error('[firebase] App Check init failed', err);
  }
}

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
