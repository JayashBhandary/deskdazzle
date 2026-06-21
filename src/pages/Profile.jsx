import React, { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom';
import { ThemeContext } from '../App';
import { signInWithGoogle, signOutUser } from '../auth';
import EditProfileDialog from '../components/EditProfileDialog';

// Formats a date string/number into a friendly absolute date, or null.
function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Profile() {
  // Everything here is read straight from the shared in-memory store — no
  // Firebase reads are issued when this page mounts.
  const { isLoggedIn, user, theme, setTheme, todos, desktop, profile } = useContext(ThemeContext);
  const tone = theme ? 'dark' : 'light';
  const [editing, setEditing] = useState(false);

  // Prefer the live RTDB profile mirror so an edit reflects instantly via the
  // shared listener; fall back to the Auth object.
  const displayName = profile?.displayName || user?.displayName || 'DeskDazzle user';
  const photoURL = profile?.photoURL || user?.photoURL;

  const stats = useMemo(() => {
    const list = Array.isArray(todos) ? todos : [];
    const total = list.length;
    const done = list.filter((t) => t && t.isDone).length;
    return {
      total,
      done,
      open: total - done,
      completion: total ? Math.round((done / total) * 100) : 0,
      widgets: Array.isArray(desktop) ? desktop.length : 0,
    };
  }, [todos, desktop]);

  if (!isLoggedIn) {
    return (
      <div className='page'>
        <div className='page__content'>
          <label className='docs__title'>👤 Profile</label>
          <div className='content'>
            <div className={`profile-signin ${tone}`}>
              <div className='profile-signin__icon'>🔑</div>
              <h2>You're browsing as a guest</h2>
              <p>
                Sign in to sync your tasks, workspace layout and theme across every
                device. Everything you do now is still saved — just locally to this
                browser until you do.
              </p>
              <button className={`profile-signin__btn`} onClick={signInWithGoogle}>
                Sign in with Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const memberSince = fmtDate(user?.metadata?.creationTime);
  const lastSignIn = fmtDate(user?.metadata?.lastSignInTime) || fmtDate(profile?.lastLogin);

  return (
    <div className='page'>
      <div className='page__content'>
        <label className='docs__title'>👤 Profile</label>

        <div className='content' style={{ marginTop: 8 }}>
          <div className='profile'>
            {/* Hero */}
            <section className={`profile-hero ${tone}`}>
              <img className='profile-hero__avatar' alt='profile' src={photoURL} referrerPolicy='no-referrer' />
              <div className='profile-hero__id'>
                <h1 className='profile-hero__name'>{displayName}</h1>
                <p className='profile-hero__email'>{user?.email}</p>
                <div className='profile-hero__badges'>
                  <span className='badge'>🔓 Google account</span>
                  <span className='badge badge--ok'>☁️ Synced</span>
                  {memberSince && <span className='badge'>📆 Member since {memberSince}</span>}
                </div>
              </div>
              <button className={`profile-hero__edit ${tone}`} onClick={() => setEditing(true)}>✏️ Edit</button>
            </section>

            {/* Stats */}
            <section className='profile-stats'>
              <div className={`stat ${tone}`}>
                <span className='stat__value'>{stats.total}</span>
                <span className='stat__label'>Total tasks</span>
              </div>
              <div className={`stat ${tone}`}>
                <span className='stat__value'>{stats.done}</span>
                <span className='stat__label'>Completed</span>
              </div>
              <div className={`stat ${tone}`}>
                <span className='stat__value'>{stats.open}</span>
                <span className='stat__label'>Still open</span>
              </div>
              <div className={`stat ${tone}`}>
                <span className='stat__value'>{stats.widgets}</span>
                <span className='stat__label'>Workspace widgets</span>
              </div>
            </section>

            {/* Task progress */}
            <section className={`profile-card ${tone}`}>
              <div className='profile-card__head'>
                <h3>Task progress</h3>
                <span className='profile-card__pct'>{stats.completion}%</span>
              </div>
              <div className='profile-bar'>
                <div className='profile-bar__fill' style={{ width: `${stats.completion}%` }} />
              </div>
              <p className='profile-card__hint'>
                {stats.total === 0
                  ? 'No tasks yet — '
                  : `${stats.done} of ${stats.total} done — `}
                <Link className={tone} style={{ textDecoration: 'underline' }} to='/to-do-list'>open your to-do list</Link>.
              </p>
            </section>

            {/* Preferences */}
            <section className={`profile-card ${tone}`}>
              <h3>Preferences</h3>
              <div className='profile-pref'>
                <div>
                  <strong>Appearance</strong>
                  <p className='profile-card__hint'>Switch between light and dark. Synced to your account.</p>
                </div>
                <button
                  className={`profile-toggle ${tone}`}
                  onClick={() => setTheme(theme === false ? true : false)}
                  aria-pressed={theme}
                >
                  {theme ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
              {lastSignIn && (
                <p className='profile-card__hint' style={{ marginTop: 14 }}>
                  Last sign-in: <strong>{lastSignIn}</strong>
                </p>
              )}
            </section>

            {/* Quick links */}
            <section className='profile-links'>
              <Link className={`profile-link ${tone}`} to='/'><span>🖥️</span> Workspace</Link>
              <Link className={`profile-link ${tone}`} to='/apps'><span>📱</span> All tools</Link>
              <Link className={`profile-link ${tone}`} to='/docs'><span>🔧</span> Docs</Link>
            </section>

            {/* Account actions */}
            <section className='profile-actions'>
              <button className='profile-signout' onClick={signOutUser}>Sign out</button>
            </section>
          </div>
        </div>
      </div>

      <EditProfileDialog open={editing} onClose={() => setEditing(false)} user={user} profile={profile} />
    </div>
  )
}

export default Profile
