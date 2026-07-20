// WEBOS Phase 4 — first step of unifying storage into ONE normalized store.
//
// The plan is to migrate app-by-app onto a single per-workspace `entities`
// store (the source of truth), turning each app into a pure view/editor. This
// module does that for Notes, the simplest self-contained app, while Tasks /
// Roadmap / Flashcards stay on their current stores for now (they still feed
// the read graph). Everything here is additive and reversible: the legacy
// `notes` store is left untouched as an implicit backup, and migration also
// writes an explicit snapshot before it runs.
//
// Note entity shape stored in `entities`:
//   { id:`note:<noteId>`, type:'note', noteId, title, body, tags,
//     createdMs, updatedMs, dueMs:null, done:false, links:[] }

import { useCallback, useContext, useEffect, useMemo } from 'react';
import { ThemeContext } from '../../App';
import { useStore } from '../store/WorkspaceProvider';

// A note's app-record ({id,title,body,tags,createdMs,updatedMs}) ⇄ its canonical
// entity. Round-tripping preserves createdMs so ordering/age survive edits.
export function noteRecordToEntity(n) {
  const createdMs = n.createdMs || (typeof n.id === 'number' ? n.id : 0);
  return {
    id: `note:${n.id}`,
    type: 'note',
    noteId: n.id,
    title: n.title || 'Untitled',
    body: n.body || '',
    tags: n.tags || [],
    dueMs: null,
    done: false,
    createdMs,
    updatedMs: n.updatedMs || createdMs,
    links: [],
  };
}

export function entityToNoteRecord(e) {
  return {
    id: e.noteId ?? e.id,
    title: e.title || '',
    body: e.body || '',
    tags: e.tags || [],
    createdMs: e.createdMs || 0,
    updatedMs: e.updatedMs || 0,
  };
}

// Drop-in replacement for `useStore('notes', [])`: exposes note app-records
// backed by the unified `entities` store, so NotesApp code barely changes.
// The setter accepts the same value/updater forms NotesApp already uses and
// rewrites only the note-type entities, leaving every other type in place.
export function useNotes() {
  const [entities, setEntities] = useStore('entities', []);
  const notes = useMemo(
    () => (entities || []).filter((e) => e?.type === 'note').map(entityToNoteRecord),
    [entities],
  );
  const setNotes = useCallback(
    (updater) => {
      setEntities((prev) => {
        const arr = prev || [];
        const others = arr.filter((e) => e?.type !== 'note');
        const current = arr.filter((e) => e?.type === 'note').map(entityToNoteRecord);
        const next = typeof updater === 'function' ? updater(current) : updater;
        return [...others, ...(next || []).map(noteRecordToEntity)];
      });
    },
    [setEntities],
  );
  return [notes, setNotes];
}

const migrationFlagKey = (wsKey) => `deskdazzle.entities.notesMigrated.${wsKey}`;
const backupKey = (wsKey) => `deskdazzle.entities.backup.notes.${wsKey}`;

// One-time, per-workspace migration of the legacy `notes` store into `entities`.
// Runs at app root. Safe to run every render — it no-ops once the flag is set
// or once note entities already exist. Signed-in data arrives asynchronously,
// so this re-checks as `legacyNotes` populates and migrates when it lands.
export function useEntityMigration() {
  const { activeWorkspaceId } = useContext(ThemeContext) || {};
  const [entities, setEntities] = useStore('entities', []);
  const [legacyNotes] = useStore('notes', []);

  useEffect(() => {
    const wsKey = activeWorkspaceId || 'default';
    const flag = migrationFlagKey(wsKey);
    let already = false;
    try { already = !!window.localStorage.getItem(flag); } catch { /* ignore */ }
    if (already) return;

    // If note entities already exist, migration effectively happened — seal it.
    if ((entities || []).some((e) => e?.type === 'note')) {
      try { window.localStorage.setItem(flag, String(Date.now())); } catch { /* ignore */ }
      return;
    }
    // Nothing to migrate yet — don't seal (data may still be loading).
    if (!legacyNotes || legacyNotes.length === 0) return;

    // Snapshot the source before touching anything (explicit, restorable backup).
    try {
      window.localStorage.setItem(
        backupKey(wsKey),
        JSON.stringify({ ts: Date.now(), notes: legacyNotes }),
      );
    } catch { /* ignore quota */ }

    setEntities((prev) => {
      const others = (prev || []).filter((e) => e?.type !== 'note');
      return [...others, ...legacyNotes.map(noteRecordToEntity)];
    });
    try { window.localStorage.setItem(flag, String(Date.now())); } catch { /* ignore */ }
  }, [activeWorkspaceId, entities, legacyNotes, setEntities]);
}
