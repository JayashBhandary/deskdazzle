import React, { useEffect, useRef, useState } from 'react'
import { updateUserProfile } from '../auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Modal for editing the display name + avatar URL. Email is sourced from the
// Google account and isn't editable here, so it's shown read-only.
function EditProfileDialog({ open, onClose, user, profile }) {
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

  // Covers Escape, the built-in close button and backdrop clicks — all of
  // which are ignored while a save is in flight.
  const handleOpenChange = (next) => {
    if (!next && !saving) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription className='sr-only'>
            Update your display name and avatar photo.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-2'>
          <img
            className='size-20 rounded-full border object-cover'
            alt='avatar preview'
            referrerPolicy='no-referrer'
            src={photoURL.trim() || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"/>'}
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            onLoad={(e) => { e.currentTarget.style.visibility = 'visible'; }}
          />
          <span className='text-xs text-muted-foreground'>Avatar preview</span>
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='editp-name'>Display name</Label>
          <Input
            id='editp-name'
            ref={nameRef}
            type='text'
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder='Your name'
          />
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='editp-photo'>Photo URL</Label>
          <Input
            id='editp-photo'
            type='url'
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder='https://…'
          />
          {user?.photoURL && photoURL.trim() !== user.photoURL && (
            <Button
              type='button'
              variant='link'
              className='h-auto w-fit p-0 text-xs'
              onClick={() => setPhotoURL(user.photoURL)}
            >
              Use my Google photo
            </Button>
          )}
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='editp-email'>Email</Label>
          <Input id='editp-email' type='text' value={user?.email || ''} readOnly disabled />
        </div>

        {error && <p className='text-sm text-destructive'>{error}</p>}

        <DialogFooter>
          <Button variant='ghost' onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditProfileDialog
