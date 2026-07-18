import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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

// The Calendar app — one component rendered by both the full page and the
// desktop widget. A `@container` root means the layout adapts to whatever width
// it's given: full month/day names, roomy cells and a "Today" button on the
// page; abbreviated labels and a compact grid in a small (~300px) widget,
// reflowing live as the user resizes the window.
function CalendarApp() {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) =>
    d === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();

  const shift = (delta) => {
    setView((v) => {
      const m = v.month + delta;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { ...v, month: m };
    });
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <Card className="flex h-full min-h-0 flex-col">
        <CardContent className="flex h-full min-h-0 flex-col gap-2 p-3 @sm:gap-3 @md:gap-4 @md:p-6">
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

          <div className="grid min-h-0 flex-1 grid-cols-7 content-start gap-0.5 text-center @md:gap-1">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground @md:text-xs"
              >
                <span className="@sm:hidden">{d.short}</span>
                <span className="hidden @sm:inline">{d.long}</span>
              </div>
            ))}
            {cells.map((d, i) => (
              <div
                key={i}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md text-xs tabular-nums @md:text-sm',
                  d && isToday(d) && 'bg-primary font-semibold text-primary-foreground',
                  d && !isToday(d) && 'text-foreground hover:bg-accent',
                )}
              >
                {d || ''}
              </div>
            ))}
          </div>

          <div className="flex shrink-0 justify-center">
            <Button
              variant="secondary"
              size="sm"
              className="@md:h-9 @md:px-4"
              onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
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
