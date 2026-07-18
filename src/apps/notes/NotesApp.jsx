import React, { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Eye, Link2, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '../../lib/store/WorkspaceProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { core } from '@/lib/wasm';
import { convertText } from '@/lib/converter-client';

// Same prose-ish styling the Markdown Previewer uses for rendered output.
const PROSE_CLASSES =
  'prose-headings:font-semibold prose-headings:tracking-tight [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_h1]:mt-4 [&_h1]:text-2xl [&_h2]:mt-3 [&_h2]:text-xl [&_h3]:mt-2 [&_h3]:text-lg [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-6';

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Replace [[Wiki Links]] with anchors before the markdown pass. Existing
// titles get data-note-id; unknown ones get data-note-missing so a click
// can create the note.
function linkifyWiki(body, notes) {
  return body.replace(/\[\[([^[\]]+)\]\]/g, (match, raw) => {
    const title = raw.trim();
    if (!title) return match;
    const target = notes.find(
      (n) => (n.title || '').trim().toLowerCase() === title.toLowerCase(),
    );
    if (target) {
      return `<a data-note-id="${escapeHtml(String(target.id))}" href="#">${escapeHtml(title)}</a>`;
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
  const [notes, setNotes] = useStore('notes', []);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('preview'); // 'edit' | 'preview'
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null); // null = no active search
  const [html, setHtml] = useState('');
  const [quick, setQuick] = useState(''); // narrow/widget quick-capture

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
    convertText('md2html', linkifyWiki(selected.body, notes))
      .then((raw) => {
        if (!cancelled) {
          setHtml(
            DOMPurify.sanitize(raw, { ADD_ATTR: ['data-note-id', 'data-note-missing'] }),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedId, notes]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const backlinks = useMemo(() => {
    if (!selected || !(selected.title || '').trim()) return [];
    const needle = `[[${selected.title.trim().toLowerCase()}]]`;
    return notes.filter(
      (n) => n.id !== selected.id && (n.body || '').toLowerCase().includes(needle),
    );
  }, [notes, selected]);

  const openNote = (id) => {
    setSelectedId(id);
    setMode('preview');
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
    toast.success(`Created "${title}"`);
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

  // Wiki-link clicks inside the rendered preview (event delegation).
  const onPreviewClick = (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    const noteId = anchor.getAttribute('data-note-id');
    const missing = anchor.getAttribute('data-note-missing');
    if (noteId !== null) {
      e.preventDefault();
      const target = notes.find((n) => String(n.id) === noteId);
      if (target) openNote(target.id);
    } else if (missing !== null) {
      e.preventDefault();
      createFromLink(missing);
    }
  };

  return (
    <div className="@container flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 gap-4 @md:grid-cols-[minmax(240px,340px)_1fr] @md:gap-6">
        {/* Note list + capture */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="Search notes..."
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search notes"
            />
            <Button className="hidden shrink-0 @md:inline-flex" size="sm" onClick={newNote}>
              <Plus /> New note
            </Button>
          </div>

          {/* Quick capture — widget width only (full editor takes over at @md). */}
          <div className="flex gap-1.5 @md:hidden">
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
        </div>

        {/* Editor / preview — page width only. */}
        <div className="hidden min-h-0 min-w-0 overflow-y-auto @md:block">
          {mode === 'edit' ? (
            <Card>
              <CardContent className="space-y-3">
                <Input
                  value={draft.title}
                  placeholder="Title"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  aria-label="Note title"
                />
                <Textarea
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
                <div className="flex flex-wrap gap-2">
                  <Button onClick={save} disabled={!draft.title.trim() && !draft.body.trim()}>
                    <Save /> Save
                  </Button>
                  <Button variant="outline" onClick={cancelEdit}>
                    <X /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : selected ? (
            <Card>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">
                      {selected.title || 'Untitled'}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>Updated {relativeTime(noteUpdatedMs(selected))}</span>
                      {(selected.tags || []).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="secondary" size="sm" disabled>
                      <Eye /> Preview
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => startEdit(selected)}>
                      <Pencil /> Edit
                    </Button>
                  </div>
                </div>

                {html ? (
                  <div className={PROSE_CLASSES} onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {(selected.body || '').trim() ? 'Rendering…' : 'This note is empty.'}
                  </p>
                )}

                {backlinks.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Link2 className="size-3.5" /> Linked from
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {backlinks.map((n) => (
                        <Button
                          key={n.id}
                          variant="outline"
                          size="sm"
                          onClick={() => openNote(n.id)}
                        >
                          {n.title || 'Untitled'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a note on the left, or create a new one.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotesApp;
