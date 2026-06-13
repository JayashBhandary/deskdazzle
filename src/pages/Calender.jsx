import React, { useContext, useState } from 'react'
import { ThemeContext } from '../App';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Calender() {
  const { theme } = useContext(ThemeContext);
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
    <div className='page'>
      <div className='page__content'>
        <label>📅 Calender</label>
        <div className='content'>
          <div className={`calendar ${theme ? 'dark' : 'light'}`}>
            <div className='calendar__header'>
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => shift(-1)}>‹</button>
              <h2 className='calendar__title'>{MONTHS[view.month]} {view.year}</h2>
              <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => shift(1)}>›</button>
            </div>
            <div className='calendar__grid'>
              {DAYS.map((d) => <div key={d} className='calendar__dow'>{d}</div>)}
              {cells.map((d, i) => (
                <div key={i} className={`calendar__cell ${d && isToday(d) ? 'calendar__cell--today' : ''}`}>
                  {d || ''}
                </div>
              ))}
            </div>
            <button className={`header_button ${theme ? 'dark' : 'light'}`} onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}>Today</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Calender
