import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { ThemeContext } from '../App';
import { SEARCHABLE } from '../toolsData';

// ⌘K / Ctrl+K palette: type to filter every page and tool, arrow keys to move,
// Enter to navigate. Open/close state is owned by the Shortcuts component.
function CommandPalette({ open, onClose }) {
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCHABLE;
    return SEARCHABLE.filter((item) =>
      (item.name + ' ' + item.desc + ' ' + (item.keywords || '')).toLowerCase().includes(q)
    );
  }, [query]);

  // Reset query + selection and focus the input each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Defer focus until after the element is rendered/visible.
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Keep the active index in range as the result list shrinks.
  useEffect(() => { setActive(0); }, [query]);

  if (!open) return null;

  const choose = (item) => {
    if (!item) return;
    onClose();
    navigate(item.path);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className='palette-backdrop' onMouseDown={onClose}>
      <div
        className={`palette ${theme ? 'dark' : 'light'}`}
        role='dialog'
        aria-label='Command palette'
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className='palette__searchrow'>
          <span className='palette__icon' aria-hidden='true'>🔍</span>
          <input
            ref={inputRef}
            className='palette__input'
            type='text'
            value={query}
            placeholder='Search tools and pages…'
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label='Search'
          />
          <kbd className='palette__esc'>Esc</kbd>
        </div>

        <ul className='palette__list' ref={listRef}>
          {results.map((item, i) => (
            <li key={item.path}>
              <button
                className={`palette__item ${i === active ? 'palette__item--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                ref={(el) => { if (i === active && el) el.scrollIntoView({ block: 'nearest' }); }}
              >
                <span className='palette__item-icon' aria-hidden='true'>{item.icon}</span>
                <span className='palette__item-text'>
                  <span className='palette__item-name'>{item.name}</span>
                  <span className='palette__item-desc'>{item.desc}</span>
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className='palette__empty'>No matches for “{query}”.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default CommandPalette
