import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Shares the same notes store as the full NoteTaking tool.
function NotesWidget() {
  const [notes, setNotes] = useStore('notes', []);
  const [body, setBody] = useState('');

  const add = () => {
    if (!body.trim()) return;
    const title = body.trim().split('\n')[0].slice(0, 40);
    setNotes([{ id: Date.now(), title, body }, ...notes]);
    setBody('');
  };

  const remove = (id) => setNotes(notes.filter((n) => n.id !== id));

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex gap-1.5">
        <Textarea
          className="min-h-0 min-w-0 flex-1 resize-none"
          rows={2}
          value={body}
          placeholder="Quick note..."
          onChange={(e) => setBody(e.target.value)}
        />
        <Button size="icon" className="size-8 shrink-0 self-start" onClick={add} aria-label="Add note">
          <Plus />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {notes.length === 0
          ? <p className="m-auto text-center text-sm text-muted-foreground">No notes yet. ✍️</p>
          : notes.map((note) => (
            <div key={note.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-sm">
              <p className="min-w-0 truncate">{note.title || 'Untitled'}</p>
              <button
                type="button"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                title="Delete note"
                aria-label="Delete note"
                onClick={() => remove(note.id)}
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

export default NotesWidget
