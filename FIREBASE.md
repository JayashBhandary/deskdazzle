# Firebase Usage — Desk Dazzle

An inventory of every Firebase service this project uses and how. Updated after
consolidating all per-user data into a single Realtime Database node (Firestore
removed).

- **Project ID:** `deskdazzle` (`.firebaserc`)
- **SDK:** `firebase@^12.14.0` (modular v9+ API), `package.json`
- **Config:** `src/firebaseConfig.js` — single app; exports `auth`, `rtdb`, `trackEvent`

---

## Services in use

| Service | SDK module | Status | Where |
|---|---|---|---|
| Firebase App (core) | `firebase/app` | ✅ Active | `src/firebaseConfig.js` |
| Authentication | `firebase/auth` | ✅ Active | Header (Google sign-in), App (session), Profile (sign-out) |
| Realtime Database | `firebase/database` | ✅ Active | `useUserData.js` (theme, todos, desktop) + `Header.jsx` (profile) |
| Analytics | `firebase/analytics` | ✅ Active | `src/firebaseConfig.js` + `trackEvent` calls |
| Hosting | `firebase.json` (CLI) | ✅ Active | `dist/` deploy target |
| Cloud Firestore | — | ❌ Removed | Consolidated into RTDB; profile was write-only (read from Auth) |
| Cloud Storage | — | ❌ Not used | `storageBucket` set in config but no SDK calls |
| Cloud Functions / FCM | — | ❌ Not used | — |

---

## Single-store model

Everything per-user lives under one **Realtime Database** node, `users/{uid}`.
Identity is always sourced from the Auth object; the `profile` child is a thin,
write-only mirror refreshed once per sign-in (kept for future admin/analytics).

```
RTDB: users/{uid}
  ├── profile                       (refreshed once per sign-in)
  │     ├── displayName : string
  │     ├── email       : string
  │     ├── photoURL    : string
  │     └── lastLogin   : number     (serverTimestamp, epoch ms)
  ├── theme   : boolean
  ├── todos   : array<{ id, text, isDone }>
  └── desktop : array<{ id, type, x, y, width, height, z, minimized, maximized }>
```

`useUserData` reads the whole `users/{uid}` snapshot and picks out
theme/todos/desktop; its debounced `update()` only ever writes those keys, so the
sibling `profile` (written separately by the Header) is never clobbered — RTDB
`update()` is a shallow merge at the path.

## 1. Authentication (`firebase/auth`)

Google-only via popup.

| Action | Function | File:line |
|---|---|---|
| Sign in | `signInWithPopup` + `GoogleAuthProvider` | `src/components/Header.jsx` |
| Session listener | `onAuthStateChanged` | `src/App.jsx` (sets `user`/`isLoggedIn`) |
| Sign out | `signOut` | `src/pages/Profile.jsx` |

## 2. Realtime Database (`firebase/database`) — live per-user state

All in **`src/hooks/useUserData.js`**, the single source of truth for
`theme`/`todos`/`desktop`:

- **One shared `onValue` listener** per signed-in user (one connection). It
  delivers the initial value *and* live deltas, so it replaces what used to be
  three separate `getDoc` reads.
- **Attached only while the tab is visible.** On `visibilitychange → hidden` (or
  sign-out / unmount) it **flushes pending writes then detaches**, so live
  connections are never held open needlessly (avoids exhausting the free-tier
  ~100 concurrent connection cap).
- **Debounced, batched, per-field writer** (`update()`, 600 ms). Rapid changes —
  dragging windows, toggling todos — coalesce into a single multi-field write
  instead of one write per change.
- **No write-echo:** remote values are applied via raw state setters, never the
  public writers, so incoming sync never bounces back as a write.
- **localStorage mirror** (`deskdazzle.userdata`) for instant/offline first paint
  and local-only behavior while signed out.

Consumers (`App`, `Desktop`, `ToDoList`, `TodoWidget`) read state and call the
context setters; **none of them talk to the database directly** anymore.

## 3. Profile mirror (Realtime Database)

`src/components/Header.jsx`: on sign-in, a **single `update(users/{uid}/profile, …)`**
writes `{ displayName, email, photoURL, lastLogin: serverTimestamp() }` — one
write, zero reads. This lives under the same `users/{uid}` node as the rest of the
state (no separate database). Nothing in the app reads it back; the UI renders
identity from the Auth `user` object. It exists only as a server-side record for
possible future admin/analytics use.

## 4. Analytics (`firebase/analytics`) — enabled

Initialized in `src/firebaseConfig.js`, guarded by `isSupported()`. The exported
`trackEvent(name, params)` helper no-ops until init completes.

| Event | Params | Where |
|---|---|---|
| `page_view` | `{ page_path }` | `RouteAnalytics` in `src/App.jsx` (every route change) |
| `login` | `{ method: 'google' }` | `src/components/Header.jsx` (after sign-in) |
| `logout` | — | `src/pages/Profile.jsx` |

## 5. Hosting + Rules

- `firebase.json` declares `hosting` (SPA, `dist/`) and `database`
  (`database.rules.json`).
- **`database.rules.json`** — version-controlled RTDB rules: a user may read/write
  only their own `users/{uid}` node (`auth.uid === $uid`). This now covers
  `profile` as well, since it's a child of the same node — no rule change needed.
- No Firestore rules needed — Firestore is no longer used.

---

## What changed in this pass (before → after)

| Concern | Before | After |
|---|---|---|
| Reads on sign-in | 3× `getDoc` of same doc (Header, App, useDesktopLayout) | 1 RTDB `onValue` (initial + live) + 0 reads for profile |
| Writes | One Firestore `updateDoc` per change, no batching, duplicated effects | One debounced (600 ms) batched RTDB `update`, centralized |
| Live sync | None (one-shot reads, last-write-wins) | Live via single listener, detached when tab hidden |
| Profile write | `getDoc` then conditional `setDoc` | One `setDoc` merge, no read |
| Analytics | Configured but commented out | Enabled + `page_view`/`login`/`logout` events |
| Dead code | `src/hooks/useDesktopLayout.js` | Removed |
| RTDB rules | n/a | `database.rules.json` (own-data-only) |

---

## Consolidation pass (Firestore → RTDB)

| Concern | Before | After |
|---|---|---|
| Stores | Hybrid: Firestore (profile) + RTDB (state) | Single RTDB node `users/{uid}` |
| Profile write | Firestore `setDoc` merge | RTDB `update(users/{uid}/profile, …)` |
| Profile read | never (UI uses Auth object) | unchanged — still never read |
| Bundle | ships `firebase/firestore` | Firestore SDK tree-shaken out |
| Rules | RTDB rules + console-managed Firestore | RTDB rules only (cover `profile` too) |

---

## ⚠️ Required manual step before deploy

1. **Create the Realtime Database** in the Firebase console (Build → Realtime
   Database) if it doesn't exist.
2. **Set `databaseURL`** in `src/firebaseConfig.js` to the exact URL shown there
   (region matters — the committed value is the US default placeholder).
3. **Deploy the RTDB rules:** `firebase deploy --only database` (or full
   `npm run deploy`).
