# Implementation Plan — Production Readiness Fixes

Tracks work from `PRODUCTION_READINESS_AUDIT.md`. Multi-session. Tick `[x]` when a task is **done + verified**. Keep the "Status log" at the bottom updated each session.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done · IDs (C-1, H-3…) map to audit findings.

**Current verdict:** 🔴 Critical Issues Prevent Production Deployment
**Target after Phase 1:** 🟡 Production Ready with Minor Changes

---

## Phase 1 — MUST fix before production (blockers)

### C-1 · Replace fake hardcoded-key encryption ✅
- [x] Remove hardcoded `secretPass` from `src/apps/vault/parts/TextEncryptor.jsx`
- [x] Add user passphrase input (encrypt + decrypt)
- [x] Implement Web Crypto: PBKDF2 (≥310k, SHA-256) + AES-GCM, random salt+IV → `src/lib/crypto/textCrypto.js`
- [x] Prepend salt+IV to ciphertext; base64 output (`DDv1:` versioned); parse on decrypt
- [x] Handle wrong-passphrase / malformed-input errors with user feedback (toast)
- [x] Unit test: round-trip encrypt→decrypt, wrong-key fails, tampered ciphertext fails (6 tests, all pass)
- [x] Removed now-unused `crypto-js` dependency from `package.json`

