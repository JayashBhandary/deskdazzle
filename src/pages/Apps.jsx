import React, { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import { TOOLS } from '../toolsData';

function Apps() {
  const { theme } = useContext(ThemeContext);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter((t) =>
      (t.name + ' ' + t.desc + ' ' + (t.keywords || '')).toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className='page'>
      <div className='page__content'>

        <div className='apps__head'>
          <label>Apps</label>
          <input
            className={`apps__search ${theme ? 'dark' : 'light'}`}
            type='search'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='🔍 Search tools…'
            aria-label='Search tools'
          />
        </div>

        <div className='apps__grid'>
          {filtered.map((tool) => (
            <Link
              key={tool.path}
              className={`app-card ${theme ? 'dark' : 'light'}`}
              to={tool.path}
            >
              <span className='app-card__icon'>{tool.icon}</span>
              <span className='app-card__name'>{tool.name}</span>
              <span className='app-card__desc'>{tool.desc}</span>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className='apps__empty'>No tools match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Apps
