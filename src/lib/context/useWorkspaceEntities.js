// The workspace context layer (Phase 1 — read-only aggregator).
//
// One normalized *read-model* over every app's existing store, so any app can
// see every other app's items without duplicating data. This is the "everything
// knows everything" layer: apps still own their storage for now (layered
// approach), but they can query the whole workspace through here.
//
// Every entity shares one envelope:
//   { id, type, title, dueMs, done, tags, updatedMs, linkSource, ref }
// where `id` is a GLOBAL id (`<type>:<innerId>`), `linkSource` is the text that
// may contain [[wiki links]], and `ref` locates the record in its own store.
//
// Derived (never stored): a by-title index for [[link]] resolution, an outgoing
// link graph, and its reverse — backlinks. See WEBOS_PLAN.md.

import { createContext, useContext, useMemo } from 'react';
import { ThemeContext } from '../../App';
import { useStore } from '../store/WorkspaceProvider';
import { dayKey } from '../time/format';

// The computed graph is provided once at the app root (WorkspaceGraphProvider)
// and shared, so N mounted consumers (Notes + Calendar + Today widgets open at
// once) don't each rebuild the whole graph + indexes. See useComputeWorkspaceGraph.
export const WorkspaceGraphContext = createContext(null);

// App route each entity type opens in (for cross-app navigation from a link).
export const ENTITY_ROUTES = {
  note: '/note-taking',
  task: '/to-do-list',
  roadmap: '/roadmap',
  milestone: '/roadmap',
  deck: '/flashcards',
};

// Local-day key for a millisecond timestamp (shared with the Clock layer).
export const dateKeyOf = (ms) =>
  typeof ms === 'number' ? dayKey(new Date(ms)) : null;

const WIKI_RE = /\[\[([^[\]]+)\]\]/g;

export function extractWikiTitles(text) {
  if (!text) return [];
  const out = [];
  let m;
  WIKI_RE.lastIndex = 0;
  while ((m = WIKI_RE.exec(text)) !== null) {
    const t = m[1].trim();
    if (t) out.push(t);
  }
  return out;
}

