// The workspace context layer (Phase 1 — read-only aggregator).
//
// One normalized *read-model* over every app's existing store, so any app can
// see every other app's items without duplicating data. This is the "everything
// knows everything" layer: apps still own their storage for now (layered
// approach), but they can query the whole workspace through here.
//
// Every entity shares one envelope:
//   { id, type, title, dueMs, tags, updatedMs, linkSource, ref }
// where `id` is a GLOBAL id (`<type>:<innerId>`), `linkSource` is the text that
// may contain [[wiki links]], and `ref` locates the record in its own store.
//
// Derived (never stored): a by-title index for [[link]] resolution, an outgoing
// link graph, and its reverse — backlinks. See WEBOS_PLAN.md.

import { useContext, useMemo } from 'react';
import { ThemeContext } from '../../App';
import { useStore } from '../store/WorkspaceProvider';

// App route each entity type opens in (for cross-app navigation from a link).
export const ENTITY_ROUTES = {
  note: '/note-taking',
  task: '/to-do-list',
  roadmap: '/roadmap',
  milestone: '/roadmap',
  deck: '/flashcards',
};

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

export function useWorkspaceEntities() {
  const { todos } = useContext(ThemeContext);
  // Reading these here spins up their (workspace-scoped, visibility-gated) live
  // stores so links/backlinks stay current wherever this hook is used.
  const [notes] = useStore('notes', []);
  const [roadmaps] = useStore('roadmaps', []);
  const [flash] = useStore('flashcards', { decks: [], cards: [] });

  const entities = useMemo(() => {
    const list = [];

    for (const n of notes || []) {
      if (!n) continue;
      list.push({
        id: `note:${n.id}`, type: 'note', title: n.title || 'Untitled',
        dueMs: null, tags: n.tags || [], updatedMs: n.updatedMs || 0,
        linkSource: n.body || '', ref: { store: 'notes', id: n.id },
      });
    }

    (todos || []).forEach((t, i) => {
      if (!t) return;
      const innerId = typeof t.id === 'string' && t.id ? t.id : `__i${i}`;
      list.push({
        id: `task:${innerId}`, type: 'task', title: t.text || 'Untitled task',
        dueMs: typeof t.due === 'number' ? t.due : null, tags: t.tags || [],
        updatedMs: t.updatedMs || t.createdMs || 0,
        linkSource: t.text || '', ref: { store: 'todos', id: innerId },
      });
    });

    for (const r of roadmaps || []) {
      if (!r) continue;
      list.push({
        id: `roadmap:${r.id}`, type: 'roadmap', title: r.title || 'Roadmap',
        dueMs: null, tags: [], updatedMs: r.createdMs || 0,
        linkSource: '', ref: { store: 'roadmaps', id: r.id },
      });
      for (const ms of r.milestones || []) {
        if (!ms) continue;
        list.push({
          id: `milestone:${ms.id}`, type: 'milestone', title: ms.title || 'Milestone',
          dueMs: typeof ms.due === 'number' ? ms.due : null, tags: [],
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
        dueMs: null, tags: [], updatedMs: d.createdMs || 0,
        linkSource: '', ref: { store: 'flashcards', id: d.id },
      });
    }

    return list;
  }, [notes, todos, roadmaps, flash]);

  const indexes = useMemo(() => {
    const byId = new Map();
    const byTitle = new Map(); // lowercased title -> first matching entity
    for (const e of entities) {
      byId.set(e.id, e);
      const key = e.title.trim().toLowerCase();
      if (key && !byTitle.has(key)) byTitle.set(key, e);
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
    return { byId, byTitle, backlinks, outgoing };
  }, [entities]);

  return useMemo(() => ({
    entities,
    byId: indexes.byId,
    // Resolve a [[title]] to any entity across the workspace (null if none).
    resolveTitle: (title) =>
      title ? indexes.byTitle.get(String(title).trim().toLowerCase()) || null : null,
    // Entities that link TO this one (any type).
    backlinksOf: (entityId) =>
      [...(indexes.backlinks.get(entityId) || [])].map((id) => indexes.byId.get(id)).filter(Boolean),
    // Entities this one links to (any type).
    linksFrom: (entityId) =>
      [...(indexes.outgoing.get(entityId) || [])].map((id) => indexes.byId.get(id)).filter(Boolean),
  }), [entities, indexes]);
}
