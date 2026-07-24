import { useEffect } from 'react';
import { useWorkspaceEntities } from '@/lib/context/useWorkspaceEntities';

// PWA App Badging: paints the count of actionable items (overdue OR due today,
// not yet done) onto the installed app's icon, so pending work is visible
// without opening the app. Mirrors the Today app's due-window logic over the
// shared workspace entity graph. Feature-detected — a no-op where the Badging
// API is unavailable (Firefox/Safari, or a non-installed tab). Must be mounted
// under WorkspaceGraphProvider so the entity graph is in scope.
export default function AppBadge() {
  const wctx = useWorkspaceEntities();

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayEnd = start.getTime() + 86_400_000;

    let count = 0;
    for (const e of wctx.entities) {
      if (typeof e.dueMs !== 'number' || e.done) continue;
      if (e.dueMs < todayEnd) count += 1; // overdue or due today, still open
    }

    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }, [wctx.entities]);

  return null;
}
