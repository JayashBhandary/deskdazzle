import React, { useContext, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom';
import { Download, LayoutGrid, LogOut, Monitor, Moon, Pencil, Sun, Upload, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeContext } from '../App';
import { signInWithGoogle, signOutUser } from '../auth';
import EditProfileDialog from '../components/EditProfileDialog';
import ToolPage from '../components/ToolPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadWorkspace, importWorkspace } from '@/lib/backup';

// Formats a date string/number into a friendly absolute date, or null.
function fmtDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const offlineToast = () =>
  toast.error("You appear to be offline — reconnect to the internet and try again.");

// Export/import of the whole local workspace as a single JSON file. Backups
// are purely local, so this works signed-in and as a guest alike. `compact`
// renders the smaller guest-view variant.
function WorkspaceBackupCard({ uid = null, compact = false }) {
  const fileRef = useRef(null);
  // Parsed backup awaiting the user's confirmation (null = no dialog).
  const [pending, setPending] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    downloadWorkspace();
    toast.success('Workspace backup downloaded');
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    try {
      setPending(JSON.parse(await file.text()));
    } catch {
      toast.error('That file is not valid JSON.');
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      await importWorkspace(pending, uid);
      toast.success('Workspace imported — reloading…');
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed. Please try again.');
      setPending(null);
      setImporting(false);
    }
  };

  return (
    <>
      <Card className={compact ? 'py-4' : undefined}>
        <CardContent className={compact ? 'space-y-3 px-4' : 'space-y-3'}>
          <h3 className={`font-semibold tracking-tight ${compact ? 'text-sm' : ''}`}>Workspace backup</h3>
          <p className='text-sm text-muted-foreground'>
            Download everything stored on this device as a single JSON file, or
            restore a previous backup. No account needed — backups are local.
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size={compact ? 'sm' : 'default'} onClick={handleExport}>
              <Download /> Export
            </Button>
            <Button variant='outline' size={compact ? 'sm' : 'default'} onClick={() => fileRef.current?.click()}>
              <Upload /> Import
            </Button>
            <input
              ref={fileRef}
              type='file'
              accept='.json,application/json'
              className='hidden'
              onChange={handleFile}
              aria-label='Choose a Desk Dazzle backup file'
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !importing && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import this backup?</DialogTitle>
            <DialogDescription>
              This replaces your current workspace on this device. The page will
              reload once the import finishes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPending(null)} disabled={importing}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={confirmImport} disabled={importing}>
              <Upload /> Replace and import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Profile() {
  // Everything here is read straight from the shared in-memory store — no
  // Firebase reads are issued when this page mounts.
  const { isLoggedIn, user, theme, setTheme, todos, desktop, profile } = useContext(ThemeContext);
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

  const handleSignIn = async () => {
    // signInWithGoogle catches its own errors and returns null on failure.
    const signedIn = await signInWithGoogle();
    if (!signedIn && !navigator.onLine) offlineToast();
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      if (!navigator.onLine) offlineToast();
      else toast.error('Sign-out failed. Please try again.');
    }
  };

  if (!isLoggedIn) {
    return (
      <ToolPage icon='👤' title='Profile'>
        <Card>
          <CardContent className='flex flex-col items-center gap-4 py-12 text-center'>
            <span className='text-4xl' aria-hidden='true'>🔑</span>
            <h2 className='text-xl font-semibold tracking-tight'>You're browsing as a guest</h2>
            <p className='max-w-md text-sm text-muted-foreground'>
              Sign in to sync your tasks, workspace layout and theme across every
              device. Everything you do now is still saved — just locally to this
              browser until you do.
            </p>
            <Button onClick={handleSignIn}>Sign in with Google</Button>
          </CardContent>
        </Card>
        <div className='mt-4'>
          <WorkspaceBackupCard compact uid={user?.uid ?? null} />
        </div>
      </ToolPage>
    );
  }

  const memberSince = fmtDate(user?.metadata?.creationTime);
  const lastSignIn = fmtDate(user?.metadata?.lastSignInTime) || fmtDate(profile?.lastLogin);

  const STATS = [
    { value: stats.total, label: 'Total tasks' },
    { value: stats.done, label: 'Completed' },
    { value: stats.open, label: 'Still open' },
    { value: stats.widgets, label: 'Workspace widgets' },
  ];

  return (
    <ToolPage icon='👤' title='Profile'>
      <div className='space-y-4'>
        {/* Hero */}
        <Card>
          <CardContent className='flex flex-wrap items-center gap-4'>
            <img
              className='size-20 shrink-0 rounded-full border object-cover'
              alt='profile'
              src={photoURL}
              referrerPolicy='no-referrer'
            />
            <div className='min-w-0 flex-1'>
              <h2 className='truncate text-xl font-semibold tracking-tight'>{displayName}</h2>
              <p className='truncate text-sm text-muted-foreground'>{user?.email}</p>
              <div className='mt-2 flex flex-wrap gap-1.5'>
                <Badge variant='secondary'>🔓 Google account</Badge>
                <Badge variant='secondary'>☁️ Synced</Badge>
                {memberSince && <Badge variant='outline'>📆 Member since {memberSince}</Badge>}
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
          {STATS.map((s) => (
            <Card key={s.label} className='py-4'>
              <CardContent className='px-4 text-center'>
                <span className='block text-2xl font-semibold tabular-nums'>{s.value}</span>
                <span className='text-xs text-muted-foreground'>{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Task progress */}
        <Card>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between'>
              <h3 className='font-semibold tracking-tight'>Task progress</h3>
              <span className='text-sm font-medium tabular-nums text-muted-foreground'>{stats.completion}%</span>
            </div>
            <div className='h-2 w-full overflow-hidden rounded-full bg-muted' role='presentation'>
              <div className='h-full rounded-full bg-primary transition-all' style={{ width: `${stats.completion}%` }} />
            </div>
            <p className='text-sm text-muted-foreground'>
              {stats.total === 0
                ? 'No tasks yet — '
                : `${stats.done} of ${stats.total} done — `}
              <Link className='text-primary underline underline-offset-4' to='/to-do-list'>open your to-do list</Link>.
            </p>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardContent className='space-y-4'>
            <h3 className='font-semibold tracking-tight'>Preferences</h3>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <strong className='text-sm font-medium'>Appearance</strong>
                <p className='text-sm text-muted-foreground'>Switch between light and dark. Synced to your account.</p>
              </div>
              <Button
                variant='outline'
                onClick={() => setTheme(theme === false ? true : false)}
                aria-pressed={theme}
              >
                {theme ? <Moon /> : <Sun />} {theme ? 'Dark' : 'Light'}
              </Button>
            </div>
            {lastSignIn && (
              <p className='text-sm text-muted-foreground'>
                Last sign-in: <strong className='font-medium text-foreground'>{lastSignIn}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Workspace backup */}
        <WorkspaceBackupCard uid={user?.uid ?? null} />

        {/* Quick links */}
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' asChild>
            <Link to='/'><Monitor /> Workspace</Link>
          </Button>
          <Button variant='outline' asChild>
            <Link to='/apps'><LayoutGrid /> All tools</Link>
          </Button>
          <Button variant='outline' asChild>
            <Link to='/docs'><Wrench /> Docs</Link>
          </Button>
        </div>

        {/* Account actions */}
        <div>
          <Button variant='destructive' onClick={handleSignOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </div>

      <EditProfileDialog open={editing} onClose={() => setEditing(false)} user={user} profile={profile} />
    </ToolPage>
  )
}

export default Profile
