import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../App';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { signInWithGoogle } from '../auth';
import { NAV_LINKS } from '../toolsData';

// Fired by the header search button and consumed by the global Shortcuts
// component, which owns the command palette's open state.
export const openCommandPalette = () =>
  window.dispatchEvent(new CustomEvent('deskdazzle:open-palette'));

function Header() {
  const { theme, setTheme, isLoggedIn, user, profile } = useContext(ThemeContext);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const handleThemeChange = () => setTheme(theme === false ? true : false);

  const themeClass = theme ? 'dark' : 'light';

  const profileSlot = isLoggedIn
    ? (
      <Link className={`header__avatar ${themeClass}`} to="/profile" aria-label='Profile'>
        <img alt='profile' src={profile?.photoURL || user?.photoURL} referrerPolicy='no-referrer' />
      </Link>
    )
    : (
      <button className={`header__signin ${themeClass}`} onClick={signInWithGoogle} aria-label='Sign in'>🔑</button>
    );

  return (
    <>
    <header className={`site-header ${themeClass}`}>
      <Link to='/' className='site-header__brand' style={{ textDecoration: 'none' }} aria-label='DeskDazzle home'>
        <h2 className={themeClass}>DƎSK</h2>
        <h4 className={themeClass}>DAZZLƎ</h4>
      </Link>

      {/* Desktop navigation */}
      <nav className='site-header__nav' aria-label='Primary'>
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/'}
            className={({ isActive }) => `nav-link ${themeClass} ${isActive ? 'nav-link--active' : ''}`}
          >
            <span aria-hidden='true'>{link.icon}</span> {link.label}
          </NavLink>
        ))}
      </nav>

      <div className='site-header__actions'>
        <button
          className={`header__search ${themeClass}`}
          onClick={openCommandPalette}
          aria-label='Search (Command or Ctrl + K)'
          title='Search — ⌘K / Ctrl+K'
        >
          <span>🔍 Search</span>
          <kbd className='header__kbd'>⌘K</kbd>
        </button>

        <input
          className='theme-switch'
          type="checkbox"
          id="theme-switch"
          checked={theme}
          onChange={handleThemeChange}
        />
        <label className='theme-switch__label' htmlFor='theme-switch' title='Toggle theme (T)'>{theme ? "🌙" : "☀️"}</label>

        <div className='header__profile-desktop'>{profileSlot}</div>

        <button
          className={`header__hamburger ${themeClass} ${drawerOpen ? 'is-open' : ''}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label='Menu'
          aria-expanded={drawerOpen}
        >
          <span /><span /><span />
        </button>
      </div>
    </header>

      {/* Mobile drawer + backdrop — kept OUTSIDE <header> because the header's
          backdrop-filter would otherwise become the containing block for these
          position:fixed elements and clip them to the 70px bar. */}
      <div
        className={`drawer-backdrop ${drawerOpen ? 'is-open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`drawer ${themeClass} ${drawerOpen ? 'is-open' : ''}`} aria-hidden={!drawerOpen}>
        <div className='drawer__head'>
          <span className='drawer__title'>Menu</span>
          <button className='drawer__close' onClick={() => setDrawerOpen(false)} aria-label='Close menu'>×</button>
        </div>

        <button
          className={`drawer__search ${themeClass}`}
          onClick={() => { setDrawerOpen(false); openCommandPalette(); }}
        >
          🔍 Search tools…
        </button>

        <nav className='drawer__nav' aria-label='Mobile'>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              className={({ isActive }) => `drawer__link ${themeClass} ${isActive ? 'drawer__link--active' : ''}`}
            >
              <span className='drawer__link-icon' aria-hidden='true'>{link.icon}</span> {link.label}
            </NavLink>
          ))}
          <NavLink to='/donate' className={`drawer__link ${themeClass}`}>
            <span className='drawer__link-icon' aria-hidden='true'>🙌</span> Donate
          </NavLink>
          <NavLink to='/profile' className={`drawer__link ${themeClass}`}>
            <span className='drawer__link-icon' aria-hidden='true'>👤</span> Profile
          </NavLink>
        </nav>

        <div className='drawer__foot'>
          <label className='drawer__theme' htmlFor='theme-switch-drawer'>
            <input
              id='theme-switch-drawer'
              type='checkbox'
              checked={theme}
              onChange={handleThemeChange}
            />
            {theme ? '🌙 Dark theme' : '☀️ Light theme'}
          </label>
          {!isLoggedIn && (
            <button className={`header_button ${themeClass}`} onClick={() => { setDrawerOpen(false); signInWithGoogle(); }}>🔑 Sign in with Google</button>
          )}
        </div>
      </aside>
    </>
  )
}

export default Header
