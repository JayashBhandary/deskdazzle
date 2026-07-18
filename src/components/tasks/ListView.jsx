import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { core } from '@/lib/wasm';
import { toTask } from './model';
import TaskRow from './TaskRow';

const SECTIONS = [
  { key: 'overdue', label: 'Overdue', tone: 'text-destructive' },
  { key: 'today', label: 'Today', tone: '' },
  { key: 'upcoming', label: 'Upcoming', tone: '' },
  { key: 'someday', label: 'Someday', tone: 'text-muted-foreground' },
];

// Smart-view list (Overdue/Today/Upcoming/Someday via the wasm core) plus a
// Completed section. `items` are top-level normalized todos, already filtered
// by the selected project.
function ListView({ items, projectsById, subCountOf, onToggle, onDelete, onOpen }) {
  const [views, setViews] = useState(null);

  const openItems = useMemo(() => items.filter((it) => !it.todo.isDone), [items]);
  const doneItems = useMemo(() => items.filter((it) => !!it.todo.isDone), [items]);
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Smart bucketing runs in the Rust core; falls back to a flat list.
  useEffect(() => {
    let cancelled = false;
    core.smartViews(openItems.map((it) => toTask(it.todo, it)))
      .then((v) => { if (!cancelled) setViews(v); })
      .catch(() => { if (!cancelled) setViews(null); });
    return () => { cancelled = true; };
  }, [openItems]);

  const renderRow = (item) => (
    <TaskRow
      key={item.id}
      item={item}
      project={item.projectId ? projectsById.get(item.projectId) : null}
      subCount={subCountOf(item.id)}
      onToggle={onToggle}
      onDelete={onDelete}
      onOpen={onOpen}
    />
  );

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Feels so empty here. 🧐
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!views && openItems.length > 0 && (
        // wasm still loading (or unavailable) → flat list fallback.
        <div className="space-y-2">{openItems.map(renderRow)}</div>
      )}
      {views && SECTIONS.map(({ key, label, tone }) => {
        const bucket = (views[key] || [])
          .map((t) => byId.get(t.id))
          .filter(Boolean);
        if (bucket.length === 0) return null;
        return (
          <section key={key}>
            <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${tone || 'text-foreground'}`}>
              {label} <span className="font-normal text-muted-foreground">({bucket.length})</span>
            </h2>
            <div className="space-y-2">{bucket.map(renderRow)}</div>
          </section>
        );
      })}
      {doneItems.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Completed <span className="font-normal">({doneItems.length})</span>
          </h2>
          <div className="space-y-2">{doneItems.map(renderRow)}</div>
        </section>
      )}
    </div>
  );
}

export default ListView;
