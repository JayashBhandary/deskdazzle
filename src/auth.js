import { signInWithPopup, GoogleAuthProvider, signOut, updateProfile, deleteUser } from 'firebase/auth';
import { ref, update, remove, serverTimestamp } from 'firebase/database';
import { toast } from 'sonner';
import { auth, rtdb, trackEvent } from './firebaseConfig';

// Single home for the Google auth flow, shared by the Header and Profile page so
// the profile-mirror write lives in exactly one place.
const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  try {
    const { user } = await signInWithPopup(auth, provider);
    // One write, no read: refresh the thin profile mirror under the same
    // users/{uid} node that holds theme/todos/desktop. Identity itself always
    // comes from the Auth object — this is just for the record.
    // Data minimization (GDPR Art. 5): mirror only what the UI actually reads
    // (displayName / photoURL / lastLogin). Email is available from the Auth
    // object on demand, so it is deliberately NOT duplicated into the database.
    await update(ref(rtdb, `users/${user.uid}/profile`), {
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    });
    trackEvent('login', { method: 'google' });
    return user;
  } catch (error) {
    const code = error?.code || '';
    // User dismissed / interrupted the popup — not a failure worth surfacing.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    }
    // Offline is handled by the caller's own messaging; only surface real,
    // online failures here (and never log the raw error object).
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      toast.error('Sign-in failed. Please try again.');
    }
    return null;
  }
}

// Remove every locally-cached workspace slice on this device (all keys under the
// `deskdazzle.` namespace: per-app stores, the userdata cache, workspace list,
// settings, layout prefs, …). The cloud copy is untouched and re-downloads on
// the next sign-in.
function flushLocalWorkspaceData() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('deskdazzle.')) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore storage errors */
  }
}

// Sign out and FLUSH all cached workspace data from the device, then hard-reload
// so no in-memory store or live listener from the previous account survives —
// essential on shared machines. Order matters: sign out first (so no write is
// aimed at the old uid), then clear, then reload into a clean anonymous session.
export async function signOutUser() {
  trackEvent('logout');
  try {
    await signOut(auth);
  } catch {
    /* sign out best-effort; still flush + reload */
  }
  flushLocalWorkspaceData();
  if (typeof window !== 'undefined') window.location.assign('/');
}

// Edit the user's display name / avatar. Writes to BOTH the Auth account (so it
// persists across sessions and devices) and the RTDB profile mirror (so the
// shared live listener updates the UI immediately — no reload needed).
export async function updateUserProfile({ displayName, photoURL }) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const fields = {
    displayName: (displayName ?? '').trim(),
    photoURL: (photoURL ?? '').trim(),
  };
  await updateProfile(user, fields);
  await update(ref(rtdb, `users/${user.uid}/profile`), fields);
  trackEvent('profile_update');
  return fields;
}

// Right to erasure (GDPR Art. 17 / CCPA). Permanently deletes the user's entire
// cloud record (`users/{uid}` — profile, theme, todos, desktop, projects,
// stores, workspaces), then deletes the Auth account itself, then flushes all
// on-device data and reloads. Deleting the RTDB node first guarantees the data
// is gone even if account deletion later needs interaction.
//
// Firebase requires a recent login to delete an account; if the session is
// stale it throws `auth/requires-recent-login`, so we reauthenticate via the
// Google popup and retry once.
export async function deleteAccountAndData() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');

  await remove(ref(rtdb, `users/${user.uid}`));

  try {
    await deleteUser(user);
  } catch (error) {
    if (error?.code === 'auth/requires-recent-login') {
      await signInWithPopup(auth, provider);
      const fresh = auth.currentUser;
      if (fresh) await deleteUser(fresh);
    } else {
      throw error;
    }
  }

  trackEvent('account_delete');
  flushLocalWorkspaceData();
  if (typeof window !== 'undefined') window.location.assign('/');
}
