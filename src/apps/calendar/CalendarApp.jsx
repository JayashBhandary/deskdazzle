import React, { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useWorkspaceEntities, dateKeyOf } from '@/lib/context/useWorkspaceEntities'
import { useOpenEntity, entityIcon } from '@/lib/context/entityMeta'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = [
  { short: 'S', long: 'Sun' },
  { short: 'M', long: 'Mon' },
  { short: 'T', long: 'Tue' },
  { short: 'W', long: 'Wed' },
  { short: 'T', long: 'Thu' },
  { short: 'F', long: 'Fri' },
  { short: 'S', long: 'Sat' },
];

const localDayKey = (year, month, day) => dateKeyOf(new Date(year, month, day).getTime());

// The Calendar app — one component rendered by both the full page and the
// desktop widget. A `@container` root means the layout adapts to whatever width
// it's given: full month/day names, roomy cells and a "Today" button on the
// page; abbreviated labels and a compact grid in a small (~300px) widget,
// reflowing live as the user resizes the window.
//
// It's also the first read-only *cross-app view* (WEBOS Phase 2): every dated
// workspace entity — a task's due date, a roadmap milestone's target — surfaces
// on its day via the shared context layer (`entitiesOnDate`). No data is
// copied; the calendar just queries the one entity graph. Clicking a day lists
// its items and each one opens in its owning app.
function CalendarApp() {
  const wctx = useWorkspaceEntities();
  const openEntity = useOpenEntity();
  const today = new Date();
  const todayKey = dateKeyOf(today.getTime());
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => localDayKey(view.year, view.month, d) === todayKey;

  const shift = (delta) => {
    setView((v) => {
      const m = v.month + delta;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { ...v, month: m };
    });
  };

  const goToday = () => {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedKey(todayKey);
  };

  // Items for the currently selected day (sorted by due time in the layer).
  const selectedItems = useMemo(() => {
    if (!selectedKey) return [];
    const [y, m, d] = selectedKey.split('-').map(Number);
    return wctx.entitiesOnDate(new Date(y, m - 1, d));
  }, [selectedKey, wctx]);

  const selectedLabel = useMemo(() => {
    if (!selectedKey) return '';
    const [y, m, d] = selectedKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }, [selectedKey]);

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Card className="flex h-full min-h-0 flex-col">
        <CardContent className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3 @sm:gap-3 @md:gap-4 @md:p-6">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-7 @md:size-9"
              onClick={() => shift(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-sm font-semibold tracking-tight @sm:text-base @md:text-lg">
              <span className="@sm:hidden">{MONTHS_SHORT[view.month]}</span>
              <span className="hidden @sm:inline">{MONTHS[view.month]}</span> {view.year}
            </h2>
            <Button
              variant="outline"
              size="icon"
              className="size-7 @md:size-9"
              onClick={() => shift(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid shrink-0 grid-cols-7 content-start gap-0.5 text-center @md:gap-1">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground @md:text-xs"
              >
                <span className="@sm:hidden">{d.short}</span>
                <span className="hidden @sm:inline">{d.long}</span>
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const key = localDayKey(view.year, view.month, d);
              const hasItems = (wctx.byDate.get(key) || []).length > 0;
              const selected = key === selectedKey;
              const dayIsToday = isToday(d);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedKey(key)}
                  aria-label={`${MONTHS[view.month]} ${d}${hasItems ? ', has items' : ''}`}
                  aria-pressed={selected}
                  className={cn(
                    'relative flex aspect-square max-h-9 items-center justify-center rounded-md text-xs tabular-nums transition-colors @md:max-h-11 @md:text-sm',
                    dayIsToday && 'bg-primary font-semibold text-primary-foreground',
                    !dayIsToday && selected && 'bg-accent font-semibold text-accent-foreground ring-1 ring-primary/50',
                    !dayIsToday && !selected && 'text-foreground hover:bg-accent',
                  )}
                >
                  {d}
                  {hasItems && (
                    <span
                      className={cn(
                        'absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full',
                        dayIsToday ? 'bg-primary-foreground' : 'bg-primary',
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day agenda — the cross-app view: the month grid keeps its
              size and this block grows to fill the rest, scrolling its list. */}
          <div className="mt-1 flex min-h-28 flex-1 flex-col gap-1.5 border-t pt-2">
            <p className="shrink-0 text-xs font-medium text-muted-foreground">{selectedLabel}</p>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {selectedItems.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">Nothing scheduled.</p>
              ) : (
                selectedItems.map((ent) => (
                  <button
                    type="button"
                    key={ent.id}
                    onClick={() => openEntity(ent)}
                    title={`Open in ${ent.type === 'milestone' ? 'Roadmap' : ent.type}`}
                    className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <span className="shrink-0">{entityIcon(ent.type)}</span>
                    <span className={cn('min-w-0 flex-1 truncate', ent.done && 'text-muted-foreground line-through')}>
                      {ent.title || 'Untitled'}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {ent.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="@md:h-9 @md:px-4"
              onClick={goToday}
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CalendarApp
