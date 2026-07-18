import React, { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PROJECT_COLORS } from './model';

// Chip strip above the tabs: "All" + one chip per project + new-project flow.
function ProjectBar({ projects, selected, onSelect, onCreate, onRename, onDelete }) {
  // dialog: null | { id: string|null (null = create), name, color }
  const [dialog, setDialog] = useState(null);

  const submit = () => {
    const name = (dialog?.name || '').trim();
    if (!name) return;
    if (dialog.id) onRename(dialog.id, name);
    else onCreate(name, dialog.color || PROJECT_COLORS[0]);
    setDialog(null);
  };

  const chip = (active) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
      active ? 'border-primary bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
    );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button type="button" className={chip(selected === 'all')} onClick={() => onSelect('all')}>
        All
      </button>

      {(projects || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((p) => (
          <span key={p.id} className={cn(chip(selected === p.id), 'pr-1.5')}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5"
              onClick={() => onSelect(p.id)}
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 text-muted-foreground/60 hover:text-foreground"
                  aria-label={`Project ${p.name} options`}
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => setDialog({ id: p.id, name: p.name, color: p.color })}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(p.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-8 rounded-full text-muted-foreground"
        onClick={() => setDialog({ id: null, name: '', color: PROJECT_COLORS[0] })}
      >
        <Plus className="size-4" /> New project
      </Button>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? 'Rename project' : 'New project'}</DialogTitle>
            <DialogDescription>
              {dialog?.id
                ? 'Give this project a new name.'
                : 'Group tasks under a colored project.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                autoFocus
                value={dialog?.name || ''}
                onChange={(e) => setDialog((d) => ({ ...d, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder="e.g. Work"
              />
            </div>
            {!dialog?.id && (
              <div className="grid gap-1.5">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      className={cn(
                        'size-6 rounded-full border transition-transform',
                        dialog?.color === c && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setDialog((d) => ({ ...d, color: c }))}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={submit} disabled={!(dialog?.name || '').trim()}>
              {dialog?.id ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProjectBar;
