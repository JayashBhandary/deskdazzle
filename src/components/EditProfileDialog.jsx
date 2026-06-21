import React, { useContext, useEffect, useRef, useState } from 'react'
import { ThemeContext } from '../App';
import { updateUserProfile } from '../auth';

// Modal for editing the display name + avatar URL. Email is sourced from the
// Google account and isn't editable here, so it's shown read-only.
function EditProfileDialog({ open, onClose, user, profile }) {
  const { theme } = useContext(ThemeContext);
  const tone = theme ? 'dark' : 'light';

  const currentName = profile?.displayName ?? user?.displayName ?? '';
  const currentPhoto = profile?.photoURL ?? user?.photoURL ?? '';

  const [name, setName] = useState(currentName);
  const [photoURL, setPhotoURL] = useState(currentPhoto);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  // Reset the form to the latest values each time the dialog opens.
  useEffect(() => {
    if (open) {
      setName(currentName);
      setPhotoURL(currentPhoto);
      setError('');
      setSaving(false);
      const id = setTimeout(() => nameRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const dirty = name.trim() !== currentName || photoURL.trim() !== currentPhoto;

  const save = async () => {
    if (!name.trim()) { setError('Display name cannot be empty.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateUserProfile({ displayName: name, photoURL });
      onClose();
    } catch (err) {
      setError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className='editp-backdrop' onMouseDown={() => !saving && onClose()}>
      <div
        className={`editp ${tone}`}
        role='dialog'
        aria-label='Edit profile'
        aria-modal='true'
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className='editp__head'>
          <h3>Edit profile</h3>
          <button className='help__close' onClick={onClose} disabled={saving} aria-label='Close'>×</button>
        </div>

        <div className='editp__preview'>
          <img
            className='editp__avatar'
            alt='avatar preview'
            referrerPolicy='no-referrer'
            src={photoURL.trim() || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"/>'}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }}
          />
          <span className='editp__preview-label'>Avatar preview</span>
        </div>

        <label className='editp__field'>
          <span>Display name</span>
          <input
            ref={nameRef}
            className={`editp__input ${tone}`}
            type='text'
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder='Your name'
          />
        </label>

        <label className='editp__field'>
          <span>Photo URL</span>
          <input
            className={`editp__input ${tone}`}
            type='url'
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder='https://…'
          />
          {user?.photoURL && photoURL.trim() !== user.photoURL && (
            <button type='button' className='editp__reset' onClick={() => setPhotoURL(user.photoURL)}>
              Use my Google photo
            </button>
          )}
        </label>

        <label className='editp__field'>
          <span>Email</span>
          <input className={`editp__input ${tone}`} type='text' value={user?.email || ''} readOnly disabled />
        </label>

        {error && <p className='editp__error'>{error}</p>}

        <div className='editp__actions'>
          <button className={`editp__btn editp__btn--ghost ${tone}`} onClick={onClose} disabled={saving}>Cancel</button>
          <button className='editp__btn editp__btn--save' onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditProfileDialog
