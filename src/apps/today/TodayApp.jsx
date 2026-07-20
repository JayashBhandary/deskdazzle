import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWorkspaceEntities } from '@/lib/context/useWorkspaceEntities';
import { useOpenEntity, entityIcon } from '@/lib/context/entityMeta';
import { dueLabel } from '@/components/tasks/model';

// The "Today" app (WEBOS Phase 2) — a single agenda across the WHOLE workspace.
// It's a pure cross-app view over the shared entity graph: every dated thing
// (a task's due date, a roadmap milestone's target) flows in through the
// context layer, grouped into Overdue / Today / Next 7 days. Nothing is copied
// and there's no storage of its own; each row opens in its owning app.
//
// Like every DeskDazzle app it's one `@container` component shared by the full
// page and the desktop widget, so it reflows from a roomy three-section agenda
// down to a compact list in a ~300px widget.
function TodayApp() {
  const wctx = useWorkspaceEntities();
  const openEntity = useOpenEntity();

  const groups = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const todayStart = start.getTime();
    const todayEnd = todayStart + 86_400_000;
    const weekEnd = todayStart + 7 * 86_400_000;

    const overdue = [];
    const today = [];
    const upcoming = [];
    for (const e of wctx.entities) {
      if (typeof e.dueMs !== 'number') continue;
      if (e.dueMs < todayStart) {
        if (!e.done) overdue.push(e); // completed past items aren't "overdue"
      } else if (e.dueMs < todayEnd) {
        today.push(e);
      } else if (e.dueMs < weekEnd) {
        if (!e.done) upcoming.push(e);
      }
    }
    const byDue = (a, b) => (a.dueMs || 0) - (b.dueMs || 0);
    overdue.sort(byDue);
    today.sort(byDue);
    upcoming.sort(byDue);
    return { overdue, today, upcoming };
  }, [wctx.entities]);

  const total = groups.overdue.length + groups.today.length + groups.upcoming.length;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const Row = ({ ent }) => (
    <button
      type="button"
      onClick={() => openEntity(ent)}
      title={`Open in ${ent.type === 'milestone' ? 'Roadmap' : ent.type}`}
      className="flex w-full items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <span className="shrink-0 text-base">{entityIcon(ent.type)}</span>
      <span className={cn('min-w-0 flex-1 truncate text-sm', ent.done && 'text-muted-foreground line-through')}>
        {ent.title || 'Untitled'}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{dueLabel(ent.dueMs)}</span>
    </button>
  );

  const Section = ({ title, items, tone }) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide', tone)}>
          {title}
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {items.length}
          </span>
        </p>
        <div className="space-y-1">
          {items.map((ent) => <Row key={ent.id} ent={ent} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Card className="flex h-full min-h-0 flex-col">
        <CardContent className="flex h-full min-h-0 flex-col gap-3 p-3 @md:p-6">
          <div className="flex shrink-0 items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight @md:text-base">Today</h2>
              <p className="truncate text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            {total === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="text-3xl">🎉</span>
                <p className="text-sm text-muted-foreground">
                  Nothing due today or this week. Add a due date to a task or milestone and it lands here.
                </p>
              </div>
            ) : (
              <>
                <Section title="Overdue" items={groups.overdue} tone="text-destructive" />
                <Section title="Today" items={groups.today} tone="text-primary" />
                <Section title="Next 7 days" items={groups.upcoming} tone="text-muted-foreground" />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TodayApp;
