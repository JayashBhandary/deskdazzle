import React, { useRef } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarClock, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { BOARD_COLUMNS, dueLabel, PRIORITY_STYLE } from './model';

// Kanban: three status lanes (To do / In progress / Done). Dragging between
// lanes sets `status` (and isDone for the Done lane); dragging within a lane
// rewrites `order`. The parent owns the actual todo mutations via onMove.

function BoardCard({ item, project, subCount, onOpen, onToggle, draggingRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const { todo } = item;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'cursor-grab touch-none rounded-lg border bg-card p-2.5 shadow-xs active:cursor-grabbing',
        isDragging && 'opacity-50 ring-2 ring-ring',
      )}
      onClick={() => { if (!draggingRef.current) onOpen(item.id); }}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <span onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <Checkbox
            checked={!!todo.isDone}
            onCheckedChange={(v) => onToggle(item.id, v === true)}
            aria-label={`Mark “${todo.text}” ${todo.isDone ? 'not done' : 'done'}`}
          />
        </span>
        <span className={cn('min-w-0 flex-1 text-sm', todo.isDone && 'text-muted-foreground line-through')}>
          {todo.text || '(untitled)'}
        </span>
      </div>
      {(project || typeof todo.due === 'number' || todo.recurrence
        || (todo.priority && todo.priority !== 'none') || (subCount && subCount.total > 0)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {project && (
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name}
            </Badge>
          )}
          {subCount && subCount.total > 0 && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {subCount.done}/{subCount.total}
            </Badge>
          )}
          {typeof todo.due === 'number' && (
            <Badge variant="outline" className="gap-1 font-normal">
              <CalendarClock className="size-3" /> {dueLabel(todo.due)}
            </Badge>
          )}
          {todo.recurrence && <Repeat className="size-3.5 text-muted-foreground" />}
          {todo.priority && todo.priority !== 'none' && (
            <Badge variant="outline" className={cn('font-normal', PRIORITY_STYLE[todo.priority])}>
              {todo.priority}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function Column({ col, items, projectsById, subCountOf, onOpen, onToggle, draggingRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${col.key}` });
  return (
    <div className="flex min-w-64 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1 text-sm font-medium">
        <span className={cn('size-2 rounded-full', col.dot)} />
        {col.label}
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-32 flex-1 flex-col gap-1.5 rounded-lg p-1.5 transition-colors',
          isOver ? 'bg-accent' : 'bg-muted/40',
        )}
      >
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <BoardCard
              key={it.id}
              item={it}
              project={it.projectId ? projectsById.get(it.projectId) : null}
              subCount={subCountOf(it.id)}
              onOpen={onOpen}
              onToggle={onToggle}
              draggingRef={draggingRef}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function BoardView({ items, projectsById, subCountOf, onOpen, onToggle, onMove }) {
  // Small activation distance so plain clicks still open the detail dialog.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  // Suppresses the click that browsers fire right after a completed drag.
  const draggingRef = useRef(false);

  const byCol = (key) =>
    items
      .filter((it) => it.status === key)
      .sort((a, b) => (a.order - b.order) || (a.index - b.index));

  const onDragEnd = (e) => {
    setTimeout(() => { draggingRef.current = false; }, 0);
    const { active, over } = e;
    if (!over) return;
    const activeItem = items.find((it) => it.id === String(active.id));
    if (!activeItem) return;

    // Destination = a column droppable or a card inside one.
    const overId = String(over.id);
    let destKey;
    let overItemId = null;
    if (overId.startsWith('col-')) {
      destKey = overId.slice(4);
    } else {
      const overItem = items.find((it) => it.id === overId);
      if (!overItem) return;
      destKey = overItem.status;
      if (overItem.id !== activeItem.id) overItemId = overItem.id;
    }

    const dest = byCol(destKey).filter((it) => it.id !== activeItem.id);
    const insertAt = overItemId ? dest.findIndex((it) => it.id === overItemId) : dest.length;
    dest.splice(insertAt < 0 ? dest.length : insertAt, 0, activeItem);

    onMove(activeItem.id, destKey, dest.map((it) => it.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={() => { draggingRef.current = true; }}
      onDragCancel={() => { draggingRef.current = false; }}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((col) => (
          <Column
            key={col.key}
            col={col}
            items={byCol(col.key)}
            projectsById={projectsById}
            subCountOf={subCountOf}
            onOpen={onOpen}
            onToggle={onToggle}
            draggingRef={draggingRef}
          />
        ))}
      </div>
    </DndContext>
  );
}

export default BoardView;
