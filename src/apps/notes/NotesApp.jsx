import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ListTodo, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Save, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceEntities, ENTITY_ROUTES } from '../../lib/context/useWorkspaceEntities';
import { useWorkspaceActions } from '../../lib/context/useWorkspaceActions';
import { useNotes } from '../../lib/context/notesEntities';
import { dueLabel } from '@/components/tasks/model';
import Backlinks from '@/components/context/Backlinks';
import { cn } from '@/lib/utils';
import { useSidebarShortcut } from '@/lib/sidebarShortcut';
import { ShortcutTip } from '@/components/ShortcutTip';
import { SidebarShell } from '@/components/SidebarShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { core } from '@/lib/wasm';
import { convertText } from '@/lib/converter-client';

// Styling for rendered markdown output. Covers every element the WASM core can
// emit (GFM tables, task lists, strikethrough, footnotes, headings, code,
// images, rules) — pulldown-cmark has tables/tasklists/strikethrough/footnotes
// enabled, so all of these must be styled or they render unstructured.
const PROSE_CLASSES = [
  // Prose defaults + wrapping
  'text-sm leading-relaxed break-words',
  'prose-headings:font-semibold prose-headings:tracking-tight',
  // Headings
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-2xl [&_h1]:font-bold',
  '[&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-xl',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-lg',
  '[&_h4]:mt-2 [&_h4]:text-base',
  '[&_h5]:mt-2 [&_h5]:text-sm',
  '[&_h6]:mt-2 [&_h6]:text-sm [&_h6]:text-muted-foreground',
  // Text
  '[&_p]:my-2 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_strong]:font-semibold [&_em]:italic [&_del]:text-muted-foreground [&_del]:line-through',
  '[&_hr]:my-4 [&_hr]:border-t [&_hr]:border-border',
  '[&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-md',
  // Blockquote
  '[&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  // Code
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-sm',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  // Lists
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_ul_ul]:my-0 [&_ol_ol]:my-0',
  // GFM task lists: drop the bullet, keep the checkbox inline
  '[&_li:has(input[type=checkbox])]:list-none [&_li:has(input[type=checkbox])]:-ml-5',
  '[&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:align-middle',
  // GFM tables — the part that was "breaking": borders + padding + scroll on overflow
  '[&_table]:my-3 [&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
  '[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5',
].join(' ');

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Replace [[Wiki Links]] with anchors before the markdown pass. A link now
// resolves against the WHOLE workspace (notes, tasks, roadmaps, milestones,
// decks) via `resolveTitle` — not just other notes. Resolved links carry the
// global entity id + type; unknown titles get data-note-missing so a click can
// create a new note.
function linkifyWiki(body, resolveTitle) {
  return body.replace(/\[\[([^[\]]+)\]\]/g, (match, raw) => {
    const title = raw.trim();
    if (!title) return match;
    const target = resolveTitle(title);
    if (target) {
      return `<a data-entity-id="${escapeHtml(target.id)}" data-entity-type="${escapeHtml(target.type)}" href="#">${escapeHtml(title)}</a>`;
    }
    return `<a data-note-missing="${escapeHtml(title)}" href="#" class="opacity-60">${escapeHtml(title)}</a>`;
  });
}

