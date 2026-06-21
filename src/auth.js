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

export function signOutUser() {
  trackEvent('logout');
  return signOut(auth);
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
