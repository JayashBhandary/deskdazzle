import React, { useContext } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import { TOOLS, SHORTCUT_GROUPS } from '../toolsData';

const SECTIONS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'workspace', label: 'The Workspace' },
  { id: 'tools', label: 'Tools' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'accounts', label: 'Accounts & Sync' },
  { id: 'install', label: 'Install the App' },
  { id: 'themes', label: 'Themes' },
  { id: 'faq', label: 'FAQ' },
];

// Render one shortcut row from the shared SHORTCUT_GROUPS data.
function ShortcutKeys({ keys, alt }) {
  const render = (list) => list.map((k, i) => (
    (k === 'then' || k === '–')
      ? <span className='docs-shortcut__sep' key={i}>{k}</span>
      : <kbd className='docs-kbd' key={i}>{k}</kbd>
  ));
  return (
    <span className='docs-shortcut__keys'>
      {render(keys)}
      {alt && <><span className='docs-shortcut__or'>or</span>{render(alt)}</>}
    </span>
  );
}

function Docs() {
  const { theme } = useContext(ThemeContext);
  const tone = theme ? 'dark' : 'light';

  return (
    <div className='page'>
      <div className='page__content'>
        <label className='docs__title'>🔧 Documentation</label>
        <p className='docs__lead'>
          Everything you need to get the most out of DeskDazzle — your all-in-one
          workspace of 20+ productivity tools, a draggable widget desktop, and
          keyboard shortcuts to move at speed.
        </p>

        <div className='content' style={{ marginTop: 10 }}>
          <div className='docs'>
            <aside className='docs__toc'>
              <span className='docs__toc-title'>On this page</span>
              {SECTIONS.map((s) => (
                <a key={s.id} className={tone} href={`#${s.id}`}>{s.label}</a>
              ))}
            </aside>

            <div className='docs__body'>
              {/* Welcome */}
              <section id='welcome' className='docs-section'>
                <h2>👋 Welcome</h2>
                <p>
                  DeskDazzle bundles the small utilities you reach for every day —
                  converters, generators, a calculator, notes, a to-do list and
                  more — into a single, fast web app. Nothing to install (though
                  you can), and your work follows you between devices when you sign in.
                </p>
                <p>It runs everywhere: phone, tablet and desktop, in light or dark.</p>
                <div className='docs-callout'>
                  <span>💡</span>
                  <span>
                    In a hurry? Press <kbd className='docs-kbd'>⌘</kbd>
                    <kbd className='docs-kbd'>K</kbd> (or <kbd className='docs-kbd'>Ctrl</kbd>
                    <kbd className='docs-kbd'>K</kbd>) anywhere to search and jump
                    straight to any tool.
                  </span>
                </div>
              </section>

              {/* Workspace */}
              <section id='workspace' className='docs-section'>
                <h2>🖥️ The Workspace</h2>
                <p>
                  The home screen is your <strong>Workspace</strong> — a desktop you
                  arrange yourself. Open widgets from the dock at the bottom, then
                  move and resize them however you like.
                </p>
                <h3>Working with widgets</h3>
                <ul>
                  <li><strong>Open:</strong> tap a widget in the dock, or press its number key (see shortcuts).</li>
                  <li><strong>Move:</strong> drag a window by its title bar.</li>
                  <li><strong>Resize:</strong> drag the grip in the bottom-right corner.</li>
                  <li><strong>Minimise / maximise / close:</strong> use the <kbd className='docs-kbd'>–</kbd> <kbd className='docs-kbd'>▢</kbd> <kbd className='docs-kbd'>×</kbd> buttons on the title bar.</li>
                </ul>
                <p>
                  Available widgets include Clock, To-Do, Notes, Calculator,
                  Weather, Budget, Calendar and Color Picker. On phones each widget
                  opens full-screen so it stays comfortable to use.
                </p>
                <div className='docs-callout'>
                  <span>💾</span>
                  <span>Your layout is saved automatically — to your account if you're signed in, otherwise to this device.</span>
                </div>
              </section>

              {/* Tools */}
              <section id='tools' className='docs-section'>
                <h2>🧰 Tools</h2>
                <p>
                  Every tool also has its own full page. Browse them all on the{' '}
                  <Link className={tone} style={{ textDecoration: 'underline' }} to='/apps'>Apps</Link>{' '}
                  screen, or open one directly below.
                </p>
                <div className='docs-tools-grid'>
                  {TOOLS.map((t) => (
                    <Link key={t.path} className='docs-tool' to={t.path}>
                      <span className='docs-tool__icon' aria-hidden='true'>{t.icon}</span>
                      <span>
                        <span className='docs-tool__name'>{t.name}</span><br />
                        <span className='docs-tool__desc'>{t.desc}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Shortcuts */}
              <section id='shortcuts' className='docs-section'>
                <h2>⌨️ Keyboard Shortcuts</h2>
                <p>
                  DeskDazzle is built to be driven from the keyboard. Press{' '}
                  <kbd className='docs-kbd'>Shift</kbd> <kbd className='docs-kbd'>?</kbd>{' '}
                  anywhere to pull up this same reference as an overlay.
                </p>
                <div className='docs-shortcuts'>
                  {SHORTCUT_GROUPS.map((group) => (
                    <div className='docs-shortcuts__group' key={group.title}>
                      <h3>{group.title}</h3>
                      {group.items.map((item, i) => (
                        <div className='docs-shortcut' key={i}>
                          <span className='docs-shortcut__desc'>{item.desc}</span>
                          <ShortcutKeys keys={item.keys} alt={item.alt} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>

              {/* Accounts */}
              <section id='accounts' className='docs-section'>
                <h2>👤 Accounts & Sync</h2>
                <p>
                  Sign in with Google from the header (the <kbd className='docs-kbd'>🔑</kbd>
                  {' '}button, or the menu on mobile). Signing in is optional — every
                  tool works while signed out.
                </p>
                <ul>
                  <li><strong>Signed out:</strong> your theme, to-dos and workspace layout are stored locally in this browser.</li>
                  <li><strong>Signed in:</strong> the same data syncs to your account and follows you to any device, in real time.</li>
                </ul>
                <p>
                  Manage your session anytime from your{' '}
                  <Link className={tone} style={{ textDecoration: 'underline' }} to='/profile'>Profile</Link>.
                </p>
              </section>

              {/* Install */}
              <section id='install' className='docs-section'>
                <h2>⚙️ Install the App</h2>
                <p>
                  DeskDazzle is a Progressive Web App (PWA), so you can install it
                  to your home screen or dock for a full-screen, app-like experience
                  that works offline.
                </p>
                <div className='docs-platforms'>
                  <div className='docs-platform'>
                    <h3>📱 Android & Desktop</h3>
                    <ol>
                      <li>Open DeskDazzle in Chrome or Edge.</li>
                      <li>Open the browser menu (⋮).</li>
                      <li>Choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li>
                      <li>Confirm — it now launches like a native app.</li>
                    </ol>
                  </div>
                  <div className='docs-platform'>
                    <h3>🍎 iPhone & iPad</h3>
                    <ol>
                      <li>Open DeskDazzle in Safari.</li>
                      <li>Tap the <strong>Share</strong> button.</li>
                      <li>Choose <strong>Add to Home Screen</strong>.</li>
                      <li>Tap <strong>Add</strong> to finish.</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* Themes */}
              <section id='themes' className='docs-section'>
                <h2>🌓 Themes</h2>
                <p>
                  DeskDazzle ships with a clean light theme and an easy-on-the-eyes
                  dark theme. Toggle between them in three ways:
                </p>
                <ul>
                  <li>Click the <kbd className='docs-kbd'>☀️</kbd> / <kbd className='docs-kbd'>🌙</kbd> switch in the header.</li>
                  <li>Press <kbd className='docs-kbd'>T</kbd> anywhere.</li>
                  <li>Use the theme toggle in the mobile menu.</li>
                </ul>
                <p>Your choice is remembered and syncs with your account when signed in.</p>
              </section>

              {/* FAQ */}
              <section id='faq' className='docs-section'>
                <h2>❓ FAQ</h2>
                <h3>Is DeskDazzle free?</h3>
                <p>
                  Yes, completely. If you'd like to support development you can{' '}
                  <Link className={tone} style={{ textDecoration: 'underline' }} to='/donate'>donate</Link> — entirely optional.
                </p>
                <h3>Does it work offline?</h3>
                <p>
                  Once installed as a PWA the app shell and most tools work offline.
                  Tools that fetch live data (such as Weather or Translation) need a
                  connection.
                </p>
                <h3>Where is my data stored?</h3>
                <p>
                  Locally in your browser when signed out, and in your private
                  account storage when signed in. See <a className={tone} style={{ textDecoration: 'underline' }} href='#accounts'>Accounts & Sync</a>.
                </p>
                <h3>I found a bug or have an idea.</h3>
                <p>
                  Great — reach out via the links in the footer. Feedback is always welcome.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Docs