function parseTags(text) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function noteUpdatedMs(note) {
  if (typeof note.updatedMs === 'number') return note.updatedMs;
  return typeof note.id === 'number' ? note.id : 0;
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

const EMPTY_DRAFT = { title: '', body: '', tags: '' };

// The Notes app — one component rendered by both the full page and the desktop
// widget. A `@container` root means the layout adapts to whatever width it's
// given: two columns (searchable list + markdown editor/preview with backlinks)
// on the page, and a single compact column with quick-capture in a small widget.
// The editor/preview/backlinks panes are hidden below `@md`, mirroring the old
// widget which only surfaced quick-add + a browsable list of titles.
function NotesApp() {
  const navigate = useNavigate();
  const wctx = useWorkspaceEntities(); // workspace-wide entity graph for links
  const actions = useWorkspaceActions(); // cross-app writes (e.g. note → task)
  const [notes, setNotes] = useNotes(); // note records backed by the unified store
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('preview'); // 'edit' | 'preview'
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null); // null = no active search
  const [html, setHtml] = useState('');
  const [quick, setQuick] = useState(''); // narrow/widget quick-capture
  // Reading zoom for the note viewer — a small widget crops the text, so let the
  // reader scale it up (or down) independently of UI scale.
  const [readScale, setReadScale] = useState(1);
  const bumpScale = (delta) =>
    setReadScale((s) => Math.min(2, Math.max(0.7, Math.round((s + delta) * 10) / 10)));

  // Apple-Notes-style layout: a collapsible sidebar (the note list) next to the
  // note detail. `narrow` (container < @md) switches the two to mutually
  // exclusive views — select a note → list collapses to the note; a toggle icon
  // brings the list back. On a wide container both show side by side and the
  // toggle simply hides/reveals the sidebar for a full-width note.
  const rootRef = useRef(null);
  const bodyRef = useRef(null); // the body <textarea>, for line/selection reads
  const [narrow, setNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useSidebarShortcut(rootRef, setSidebarOpen);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 448));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draggable separator: the sidebar width is resizable on the wide layout and
  // remembered on this device (a layout pref — kept local, not cloud-synced).
  const SIDEBAR_W_KEY = 'deskdazzle.notesSidebarWidth';
  const clampW = (w) => Math.min(480, Math.max(200, Math.round(w)));
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const v = Number(window.localStorage.getItem(SIDEBAR_W_KEY));
      if (Number.isFinite(v) && v > 0) return clampW(v);
    } catch { /* ignore */ }
    return 290;
  });
  const sepDrag = useRef(null);
  const [resizing, setResizing] = useState(false); // disables width transition mid-drag
  const onSepDown = (e) => {
    sepDrag.current = { x: e.clientX, w: sidebarWidth };
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onSepMove = (e) => {
    if (!sepDrag.current) return;
    setSidebarWidth(clampW(sepDrag.current.w + (e.clientX - sepDrag.current.x)));
  };
  const onSepUp = (e) => {
    if (!sepDrag.current) return;
    sepDrag.current = null;
    setResizing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    setSidebarWidth((w) => {
      try { window.localStorage.setItem(SIDEBAR_W_KEY, String(w)); } catch { /* ignore */ }
      return w;
    });
  };

  const selected = notes.find((n) => n.id === selectedId) || null;

  // Full-text search through the Rust core when the query is non-empty.
  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (!q) {
      setHits(null);
      return undefined;
    }
    const docs = notes.map((n) => ({
      id: String(n.id),
      kind: 'note',
      title: n.title || '',
      body: n.body || '',
      tags: n.tags || [],
    }));
    core
      .search(q, docs)
      .then((results) => {
        if (!cancelled) setHits(results);
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query, notes]);

  // Render the selected note: wiki-link pass → markdown (WASM) → DOMPurify.
  useEffect(() => {
    let cancelled = false;
    if (mode !== 'preview' || !selected || !(selected.body || '').trim()) {
      setHtml('');
      return undefined;
    }
    convertText('md2html', linkifyWiki(selected.body, wctx.resolveTitle))
      .then((raw) => {
        if (!cancelled) {
          setHtml(
            DOMPurify.sanitize(raw, {
              ADD_ATTR: ['data-entity-id', 'data-entity-type', 'data-note-missing'],
            }),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedId, notes, wctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleNotes = useMemo(() => {
    if (hits !== null) {
      return hits
        .map((h) => {
          const note = notes.find((n) => String(n.id) === h.id);
          return note ? { note, snippet: h.snippet } : null;
        })
        .filter(Boolean);
    }
    return [...notes]
      .sort((a, b) => noteUpdatedMs(b) - noteUpdatedMs(a))
      .map((note) => ({ note, snippet: null }));
  }, [hits, notes]);

  // Backlinks now span the WHOLE workspace: any entity (note, task, milestone…)
  // that links to this note via [[title]], resolved through the context layer.
  const backlinks = selected ? wctx.backlinksOf(`note:${selected.id}`) : [];

  const openNote = (id) => {
    setSelectedId(id);
    setMode('preview');
    if (narrow) setSidebarOpen(false); // push to the note; the list slides away
  };

  // Open any workspace entity a link points at: notes open here; every other
  // type navigates to its owning app.
  const openEntity = (entity) => {
    if (!entity) return;
    if (entity.type === 'note') {
      const target = notes.find((n) => String(n.id) === String(entity.ref.id));
      if (target) openNote(target.id);
      return;
    }
    navigate(ENTITY_ROUTES[entity.type] || '/');
  };

  const startEdit = (note) => {
    setSelectedId(note.id);
    setDraft({
      title: note.title || '',
      body: note.body || '',
      tags: (note.tags || []).join(', '),
    });
    setMode('edit');
  };

  const newNote = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setMode('edit');
    if (narrow) setSidebarOpen(false);
  };

  const save = () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    const now = Date.now();
    const fields = {
      title: draft.title,
      body: draft.body,
      tags: parseTags(draft.tags),
      updatedMs: now,
    };
    if (selectedId !== null && selected) {
      setNotes(notes.map((n) => (n.id === selectedId ? { ...n, ...fields } : n)));
      toast.success('Note saved');
    } else {
      setNotes([{ id: now, ...fields }, ...notes]);
      setSelectedId(now);
      toast.success('Note added');
    }
    setMode('preview');
  };

  const cancelEdit = () => {
    if (selected) setMode('preview');
    else {
      setSelectedId(null);
      setMode('preview');
      setDraft(EMPTY_DRAFT);
    }
  };

  const remove = (id) => {
    setNotes(notes.filter((n) => n.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setMode('preview');
    }
    toast.success('Note deleted');
  };

  // Create a note for a [[missing link]] and open it in the editor.
  const createFromLink = (title) => {
    const now = Date.now();
    setNotes([{ id: now, title, body: '', tags: [], updatedMs: now }, ...notes]);
    setSelectedId(now);
    setDraft({ title, body: '', tags: '' });
    setMode('edit');
    if (narrow) setSidebarOpen(false);
    toast.success(`Created "${title}"`);
  };

  // Cross-app command (WEBOS Phase 3): turn the selected text — or, with no
  // selection, the line under the cursor — into a Task. The line runs through
  // the same NL quick-parse the Tasks app uses, so "call mom friday !high"
  // becomes a task with a due date and priority. Written via the context action
  // layer, so Notes never touches the Tasks store directly.
  const makeTaskFromNote = async () => {
    const el = bodyRef.current;
    let raw = '';
    if (el && typeof el.selectionStart === 'number') {
      const { selectionStart, selectionEnd, value } = el;
      if (selectionEnd > selectionStart) {
        raw = value.slice(selectionStart, selectionEnd);
      } else {
        const from = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const nl = value.indexOf('\n', selectionStart);
        raw = value.slice(from, nl === -1 ? value.length : nl);
      }
    }
    // Fall back to the draft title, and strip a leading markdown list/task marker.
    const line = (raw || draft.title || '')
      .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, '')
      .trim();
    if (!line) {
      toast.error('Select a line to turn into a task');
      return;
    }
    let fields = { text: line };
    try {
      const p = await core.quickParse(line);
      fields = {
        text: p.title || line,
        due: typeof p.due === 'number' ? p.due : undefined,
        priority: p.priority,
        tags: p.tags,
        recurrence: p.recurrence,
      };
    } catch {
      // wasm unavailable → plain task from the raw line
    }
    const id = actions.createTask(fields);
    if (id) {
      toast.success(
        fields.due ? `Task created · due ${dueLabel(fields.due)}` : 'Task created in Tasks',
      );
    }
  };

  // Compact capture used at widget width: first line becomes the title, mirroring
  // the old NotesWidget behaviour while keeping the full note data shape.
  const quickAdd = () => {
    if (!quick.trim()) return;
    const now = Date.now();
    const title = quick.trim().split('\n')[0].slice(0, 40);
    setNotes([{ id: now, title, body: quick, tags: [], updatedMs: now }, ...notes]);
    setQuick('');
    toast.success('Note added');
  };

  // Wiki-link clicks inside the rendered preview (event delegation). A link may
  // now target any workspace entity; unknown titles create a new note.
  const onPreviewClick = (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    const entityId = anchor.getAttribute('data-entity-id');
    const missing = anchor.getAttribute('data-note-missing');
    if (entityId !== null) {
      e.preventDefault();
      openEntity(wctx.byId.get(entityId));
    } else if (missing !== null) {
      e.preventDefault();
      createFromLink(missing);
    }
  };

  // ---- Apple-Notes-style layout routing ----
  const hasDetail = mode === 'edit' || !!selected;
  // Narrow: sidebar and detail are mutually exclusive. Wide: sidebar is a
  // collapsible column beside an always-present detail pane.
  const showDetail = narrow ? hasDetail && !sidebarOpen : true;
  const showSidebar = narrow ? !showDetail : sidebarOpen;

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0">
      {/* Sidebar — the note list */}
      {(narrow ? showSidebar : true) && (
        <SidebarShell narrow={narrow} open={sidebarOpen} width={sidebarWidth} pad="pr-1" noTransition={resizing}>
          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="Search notes..."
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search notes"
            />
            <Button className="shrink-0 gap-1.5" size="sm" onClick={newNote} aria-label="New note">
              <Plus /> {!narrow && <span>New</span>}
            </Button>
          </div>

          {/* Quick capture — narrow only (the detail editor covers wide). */}
          {narrow && (
            <div className="flex gap-1.5">
              <Textarea
                className="min-h-0 min-w-0 flex-1 resize-none"
                rows={2}
                value={quick}
                placeholder="Quick note..."
                onChange={(e) => setQuick(e.target.value)}
                aria-label="Quick note"
              />
              <Button
                size="icon"
                className="size-8 shrink-0 self-start"
                onClick={quickAdd}
                aria-label="Add note"
              >
                <Plus />
              </Button>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {visibleNotes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? 'No matching notes.' : 'No notes yet. ✍️'}
                </CardContent>
              </Card>
            ) : (
              visibleNotes.map(({ note, snippet }) => (
                <Card
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNote(note.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openNote(note.id);
                    }
                  }}
                  className={`cursor-pointer gap-1 py-3 transition-colors hover:border-primary/40 ${
                    selectedId === note.id ? 'border-primary/60' : ''
                  }`}
                >
                  <CardContent className="px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {note.title || 'Untitled'}
                        </p>
                        {snippet && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {snippet}
                          </p>
                        )}
                        {(note.tags || []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {note.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {relativeTime(noteUpdatedMs(note))}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-destructive hover:text-destructive"
                        aria-label={`Delete ${note.title || 'untitled note'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(note.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SidebarShell>
      )}

      {/* Draggable separator — resize the sidebar (wide layout only) */}
      {!narrow && showSidebar && showDetail && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize notes list"
          onPointerDown={onSepDown}
          onPointerMove={onSepMove}
          onPointerUp={onSepUp}
          onPointerCancel={onSepUp}
          className="group relative w-2 shrink-0 cursor-col-resize touch-none select-none"
        >
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary group-active:bg-primary" />
        </div>
      )}

      {/* Detail — editor / preview / placeholder, with the sidebar toggle */}
      {showDetail && (
        <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !narrow && showSidebar && 'pl-3')}>
          <div className="mb-2 flex shrink-0 items-center gap-2 border-b pb-2">
            <ShortcutTip label={`${showSidebar ? 'Hide' : 'Show'} notes list · Shift+B`}>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label={showSidebar ? 'Hide notes list' : 'Show notes list'}
              >
                {showSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
              </Button>
            </ShortcutTip>

            {mode === 'edit' ? (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {selected ? 'Edit note' : 'New note'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={makeTaskFromNote}
                  title="Make a task from the selected line"
                >
                  <ListTodo /> Make task
                </Button>
                <Button size="sm" onClick={save} disabled={!draft.title.trim() && !draft.body.trim()}>
                  <Save /> Save
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  <X /> Cancel
                </Button>
              </>
            ) : selected ? (
              <>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{selected.title || 'Untitled'}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    Updated {relativeTime(noteUpdatedMs(selected))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => bumpScale(-0.1)}
                    disabled={readScale <= 0.7}
                    aria-label="Decrease text size"
                  >
                    <ZoomOut />
                  </Button>
                  <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">
                    {Math.round(readScale * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => bumpScale(0.1)}
                    disabled={readScale >= 2}
                    aria-label="Increase text size"
                  >
                    <ZoomIn />
                  </Button>
                  <Button size="sm" variant="outline" className="ml-1" onClick={() => startEdit(selected)}>
                    <Pencil /> Edit
                  </Button>
                </div>
              </>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">Notes</span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {mode === 'edit' ? (
              <div className="space-y-3">
                <Input
                  value={draft.title}
                  placeholder="Title"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  aria-label="Note title"
                />
                <Textarea
                  ref={bodyRef}
                  rows={14}
                  value={draft.body}
                  placeholder="Write markdown... link other notes with [[Note Title]]"
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  className="min-h-64 resize-y font-mono text-sm"
                  aria-label="Note body (markdown)"
                />
                <Input
                  value={draft.tags}
                  placeholder="Tags, comma, separated"
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                  aria-label="Tags (comma separated)"
                />
              </div>
            ) : selected ? (
              <div style={{ zoom: readScale }}>
                {(selected.tags || []).length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
                {html ? (
                  <div className={PROSE_CLASSES} onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(selected.body || '').trim() ? 'Rendering…' : 'This note is empty.'}
                  </p>
                )}

                <Backlinks entities={backlinks} onOpen={openEntity} />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {showSidebar
                  ? 'Select a note, or create a new one.'
                  : 'Select a note — tap the sidebar icon to see all notes.'}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default NotesApp;
