import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ToolPage from '../components/ToolPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Calender() {
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
    <ToolPage icon='📅' title='Calendar' description='Browse a monthly calendar.'>
      <Card>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between gap-2'>
            <Button variant='outline' size='icon' onClick={() => shift(-1)} aria-label='Previous month'>
              <ChevronLeft />
            </Button>
            <h2 className='text-lg font-semibold tracking-tight'>{MONTHS[view.month]} {view.year}</h2>
            <Button variant='outline' size='icon' onClick={() => shift(1)} aria-label='Next month'>
              <ChevronRight />
            </Button>
          </div>

          <div className='grid grid-cols-7 gap-1 text-center'>
            {DAYS.map((d) => (
              <div key={d} className='py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{d}</div>
            ))}
            {cells.map((d, i) => (
              <div
                key={i}
                className={`flex aspect-square items-center justify-center rounded-md text-sm ${
                  d && isToday(d)
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : d
                      ? 'text-foreground hover:bg-accent'
                      : ''
                }`}
              >
                {d || ''}
              </div>
            ))}
          </div>

          <div className='flex justify-center'>
            <Button
              variant='secondary'
              onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
            >
              Today
            </Button>
          </div>
        </CardContent>
      </Card>
    </ToolPage>
  )
}

export default Calender
