import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeContext } from '../../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { core } from '@/lib/wasm';
import { parseTask } from '@/lib/taskNlp';
import { trackContentCreated } from '@/lib/analytics';
import { dueLabel, genId, statusOf, toTask } from '@/components/tasks/model';
import ProjectBar from '@/components/tasks/ProjectBar';
import ListView from '@/components/tasks/ListView';
import BoardView from '@/components/tasks/BoardView';
import TaskDetail from '@/components/tasks/TaskDetail';

// The Tasks app — one component rendered by both the full page and the desktop
// widget. A `@container` root means the layout adapts to whatever width it's
// given: quick-add preview, project chips and the List/Board tabs on the page;
// in a narrow (~300px) widget those extras collapse away, leaving the smart
// single list the old TodoWidget showed. All todos/projects state lives in the
// Firebase-backed ThemeContext, so the same data drives both surfaces.
//
// Todos stay the legacy Desk Dazzle array; old bare {text, isDone} items —
// including ones the desktop widget appends at any time — keep working
// untouched. The Rust/WASM core still powers NL quick-add, smart views and
// recurrence.
function TodoApp() {
  const { todos, setTodos, projects, setProjects } = useContext(ThemeContext);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [detailId, setDetailId] = useState(null);

  // Normalized read-model over the raw todos (index-aligned). Every extended
  // field is defaulted because RTDB strips null/empty fields.
  const items = useMemo(() => {
    const list = (todos || []).map((t, i) => {
      const todo = t || {};
      return {
        todo,
        index: i,
        id: typeof todo.id === 'string' && todo.id ? todo.id : `__i${i}`,
        status: statusOf(todo),
        order: typeof todo.order === 'number' ? todo.order : i,
        projectId: todo.projectId || null,
        parentId: todo.parentId || null,
      };
    });
    // Orphaned subtasks (parent deleted elsewhere) surface as top-level.
    const ids = new Set(list.map((it) => it.id));
    for (const it of list) if (it.parentId && !ids.has(it.parentId)) it.parentId = null;
    return list;
  }, [todos]);

  const itemById = useMemo(() => new Map(items.map((it) => [it.id, it])), [items]);

  // Lazy migration: give legacy/widget-added todos a stable id. Only writes
  // when some item actually lacks one — no setTodos loops.
  useEffect(() => {
    const arr = todos || [];
    if (arr.length === 0) return;
    if (arr.every((t) => t && typeof t.id === 'string' && t.id)) return;
    setTodos(arr.map((t) => (t && typeof t.id === 'string' && t.id ? t : { ...(t || {}), id: genId() })));
  }, [todos, setTodos]);

  // Live parse preview of the quick-add line ("pay rent friday !high #bills").
  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    // Local-time NLP parse — synchronous, no wasm round-trip, so the preview
    // updates instantly as you type.
    setPreview(parseTask(text));
  }, [text]);

  const childrenByParent = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      if (!it.parentId) continue;
      if (!m.has(it.parentId)) m.set(it.parentId, []);
      m.get(it.parentId).push(it);
    }
    for (const kids of m.values()) kids.sort((a, b) => (a.order - b.order) || (a.index - b.index));
    return m;
  }, [items]);

  const subCountOf = (id) => {
    const kids = childrenByParent.get(id);
    if (!kids || kids.length === 0) return null;
    return { done: kids.filter((k) => k.todo.isDone).length, total: kids.length };
  };

  // Top-level tasks in the selected project. Subtasks never render as rows
  // or cards — they live inside the detail dialog.
  const visibleItems = useMemo(
    () => items.filter(
      (it) => !it.parentId && (selectedProject === 'all' || it.projectId === selectedProject),
    ),
    [items, selectedProject],
  );

  const projectsById = useMemo(
    () => new Map((projects || []).map((p) => [p.id, p])),
    [projects],
  );

  // ---- todo mutations (all keyed by normalized id, applied by index) ----

  const applyPatches = (patchById, extras = []) => {
    const next = (todos || []).map((t, i) => {
      const p = patchById.get(items[i]?.id);
      return p ? { ...t, ...p } : t;
    });
    setTodos(extras.length ? [...next, ...extras] : next);
  };

  // Completing a recurring todo spawns its next occurrence (date math in Rust).
  const rollRecurrence = async (item, completedPatch) => {
    const { todo } = item;
    if (!todo.recurrence || !todo.due) return [];
    try {
      const rolled = await core.nextOccurrence(toTask({ ...todo, ...completedPatch }, item));
      if (rolled?.due) {
        toast.info(`Recurring task rescheduled for ${dueLabel(rolled.due)}`);
        return [{
          ...todo,
          id: genId(),
          isDone: false,
          status: 'todo',
          due: rolled.due,
          completedMs: null,
          order: (todos || []).length,
        }];
      }
    } catch { /* wasm unavailable — just complete it */ }
    return [];
  };

  const toggleTodo = async (id, checked) => {
    const item = itemById.get(id);
    if (!item) return;
    const patch = {
      isDone: checked,
      status: checked ? 'done' : 'todo',
      completedMs: checked ? Date.now() : null,
    };
    const extras = checked ? await rollRecurrence(item, patch) : [];
    applyPatches(new Map([[id, patch]]), extras);
  };

  const updateTodo = (id, patch) => applyPatches(new Map([[id, patch]]));

  // Deleting a task takes its subtasks with it.
  const removeTodo = (id) => {
    const doomed = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const it of items) {
        if (it.parentId && doomed.has(it.parentId) && !doomed.has(it.id)) {
          doomed.add(it.id);
          grew = true;
        }
      }
    }
    setTodos((todos || []).filter((t, i) => !doomed.has(items[i].id)));
    if (doomed.has(detailId)) setDetailId(null);
  };

  const addSubtask = (parentId, subText) => {
    const parent = itemById.get(parentId);
    setTodos([...(todos || []), {
      text: subText,
      isDone: false,
      createdMs: Date.now(),
      id: genId(),
      parentId,
      status: 'todo',
      order: (todos || []).length,
      ...(parent?.projectId ? { projectId: parent.projectId } : {}),
    }]);
  };

  // Board drop: reorder the destination lane and re-status the moved card.
  // isDone stays authoritative — Done lane ⇔ isDone (+ recurrence roll-over).
  const moveCard = async (activeId, destStatus, orderedIds) => {
    const item = itemById.get(activeId);
    if (!item) return;
    const patches = new Map();
    orderedIds.forEach((oid, i) => patches.set(oid, { order: i }));
    const nowDone = destStatus === 'done';
    const wasDone = !!item.todo.isDone;
    const patch = {
      ...(patches.get(activeId) || {}),
      status: destStatus,
      isDone: nowDone,
      completedMs: nowDone ? (item.todo.completedMs || Date.now()) : null,
    };
    patches.set(activeId, patch);
    const extras = nowDone && !wasDone ? await rollRecurrence(item, patch) : [];
    applyPatches(patches, extras);
  };

  const addTodo = async () => {
    if (!text.trim()) return;
    const p = parseTask(text);
    const todo = {
      text: p.title || text.trim(),
      isDone: false,
      createdMs: Date.now(),
      ...(p.due != null ? { due: p.due } : {}),
      ...(p.priority && p.priority !== 'none' ? { priority: p.priority } : {}),
      ...(p.tags?.length ? { tags: p.tags } : {}),
      ...(p.recurrence ? { recurrence: p.recurrence } : {}),
    };
    todo.id = genId();
    todo.status = 'todo';
    todo.order = (todos || []).length;
    if (selectedProject !== 'all') todo.projectId = selectedProject;
    setTodos([...(todos || []), todo]);
    setText('');
    trackContentCreated('task');
  };

  // ---- project CRUD ----

  const createProject = (name, color) => {
    const list = projects || [];
    setProjects([...list, { id: genId(), name, color, order: list.length }]);
  };

  const renameProject = (id, name) => {
    setProjects((projects || []).map((p) => (p.id === id ? { ...p, name } : p)));
  };

  // Deleting a project keeps its tasks — they just lose the project.
  const deleteProject = (id) => {
    setProjects((projects || []).filter((p) => p.id !== id));
    if ((todos || []).some((t) => t && t.projectId === id)) {
      setTodos((todos || []).map((t) => (t && t.projectId === id ? { ...t, projectId: null } : t)));
    }
    if (selectedProject === id) setSelectedProject('all');
  };

  const detailItem = detailId ? itemById.get(detailId) : null;

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTodo(); }}
            placeholder="pay rent friday !high #finance every month"
            aria-label="New todo"
          />
          <Button className="shrink-0" onClick={addTodo}>Add</Button>
        </div>

        {/* Quick-add parse hint — extra chrome, hidden in the narrow widget. */}
        <div className="mt-2 hidden min-h-6 flex-wrap items-center gap-1.5 text-xs text-muted-foreground @md:flex">
          {preview ? (
            <>
              <Sparkles className="size-3.5" />
              <span className="font-medium text-foreground">{preview.title}</span>
              {preview.due != null && <Badge variant="outline" className="font-normal">{dueLabel(preview.due)}</Badge>}
              {preview.priority !== 'none' && <Badge variant="outline" className="font-normal">!{preview.priority}</Badge>}
              {preview.tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">#{t}</Badge>)}
              {preview.recurrence && <Badge variant="outline" className="font-normal">repeats</Badge>}
            </>
          ) : (
            <span>Try “call mom tomorrow !med #family” or “water plants every 3 days”.</span>
          )}
        </div>

        {/* Project chips — collapse away in the narrow widget. */}
        <div className="mt-2 hidden @md:block">
          <ProjectBar
            projects={projects || []}
            selected={selectedProject}
            onSelect={setSelectedProject}
            onCreate={createProject}
            onRename={renameProject}
            onDelete={deleteProject}
          />
        </div>
      </div>

      {/* Scroll region. Tabs let the page switch List/Board; the switcher is
          hidden in the narrow widget, which stays pinned to the smart list. */}
      <div className="min-h-0 flex-1 overflow-auto">
        <Tabs defaultValue="list">
          <TabsList className="mb-3 hidden @md:inline-flex">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
          </TabsList>
          <TabsContent value="list">
            <ListView
              items={visibleItems}
              projectsById={projectsById}
              subCountOf={subCountOf}
              onToggle={toggleTodo}
              onDelete={removeTodo}
              onOpen={setDetailId}
            />
          </TabsContent>
          <TabsContent value="board">
            <BoardView
              items={visibleItems}
              projectsById={projectsById}
              subCountOf={subCountOf}
              onToggle={toggleTodo}
              onOpen={setDetailId}
              onMove={moveCard}
            />
          </TabsContent>
        </Tabs>
      </div>

      <TaskDetail
        key={detailId || 'closed'}
        item={detailItem}
        subtasks={detailId ? childrenByParent.get(detailId) || [] : []}
        projects={projects || []}
        onClose={() => setDetailId(null)}
        onUpdate={updateTodo}
        onToggle={toggleTodo}
        onAddSubtask={addSubtask}
        onDelete={removeTodo}
      />
    </div>
  );
}

export default TodoApp;
