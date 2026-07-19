import React, { useContext, useEffect, useRef, useState } from 'react';
import { ThemeContext } from '../App';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// A curated palette so every workspace can have a distinct icon without pulling
// in a full emoji-picker dependency.
const EMOJIS = [
  '🖥️', '🗂️', '💼', '🏠', '📚', '💻',
  '🎨', '💰', '❤️', '✈️', '🎵', '🎮',
  '⭐', '🚀', '🔥', '📖', '🎯', '📅',
  '☕', '🎁', '📁', '🧪', '🌱', '🧠',
];

function EmojiPicker({ value, onChange, title = 'Choose an icon', dropUp = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded text-lg hover:bg-accent"
      >
        {value || '🗂️'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={cn(
              // Fixed width so the 6 columns lay out correctly (an absolutely
              // positioned grid has no intrinsic width to divide into columns).
              'absolute left-0 z-20 grid w-48 grid-cols-6 gap-0.5 rounded-md border bg-popover p-1.5 shadow-md',
              dropUp ? 'bottom-9' : 'top-9',
            )}
          >
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => { onChange(em); setOpen(false); }}
                className={cn(
                  'flex size-7 items-center justify-center rounded text-lg hover:bg-accent',
                  em === value && 'bg-accent ring-1 ring-primary',
                )}
              >
                {em}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Create / rename / delete / switch workspaces ("Spaces"). Each workspace fully
// isolates the desktop layout, theme, and every app's data — only the profile
// is shared.
function WorkspaceManager({ open, onOpenChange, focusCreate = false }) {
  const {
    workspaces = [],
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useContext(ThemeContext);

  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('🗂️');
  const nameRef = useRef(null);

  // When opened via "New workspace", focus the create field straight away.
  useEffect(() => {
    if (open && focusCreate) {
      const t = setTimeout(() => nameRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, focusCreate]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createWorkspace(name, newEmoji);
    setNewName('');
    setNewEmoji('🗂️');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workspaces</DialogTitle>
          <DialogDescription>
            Each workspace keeps its own desktop layout, theme, and app data — like
            separate desks. Press <kbd className="rounded border bg-muted px-1 font-mono text-xs">W</kbd> to
            cycle between them. Your profile stays shared.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            const isDefault = ws.id === 'default';
            return (
              <div
                key={ws.id}
                className={cn(
                  'flex items-center gap-1 rounded-md border px-2 py-1.5',
                  isActive && 'border-primary bg-accent/40',
                )}
              >
                <EmojiPicker
                  value={ws.emoji}
                  onChange={(em) => renameWorkspace(ws.id, undefined, em)}
                />
                <Input
                  value={ws.name}
                  onChange={(e) => renameWorkspace(ws.id, e.target.value)}
                  onBlur={(e) => renameWorkspace(ws.id, e.target.value.trim() || 'Untitled')}
                  className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  aria-label="Workspace name"
                />
                <Button
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => switchWorkspace(ws.id)}
                  disabled={isActive}
                  title={isActive ? 'Current workspace' : 'Switch to this workspace'}
                >
                  {isActive ? <Check className="size-4 text-primary" /> : 'Switch'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                  disabled={isDefault}
                  title={isDefault ? 'The default workspace cannot be deleted' : 'Delete workspace'}
                  onClick={() => {
                    if (window.confirm(`Delete "${ws.name}" and all its data? This cannot be undone.`)) {
                      deleteWorkspace(ws.id);
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 border-t pt-3">
          <EmojiPicker value={newEmoji} onChange={setNewEmoji} title="Icon for the new workspace" dropUp />
          <Input
            ref={nameRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="New workspace name…"
            className="h-9 flex-1"
          />
          <Button onClick={handleCreate} disabled={!newName.trim()} className="gap-1.5">
            <Plus /> Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WorkspaceManager;