### C-2 · RTDB validation + rate/size rules + App Check  (partial)
- [x] Add `.validate` rules per node (profile/theme/todos/desktop/projects/stores/workspaces) in `database.rules.json`
- [x] Enforce string length + `"$other": {".validate": false}` at every level (blocks unknown keys)
- [x] Enforce remote byte cap server-side on `stores.*.json` (≤921600, mirrors `MAX_REMOTE_BYTES`)
- [ ] ⚠️ todos/desktop/projects arrays not byte-capped (RTDB can't size subtrees) — revisit
- [ ] Enable Firebase App Check (reCAPTCHA) in console + SDK init  *(needs console access)*
- [ ] Test rules with Firebase emulator (allow own valid write, reject oversize/foreign/unknown-key)
- [ ] Deploy rules: `firebase deploy --only database`  *(needs firebase login)*

### C-3 · Security response headers  (deploy-verify pending)
- [x] Add CSP to `firebase.json` (self; connect-src for firebase + 4 APIs; frame-ancestors 'none'; wasm-unsafe-eval; frame-src for auth)
- [x] Add HSTS (max-age + includeSubDomains + preload)
- [x] Add X-Content-Type-Options: nosniff  (+ X-Frame-Options: DENY)
- [x] Add Referrer-Policy: strict-origin-when-cross-origin
- [x] Add Permissions-Policy
- [ ] Verify app still works under CSP after deploy (Google sign-in popup/iframe, PWA SW, WASM, all fetches) — build passes; runtime unverified

### H-1 · Cryptographic password generator ✅
- [x] Replace `Math.random()` in `PasswordGenerator.jsx` with `crypto.getRandomValues` (`secureInt`)
- [x] Rejection sampling to remove modulo bias
- [x] Build alphabet from enabled classes; drop the `i--` skew loop
- [x] Guarantee ≥1 char from each selected class (+ secure Fisher–Yates shuffle)
- [x] Extracted logic to `src/lib/crypto/password.js`; unit tests (length, class-only, ≥1/class, validation, uniqueness)

### H-3 · Analytics consent + privacy + data deletion ✅
- [x] Consent gate: Analytics never inits until opt-in (`analyticsConsent.js` + gated `firebaseConfig.js` + `ConsentBanner.jsx`)
- [x] Privacy policy page (`src/pages/Privacy.jsx`, route `/privacy`) with live consent toggle; linked from Footer + banner
- [x] "Delete account & data" action (`deleteAccountAndData` in `auth.js`: removes `users/$uid` + deletes Auth account w/ reauth-retry) + confirm dialog in Profile
- [x] Profile mirror justified (now READ by Profile.jsx — audit note was stale) + dropped unused `email` field for data minimization

### H-5 · CI/CD + tests + dependency scanning  (partial)
- [x] Add `.github/workflows/ci.yml`: install → `tsc --noEmit` → `vitest run` → build
- [x] Add dependency scan (`npm audit --audit-level=high`) to CI
- [x] Fixed pre-existing tsc errors so CI type-check passes (tsconfig `baseUrl`→paths, `@office` path, office.ts null)
- [~] Tests: crypto ✅, password ✅, taskNlp ✅, backup ✅, theme ✅, fetchJson ✅, notesSanitize ✅, **excel/formula ✅** (47 tests total) — still todo: `syncEngine` local-path
- [ ] Add lint step (no eslint config in repo yet)
- [ ] Gate deploy behind CI with least-privilege Firebase token

### H-2 · Dependency hygiene ✅
- [x] Pick one package manager (npm — scripts use it); deleted `bun.lock`
- [x] Pin exact toolchain versions (typescript/vite/vitest/firebase/@vitejs/plugin-react/vite-plugin-pwa)
- [x] Verify reproducible clean install + build (lock regenerated, build passes)
- [x] Bonus: `npm audit fix` → 0 vulnerabilities (was 2 high/2 moderate incl. dompurify — partial M-1)

---

## Phase 2 — SHOULD fix

### H-4 · Third-party API egress ✅
- [x] Disclose 3rd-party processing (translation/currency/weather) in-app + privacy policy (Privacy page "Third-party services")
- [x] Add `AbortController` timeouts to all `fetch` calls (`src/lib/fetchJson.js`, 10s default) — wired into translation/currency/weather
- [x] Distinct error states vs "offline" (translation: online→'error', offline→'offline')
- [x] `encodeURIComponent` all interpolated query params (currency `fromCurrency`, translation langpair)
- [x] Unit tests for `fetchJson` (success / non-2xx / timeout / network)

### M-1 · Harden Notes sanitizer ✅
- [x] Minimize DOMPurify config: `FORBID_ATTR:['style']` + `FORBID_TAGS:['style']`; dompurify updated via `npm audit fix`
- [x] `afterSanitizeAttributes` hook forces `rel="noopener noreferrer"` on any link with `target`
- [x] Extracted to `src/lib/notesSanitize.js` (testable) + 6 tests: strips `<script>`/`onerror`/`javascript:`/`style`, forces rel, keeps data-* attrs

### M-2 · Validate backup import ✅
- [x] Key allowlist regex (`/^deskdazzle\.[\w.:-]+$/`) — rejects foreign/weird keys
- [x] Re-serialize each value + 5 MB per-store size cap; `deskdazzle.settings` forced through `normalizeSettings`
- [x] (Confirmation dialog already existed in Profile before import)

### M-3 · Theme CSS injection guard ✅
- [x] `buildThemeCSS` re-validates every value via `parseOklch` and reformats via `formatOklch` before injection
- [x] Removed raw passthrough at `theme.js` `generateDarkFromLight` (drops unparseable)
- [x] Tests with malicious color strings (breakout / url()/javascript: dropped)

### M-5 · Error Boundaries ✅
- [x] Global Error Boundary wrapping `<App>` in `index.jsx`
- [x] Per-route boundary (`RoutedBoundary`, keyed on pathname) keeps Header/Footer alive + "Try again"/"Reload"
- [x] Reports to consent-gated telemetry (`trackEvent('error_boundary', …)`)

### M-7 · Sync conflict model  (IN PROGRESS — core built + proven; wiring pending)
Current live behavior: whole-store last-write-wins on client `Date.now()`
(`syncEngine._attach`). Two devices editing different items offline → later writer
clobbers the other → silent loss.

**Step 1 — merge core DONE ✅** (`src/lib/store/merge.js`, 16 tests):
- [x] Per-item envelope: `{ items:{id:{v,m}}, tombstones:{id:m}, order:[], orderMs }`
- [x] `toEnvelope(arr, prev, now)` — diffs by id, stamps only changed items, tombstones removals, tracks order
- [x] `fromEnvelope(env)` — reconstructs ordered array, skips tombstoned
- [x] `mergeEnvelopes(a,b)` — per-item LWW; deletes survive; edit-after-delete resurrects; idempotent; commutative winner; order reconciliation
- [x] `isCollection()` guard; tombstone TTL pruning (30d)
- [x] Proven: cross-item edits both survive; delete not resurrected; same-item → newer wins

**Step 2 — wire into SyncedStore (NEXT, needs care):**
- [ ] For collection stores, keep the envelope and serialize it INTO the existing `json` string
      (payload stays `{json, updatedMs}` so the C-2 RTDB rules stay valid — no rule change)
- [ ] `set()`: if `isCollection(value)`, rebuild envelope via `toEnvelope`
- [ ] `_attach` onValue: if remote is an envelope AND local is a collection → `mergeEnvelopes`,
      `fromEnvelope`→value, write merged back; scalars/objects keep LWW
- [ ] Legacy migration: if remote `json` parses to a plain array (old format) → wrap via `toEnvelope` first
- [ ] (Optional refinement) `serverTimestamp()` ordering + adopt resolved ms on echo to kill clock skew
- [ ] Surface unresolved same-item conflicts (toast) instead of silently discarding
Note: a half-measure (union-merge without tombstones) trades lost-edits for
resurrected-deletes — strictly worse. Core above avoids that.

### M-8 · Auth error UX ✅
- [x] Removed `console.log(error)`; ignore benign popup-cancel codes
- [x] Toast for real online failures; offline left to caller
- [ ] (Typed result/throw deferred — would ripple to Header/Profile; current null contract kept)

### I-5 · Monitoring  (needs external service — user action)
- [ ] Add Sentry (or equivalent) RUM + error reporting
- [ ] Firebase quota / usage alerts

---

## Phase 3 — NICE to have

### M-6 · Load performance ✅
- [x] Defer WASM prefetch to `requestIdleCallback` (was blocking-ish on boot); `core.*` already awaits `loadCore()` so nothing breaks
- [x] `React.lazy` + `Suspense` for all route pages (App.jsx) + heavy desktop widgets (Excel/Word/Ppt/Pdf/Drive/Media in Desktop.jsx)
- [x] Result: initial JS chunk **1,538 kB → 951 kB** (~38% smaller); Excel/Word/Ppt/Pdf/Drive/Design/Converters now on-demand chunks
- [ ] (Firebase/vendor manualChunks split — optional further win, not done)

### M-4 · Leaks ✅  /  L-6 · virtualization (deferred)
- [x] Revoke Drive image-preview object URL on change/unmount (`useEffect` cleanup)
- [x] Audited all `createObjectURL` sites (13) — others revoke or are one-shot downloads
- [ ] Virtualize long lists (Drive/Notes/Excel/Flashcards) — deferred (per-component effort)

### I-2 · WASM supply chain  (needs Rust toolchain in CI)
- [ ] Build `core/pkg` + `office/pkg` in CI from source
- [ ] Verify checksums; stop trusting committed binaries

### Misc
- [x] L-1 encode all query params (currency/translation/weather)
- [x] L-5 unify IDs on `crypto.randomUUID()` + fallback (`src/lib/id.js`; rewired 9 sites)
- [x] L-4 central structured logger (`src/lib/logger.js`, strips debug/info in prod); routed index/ErrorBoundary/syncEngine console calls
- [x] L-7 PWA update prompt: `registerType` `autoUpdate`→`prompt` + `PwaUpdatePrompt` reload toast (no silent mid-session SW swap)
- [x] L-2 App Check **client wiring** done (`firebaseConfig.js`, guarded by `VITE_APPCHECK_SITE_KEY`, `.env.example`); ⚠️ still need: register reCAPTCHA key in console + set env + API-key referrer restrictions
- [x] L-3 startup health assertion for `databaseURL` (logs error if placeholder/invalid); ⚠️ still verify prod region value
- [ ] I-3 WCAG/keyboard-nav audit + theme contrast guardrails
- [ ] I-4 migrate hot paths (.jsx → .ts)
- [ ] I-6 enable scheduled RTDB backups / DR

---

## Status log

| Date | Session notes | Tasks completed |
|------|---------------|-----------------|
| 2026-07-23 | Audit + plan created. No fixes started. | — |
| 2026-07-23 | Branch `hardening/phase-1`. Implemented C-1 (Web Crypto encrypt, +6 tests), H-1 (CSPRNG password gen), C-3 (security headers), C-2 (RTDB validation rules), H-2 (removed bun.lock), H-5 (CI workflow + audit + tsconfig fixes). tsc clean, build passes, tests green. Remaining: App Check/rule deploy (console), H-3 (consent/privacy), version pinning, more tests, CSP runtime verify. | C-1 ✅, H-1 (code), C-3 (code), C-2 (rules), H-2 (lockfile), H-5 (CI) |
| 2026-07-23 | Session 8 (M-7 start): Built the merge CORE in isolation (`lib/store/merge.js`) — per-item LWW envelope with tombstones + order reconciliation + TTL pruning. 16 exhaustive tests prove the guarantees (cross-item edits survive, deletes not resurrected, edit-after-delete resurrects, same-item newer-wins, idempotent). NOT yet wired into the live sync engine (that's step 2 — documented precisely in plan; kept out of the live path to avoid regressions). Suite now 63 tests, tsc clean, build ok. | M-7 core ✅ (wiring pending) |
| 2026-07-23 | Session 7: Added Excel formula-engine test suite (12 tests — the 950-LOC engine had zero coverage): arithmetic/precedence, cell refs, ranges (SUM/AVG/MAX/MIN/COUNT), IF, VLOOKUP, error codes (#DIV/0!, #NAME?), IFERROR, coercion helpers, col↔index. Suite now 47 tests. tsc clean. | H-5 tests (excel/formula) ✅ |
| 2026-07-23 | Session 6: L-2 App Check client wiring (guarded by `VITE_APPCHECK_SITE_KEY`, `.env.example`, no-op without key — completes C-2 client side; console key still needed). L-3 databaseURL startup health guard. Assessed M-7: proper fix needs data-model change (per-entity ts + tombstones + server ordering) — documented spec, deferred (half-measure would resurrect deletes). tsc clean, 35 tests, build ok. | L-2 (client) ✅, L-3 ✅ |
| 2026-07-23 | Session 5: M-1 finished (extracted `notesSanitize.js` + 6 tests, allow `target` w/ forced rel). L-4 (central `logger.js`, prod-strips debug/info; routed 3 console sites). L-7 (PWA `prompt` mode + `PwaUpdatePrompt` reload toast). Also enhanced ErrorBoundary to show error message+stack (after unreproducible boundary report — likely transient HMR). tsc clean, 35 tests, build ok. | M-1 ✅, L-4 ✅, L-7 ✅ |
| 2026-07-23 | Session 4 (Phase 3): M-6 (React.lazy for all route pages + heavy desktop widgets, deferred WASM prefetch → initial chunk 1538→951 kB, ~38% smaller), M-4 (Drive preview object-URL leak fixed + audited all 13 createObjectURL sites), L-5 (shared `lib/id.js`, rewired 9 id sites to crypto.randomUUID). tsc clean, 29 tests green, build ok. Deferred: L-6 virtualization, L-7 PWA prompt, L-4 logger, I-2/I-3/I-4/I-6, console-only items (L-2/L-3). | M-6 ✅, M-4 ✅, L-5 ✅, L-1 ✅ |
| 2026-07-23 | Session 3 (Phase 2): H-4 (fetchJson timeout wrapper + wired to translation/currency/weather, encode params, distinct errors, +4 tests), M-1 (Notes sanitizer: forbid style, rel=noopener hook), M-2 (backup import: key allowlist + size cap + settings normalize), M-3 (buildThemeCSS re-validates via parseOklch, +4 tests), M-5 (global + per-route ErrorBoundary w/ telemetry), M-8 (auth toast, no console.log). 29 tests green, tsc clean, build passes. Deferred: M-7 (LWW rewrite — risky), I-5 (Sentry — needs account). | H-4 ✅, M-1 ✅, M-2 ✅, M-3 ✅, M-5 ✅, M-8 ✅ |
| 2026-07-23 | Session 2: H-3 done (consent gate + banner, `/privacy` page w/ live toggle, delete-account+data w/ reauth, dropped unused email). H-1 finished (extracted `password.js` + tests). H-2 done (pinned versions, regenerated lock, `npm audit fix` → 0 vulns). Expanded tests to 21 (crypto/password/taskNlp/backup). Footer privacy link. tsc clean, build passes, 21/21 tests green, 0 vulns. Phase-1 code complete except deploy/console steps (App Check, rule deploy, CSP runtime verify) + a few more test files. | H-3 ✅, H-1 ✅, H-2 ✅ |
