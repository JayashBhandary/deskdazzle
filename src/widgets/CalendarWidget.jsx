import React, { useState } from 'react'

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
    <div className='widget calw'>
      <div className='calw__header'>
        <span className='calw__nav' onClick={() => shift(-1)}>‹</span>
        <span className='calw__title'>{MONTHS[view.month]} {view.year}</span>
        <span className='calw__nav' onClick={() => shift(1)}>›</span>
      </div>
      <div className='calw__grid'>
        {DAYS.map((d, i) => <div key={i} className='calw__dow'>{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className={`calw__cell ${d && isToday(d) ? 'calw__cell--today' : ''}`}>{d || ''}</div>
        ))}
      </div>
    </div>
  )
}

export default CalendarWidget
