// WEBOS Phase 5 — gating hook points for future SaaS/plan limits.
//
// The single place product gating will live: entity creation caps, per-type
// feature flags, workspace/seat limits, read visibility. Today everything is
// allowed (local-first, no plans), but the write layer already routes through
// `policy.canCreate(type)` so turning on a limit later is a one-file change
// with no churn across apps.
//
// Keep this PURE and synchronous — it's consulted on the hot write path.

export const policy = {
  // May the current context create another entity of `type`?
  // Return { ok: false, reason } to block (callers surface `reason`).
  canCreate(/* type, ctx */) {
    return { ok: true };
  },

  // May the current context view this entity? (Reserved for shared/again-gated
  // workspaces; the read layer can filter on this later.)
  canView(/* entity, ctx */) {
    return true;
  },
};

export default policy;
