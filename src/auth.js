import { signInWithPopup, GoogleAuthProvider, signOut, updateProfile } from 'firebase/auth';
import { ref, update, serverTimestamp } from 'firebase/database';
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
    await update(ref(rtdb, `users/${user.uid}/profile`), {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp(),
    });
    trackEvent('login', { method: 'google' });
    return user;
  } catch (error) {
    console.log(error?.code || error?.message);
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
