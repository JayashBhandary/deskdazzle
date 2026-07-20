// The workspace context *write* layer (Phase 3 — writes through the layer).
//
// The mirror of useWorkspaceEntities (which reads the whole workspace as one
// normalized graph): this hook lets any app CREATE / UPDATE / DELETE entities
// without knowing which store owns them. Storage is still per-app underneath
// (layered approach) — these actions just route a write to the right store and
// shape it to that app's record, so a cross-app command ("make a task from
// this note line") never has to import the Tasks app's internals.
//
// Ids are the same GLOBAL ids the read layer uses (`<type>:<innerId>`). Round
// one covers the two primary editable types, tasks and notes; other types
// return false from update/delete so callers can tell the write didn't land.

import { useContext, useMemo } from 'react';
import { ThemeContext } from '../../App';
import { useStore } from '../store/WorkspaceProvider';
import { genId } from '../../components/tasks/model';
import { noteRecordToEntity } from './notesEntities';
import { policy } from './policy';

// Split a global id into [type, innerId]. innerId may itself contain ':'—unlikely
// but we only split on the first separator to be safe.
function splitId(globalId) {
  const s = String(globalId || '');
  const i = s.indexOf(':');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}

export function useWorkspaceActions() {
  const { todos, setTodos } = useContext(ThemeContext);
  // Notes live in the unified `entities` store (Phase 4); tasks are still the
  // legacy synced array in ThemeContext.
  const [entities, setEntities] = useStore('entities', []);

  return useMemo(() => {
    // --- create ---

    // Create a task in the Tasks store, matching TodoApp.addTodo's record shape
    // (RTDB strips empty fields, so only set what's present). Returns the new
    // global id.
    const createTask = ({ text, due, tags, priority, recurrence, projectId } = {}) => {
      const title = (text || '').trim();
      if (!title) return null;
      if (!policy.canCreate('task').ok) return null; // future SaaS gating hook point
      const id = genId();
      const todo = {
        text: title,
        isDone: false,
        createdMs: Date.now(),
        id,
        status: 'todo',
        order: (todos || []).length,
        ...(typeof due === 'number' ? { due } : {}),
        ...(priority && priority !== 'none' ? { priority } : {}),
        ...(tags?.length ? { tags } : {}),
        ...(recurrence ? { recurrence } : {}),
        ...(projectId ? { projectId } : {}),
      };
      setTodos([...(todos || []), todo]);
      return `task:${id}`;
    };

    // Create a note in the unified store (newest first). Returns global id.
    const createNote = ({ title, body, tags } = {}) => {
      if (!policy.canCreate('note').ok) return null; // future SaaS gating hook point
      const now = Date.now();
      const record = {
        id: now,
        title: (title || '').trim() || 'Untitled',
        body: body || '',
        tags: tags || [],
        createdMs: now,
        updatedMs: now,
      };
      setEntities((prev) => {
        const arr = prev || [];
        const others = arr.filter((e) => e?.type !== 'note');
        const noteEntities = arr.filter((e) => e?.type === 'note');
        return [...others, noteRecordToEntity(record), ...noteEntities];
      });
      return `note:${now}`;
    };

    // --- update / delete (routed by type) ---

    const updateEntity = (globalId, patch = {}) => {
      const [type, innerId] = splitId(globalId);
      if (type === 'task') {
        let hit = false;
        const next = (todos || []).map((t) => {
          if (!t || String(t.id) !== innerId) return t;
          hit = true;
          const p = { ...t };
          if (patch.text != null || patch.title != null) p.text = patch.text ?? patch.title;
          if ('due' in patch) p.due = patch.due;
          if ('tags' in patch) p.tags = patch.tags;
          if ('priority' in patch) p.priority = patch.priority;
          if ('done' in patch) {
            p.isDone = !!patch.done;
            p.status = patch.done ? 'done' : 'todo';
            p.completedMs = patch.done ? Date.now() : null;
          }
          return p;
        });
        if (hit) setTodos(next);
        return hit;
      }
      if (type === 'note') {
        let hit = false;
        const next = (entities || []).map((e) => {
          if (!e || e.type !== 'note' || String(e.noteId) !== innerId) return e;
          hit = true;
          return {
            ...e,
            ...(patch.title != null ? { title: patch.title } : {}),
            ...('body' in patch ? { body: patch.body } : {}),
            ...('tags' in patch ? { tags: patch.tags } : {}),
            updatedMs: Date.now(),
          };
        });
        if (hit) setEntities(next);
        return hit;
      }
      return false; // milestone/roadmap/deck: not yet writable through the layer
    };

    const deleteEntity = (globalId) => {
      const [type, innerId] = splitId(globalId);
      if (type === 'task') {
        const next = (todos || []).filter((t) => t && String(t.id) !== innerId);
        if (next.length === (todos || []).length) return false;
        setTodos(next);
        return true;
      }
      if (type === 'note') {
        const arr = entities || [];
        const next = arr.filter((e) => !(e?.type === 'note' && String(e.noteId) === innerId));
        if (next.length === arr.length) return false;
        setEntities(next);
        return true;
      }
      return false;
    };

    return { createTask, createNote, updateEntity, deleteEntity };
  }, [todos, setTodos, entities, setEntities]);
}
