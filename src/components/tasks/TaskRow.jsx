import React from 'react';
import { CalendarClock, Repeat, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { dueLabel, PRIORITY_STYLE, recurrenceLabel } from './model';

// One top-level row in the List tab. `item` is a normalized todo
// ({id, todo, status, order, projectId, parentId}); subtasks never render
// here — they live in the detail dialog and surface as the "n/m" badge.
function TaskRow({ item, project, subCount, onToggle, onDelete, onOpen }) {
  const { todo } = item;
  return (
    <div className="group flex items-center gap-3 rounded-md border bg-card px-3 py-2">
      <Checkbox
        checked={!!todo.isDone}
        onCheckedChange={(v) => onToggle(item.id, v === true)}
        aria-label={`Mark “${todo.text}” ${todo.isDone ? 'not done' : 'done'}`}
      />
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className={cn(
          'min-w-0 flex-1 truncate text-left',
          todo.isDone && 'text-muted-foreground line-through',
        )}
      >
        {todo.text || '(untitled)'}
      </button>
      {subCount && subCount.total > 0 && (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {subCount.done}/{subCount.total}
        </Badge>
      )}
      {project && (
        <Badge variant="outline" className="gap-1.5 font-normal">
          <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
          {project.name}
        </Badge>
      )}
      {typeof todo.due === 'number' && (
        <Badge variant="outline" className="gap-1 font-normal">
          <CalendarClock className="size-3" /> {dueLabel(todo.due)}
        </Badge>
      )}
      {todo.recurrence && (
        <Badge variant="outline" className="gap-1 font-normal">
          <Repeat className="size-3" /> {recurrenceLabel(todo.recurrence)}
        </Badge>
      )}
      {todo.priority && todo.priority !== 'none' && (
        <Badge variant="outline" className={cn('font-normal', PRIORITY_STYLE[todo.priority])}>
          {todo.priority}
        </Badge>
      )}
      {(todo.tags || []).map((t) => (
        <Badge key={t} variant="secondary" className="hidden font-normal sm:inline-flex">#{t}</Badge>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => onDelete(item.id)}
        aria-label="Delete todo"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export default TaskRow;
