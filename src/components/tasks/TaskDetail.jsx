import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dateInputToMs, msToDateInput } from './model';

const NO_PROJECT = '__none';

// Edit dialog for one task: title, project, due, priority, and its subtasks
// (child todos with parentId = this task's id). Changes apply immediately.
function TaskDetail({
  item,
  subtasks,
  projects,
  onClose,
  onUpdate,
  onToggle,
  onAddSubtask,
  onDelete,
}) {
  const [subInput, setSubInput] = useState('');
  if (!item) return null;
  const { todo, id } = item;

  const addSub = () => {
    const text = subInput.trim();
    if (!text) return;
    onAddSubtask(id, text);
    setSubInput('');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
          <DialogDescription>Changes save instantly.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={todo.text || ''}
              onChange={(e) => onUpdate(id, { text: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Project</Label>
              <Select
                value={item.projectId || NO_PROJECT}
                onValueChange={(v) => onUpdate(id, { projectId: v === NO_PROJECT ? null : v })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>No project</SelectItem>
                  {(projects || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select
                value={todo.priority || 'none'}
                onValueChange={(v) => onUpdate(id, { priority: v })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <div className="flex gap-2">
              <Input
                id="task-due"
                type="date"
                value={msToDateInput(todo.due)}
                onChange={(e) => onUpdate(id, { due: dateInputToMs(e.target.value) })}
              />
              {typeof todo.due === 'number' && (
                <Button variant="ghost" size="sm" onClick={() => onUpdate(id, { due: null })}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-1.5">
            <Label>
              Subtasks
              {subtasks.length > 0 && (
                <span className="ml-1 font-normal text-muted-foreground">
                  ({subtasks.filter((s) => s.todo.isDone).length}/{subtasks.length})
                </span>
              )}
            </Label>
            <div className="flex flex-col gap-0.5">
              {subtasks.map((s) => (
                <div key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
                  <Checkbox
                    checked={!!s.todo.isDone}
                    onCheckedChange={(v) => onToggle(s.id, v === true)}
                    aria-label="Toggle subtask"
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm',
                      s.todo.isDone && 'text-muted-foreground line-through',
                    )}
                  >
                    {s.todo.text || '(untitled)'}
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() => onDelete(s.id)}
                    aria-label="Delete subtask"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-1 py-1">
                <Plus className="size-4 text-muted-foreground" />
                <Input
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addSub(); }
                  }}
                  placeholder="Add subtask…"
                  className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  aria-label="New subtask"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="destructive" onClick={() => onDelete(id)}>
            <Trash2 className="size-4" /> Delete task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TaskDetail;
