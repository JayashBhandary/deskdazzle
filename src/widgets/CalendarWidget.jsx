import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function CalendarWidget() {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const firstDay = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d) => d === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();

  const shift = (delta) => setView((v) => {
    const m = v.month + delta;
    if (m < 0) return { year: v.year - 1, month: 11 };
    if (m > 11) return { year: v.year + 1, month: 0 };
    return { ...v, month: m };
  });

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-7" onClick={() => shift(-1)} aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">{MONTHS[view.month]} {view.year}</span>
        <Button variant="ghost" size="icon" className="size-7" onClick={() => shift(1)} aria-label="Next month">
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAYS.map((d, i) => (
          <div key={i} className="py-1 text-[10px] font-medium uppercase text-muted-foreground">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div
            key={i}
            className={cn(
              'flex aspect-square items-center justify-center rounded-md text-xs tabular-nums',
              d && isToday(d) && 'bg-primary font-semibold text-primary-foreground',
              d && !isToday(d) && 'hover:bg-accent',
            )}
          >
            {d || ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default CalendarWidget