// Builds the normalized read-model + indexes. Called ONCE by
// WorkspaceGraphProvider; consumers use useWorkspaceEntities() to read it.
export function useComputeWorkspaceGraph() {
  const { todos } = useContext(ThemeContext);
  // Reading these here spins up their (workspace-scoped, visibility-gated) live
  // stores so links/backlinks stay current wherever this hook is used. Notes now
  // live in the unified `entities` store (Phase 4); Tasks/Roadmap/Flashcards are
  // still on their per-app stores and get normalized in below.
  const [entityStore] = useStore('entities', []);
  const [roadmaps] = useStore('roadmaps', []);
  const [flash] = useStore('flashcards', { decks: [], cards: [] });

  const entities = useMemo(() => {
    const list = [];

    for (const e of entityStore || []) {
      if (!e || e.type !== 'note') continue; // only notes are unified so far
      list.push({
        id: `note:${e.noteId}`, type: 'note', title: e.title || 'Untitled',
        dueMs: null, done: false, tags: e.tags || [], updatedMs: e.updatedMs || 0,
        linkSource: e.body || '', ref: { store: 'entities', id: e.noteId },
      });
    }

    (todos || []).forEach((t, i) => {
      if (!t) return;
      const innerId = typeof t.id === 'string' && t.id ? t.id : `__i${i}`;
      list.push({
        id: `task:${innerId}`, type: 'task', title: t.text || 'Untitled task',
        dueMs: typeof t.due === 'number' ? t.due : null, done: !!t.isDone,
        tags: t.tags || [], updatedMs: t.updatedMs || t.createdMs || 0,
        linkSource: t.text || '', ref: { store: 'todos', id: innerId },
      });
    });

    for (const r of roadmaps || []) {
      if (!r) continue;
      list.push({
        id: `roadmap:${r.id}`, type: 'roadmap', title: r.title || 'Roadmap',
        dueMs: null, done: false, tags: [], updatedMs: r.createdMs || 0,
        linkSource: '', ref: { store: 'roadmaps', id: r.id },
      });
      for (const ms of r.milestones || []) {
        if (!ms) continue;
        list.push({
          id: `milestone:${ms.id}`, type: 'milestone', title: ms.title || 'Milestone',
          dueMs: typeof ms.due === 'number' ? ms.due : null, done: !!ms.done, tags: [],
          updatedMs: r.createdMs || 0,
          linkSource: (ms.steps || []).map((s) => s?.text || '').join(' '),
          ref: { store: 'roadmaps', id: r.id, milestoneId: ms.id },
        });
      }
    }

    for (const d of flash?.decks || []) {
      if (!d) continue;
      list.push({
        id: `deck:${d.id}`, type: 'deck', title: d.name || 'Deck',
        dueMs: null, done: false, tags: [], updatedMs: d.createdMs || 0,
        linkSource: '', ref: { store: 'flashcards', id: d.id },
      });
    }

    return list;
  }, [entityStore, todos, roadmaps, flash]);

  const indexes = useMemo(() => {
    const byId = new Map();
    const byTitle = new Map(); // lowercased title -> first matching entity
    for (const e of entities) {
      byId.set(e.id, e);
      const key = e.title.trim().toLowerCase();
      if (key && !byTitle.has(key)) byTitle.set(key, e);
    }
    // byDate: local-day key -> entities due that day (any dated type).
    // byTag: lowercased tag -> entities carrying it.
    const byDate = new Map();
    const byTag = new Map();
    for (const e of entities) {
      const key = dateKeyOf(e.dueMs);
      if (key) {
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key).push(e);
      }
      for (const tag of e.tags || []) {
        const t = String(tag).trim().toLowerCase();
        if (!t) continue;
        if (!byTag.has(t)) byTag.set(t, []);
        byTag.get(t).push(e);
      }
    }

    const backlinks = new Map(); // targetId -> Set(sourceId)
    const outgoing = new Map(); // sourceId -> Set(targetId)
    for (const e of entities) {
      const titles = extractWikiTitles(e.linkSource);
      if (!titles.length) continue;
      for (const title of titles) {
        const target = byTitle.get(title.toLowerCase());
        if (!target || target.id === e.id) continue;
        if (!outgoing.has(e.id)) outgoing.set(e.id, new Set());
        outgoing.get(e.id).add(target.id);
        if (!backlinks.has(target.id)) backlinks.set(target.id, new Set());
        backlinks.get(target.id).add(e.id);
      }
    }
    return { byId, byTitle, byDate, byTag, backlinks, outgoing };
  }, [entities]);

  return useMemo(() => ({
    entities,
    byId: indexes.byId,
    byDate: indexes.byDate,
    byTag: indexes.byTag,
    // Resolve a [[title]] to any entity across the workspace (null if none).
    resolveTitle: (title) =>
      title ? indexes.byTitle.get(String(title).trim().toLowerCase()) || null : null,
    // Entities that link TO this one (any type).
    backlinksOf: (entityId) =>
      [...(indexes.backlinks.get(entityId) || [])].map((id) => indexes.byId.get(id)).filter(Boolean),
    // Entities this one links to (any type).
    linksFrom: (entityId) =>
      [...(indexes.outgoing.get(entityId) || [])].map((id) => indexes.byId.get(id)).filter(Boolean),
    // Dated entities on a given day (Date or epoch ms). Sorted by dueMs.
    entitiesOnDate: (dateOrMs) => {
      const ms = dateOrMs instanceof Date ? dateOrMs.getTime() : dateOrMs;
      const key = dateKeyOf(ms);
      if (!key) return [];
      return [...(indexes.byDate.get(key) || [])].sort((a, b) => (a.dueMs || 0) - (b.dueMs || 0));
    },
    // Entities carrying a tag (case-insensitive).
    entitiesByTag: (tag) =>
      tag ? [...(indexes.byTag.get(String(tag).trim().toLowerCase()) || [])] : [],
  }), [entities, indexes]);
}

// The hook every app uses: reads the shared graph from context. Requires a
// <WorkspaceGraphProvider> ancestor (mounted at the app root).
export function useWorkspaceEntities() {
  const graph = useContext(WorkspaceGraphContext);
  if (!graph) {
    throw new Error('useWorkspaceEntities must be used within <WorkspaceGraphProvider>');
  }
  return graph;
}
