import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import DesktopWindow from '../components/DesktopWindow';
import { useDesktopLayout } from '../hooks/useDesktopLayout';

import ClockWidget from '../widgets/ClockWidget';
import TodoWidget from '../widgets/TodoWidget';
import NotesWidget from '../widgets/NotesWidget';
import CalculatorWidget from '../widgets/CalculatorWidget';
import WeatherWidget from '../widgets/WeatherWidget';
import BudgetWidget from '../widgets/BudgetWidget';
import CalendarWidget from '../widgets/CalendarWidget';
import ColorWidget from '../widgets/ColorWidget';

// Registry of every widget that can live on the desktop.
const WIDGETS = {
  clock: { title: 'Clock', icon: '🕐', component: ClockWidget, w: 280, h: 200 },
  todo: { title: 'To-Do', icon: '✅', component: TodoWidget, w: 300, h: 360 },
  notes: { title: 'Notes', icon: '📝', component: NotesWidget, w: 300, h: 360 },
  calculator: { title: 'Calculator', icon: '🧮', component: CalculatorWidget, w: 280, h: 380 },
  weather: { title: 'Weather', icon: '🌦️', component: WeatherWidget, w: 280, h: 300 },
  budget: { title: 'Budget', icon: '💳', component: BudgetWidget, w: 330, h: 420 },
  calendar: { title: 'Calendar', icon: '📅', component: CalendarWidget, w: 320, h: 320 },
  color: { title: 'Color Picker', icon: '🎨', component: ColorWidget, w: 300, h: 360 },
};

const ORDER = ['clock', 'todo', 'notes', 'calculator', 'weather', 'budget', 'calendar', 'color'];

// First-visit layout.
const DEFAULT_LAYOUT = [
  { id: 'clock', type: 'clock', x: 40, y: 30, width: 280, height: 200, z: 1, minimized: false, maximized: false },
  { id: 'todo', type: 'todo', x: 350, y: 30, width: 300, height: 360, z: 2, minimized: false, maximized: false },
  { id: 'weather', type: 'weather', x: 680, y: 30, width: 280, height: 300, z: 3, minimized: false, maximized: false },
];

function Desktop() {
  const { theme, user, isLoggedIn } = useContext(ThemeContext);
  const [windows, setWindows] = useDesktopLayout(user, DEFAULT_LAYOUT);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const open = (type) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === type);
      const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0) + 1;
      if (existing) {
        return prev.map((w) => (w.id === type ? { ...w, minimized: false, z: top } : w));
      }
      const meta = WIDGETS[type];
      const offset = prev.length * 28;
      return [...prev, {
        id: type,
        type,
        x: 60 + offset,
        y: 40 + offset,
        width: meta.w,
        height: meta.h,
        z: top,
        minimized: false,
        maximized: false,
      }];
    });
  };

  const focus = (id) => setWindows((prev) => {
    const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0);
    const target = prev.find((w) => w.id === id);
    if (target && target.z === top) return prev;
    return prev.map((w) => (w.id === id ? { ...w, z: top + 1 } : w));
  });

  const close = (id) => setWindows((prev) => prev.filter((w) => w.id !== id));
  const minimize = (id) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, minimized: true } : w)));
  const maximize = (id) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w)));
  const change = (id, partial) => setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...partial } : w)));

  const restore = (id) => setWindows((prev) => {
    const top = prev.reduce((m, w) => Math.max(m, w.z || 0), 0) + 1;
    return prev.map((w) => (w.id === id ? { ...w, minimized: false, z: top } : w));
  });

  const openIds = new Set(windows.map((w) => w.id));
  const visibleCount = windows.filter((w) => !w.minimized).length;

  return (
    <div className={`desktop ${theme ? 'dark' : 'light'}`}>
      <div className='desktop__surface'>
        {visibleCount === 0 && (
          <div className='desktop__hint'>
            <h2>🖥️ Your workspace</h2>
            <p>Open widgets from the dock below. Drag the title bars to move them, drag edges to resize. Your layout is saved{isLoggedIn ? ' to your account' : ' on this device'}.</p>
            <Link className={`header_button ${theme ? 'dark' : 'light'}`} to='/apps'>Browse all tools →</Link>
          </div>
        )}

        {windows.map((win) => {
          const meta = WIDGETS[win.type];
          if (!meta) return null;
          return (
            <DesktopWindow
              key={win.id}
              win={win}
              meta={meta}
              isMobile={isMobile}
              onFocus={focus}
              onClose={close}
              onMinimize={minimize}
              onMaximize={maximize}
              onChange={change}
            />
          );
        })}
      </div>

      <div className={`dock ${theme ? 'dark' : 'light'}`}>
        {ORDER.map((type) => {
          const meta = WIDGETS[type];
          const win = windows.find((w) => w.id === type);
          const isOpen = openIds.has(type);
          return (
            <button
              key={type}
              className={`dock__item ${isOpen ? 'dock__item--open' : ''} ${win?.minimized ? 'dock__item--min' : ''}`}
              title={meta.title}
              onClick={() => (win?.minimized ? restore(type) : open(type))}
            >
              <span className='dock__icon'>{meta.icon}</span>
              <span className='dock__label'>{meta.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  )
}

export default Desktop
