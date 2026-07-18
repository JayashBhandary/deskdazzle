import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ListChecks } from 'lucide-react';
import { ThemeContext } from '../App';
import { SEARCHABLE } from '../toolsData';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { core } from '@/lib/wasm';

// ⌘K / Ctrl+K palette. Tools/pages are filtered in JS; your actual *content*
// (notes + todos) is searched by the Rust/WASM full-text engine — instant and
// fully offline. Open/close state is owned by the Shortcuts component.
function CommandPalette({ open, onClose }) {
  const { todos } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [contentHits, setContentHits] = useState([]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCHABLE;
    return SEARCHABLE.filter((item) =>
      (item.name + ' ' + item.desc + ' ' + (item.keywords || '')).toLowerCase().includes(q)
    );
  }, [query]);

  // Full-text search across notes (localStorage) and todos (account store)
  // via the Rust core. Recomputed as you type.
  useEffect(() => {
    let cancelled = false;
    const q = query.trim();
    if (!q) {
      setContentHits([]);
      return;
    }
    let notes = [];
    try {
      notes = JSON.parse(window.localStorage.getItem('deskdazzle.notes') || '[]');
    } catch { /* unreadable notes store */ }
    const docs = [
      ...notes.map((n) => ({
        id: `note-${n.id}`,
        kind: 'note',
        title: n.title || 'Untitled',
        body: n.body || '',
        tags: [],
      })),
      ...(todos || []).map((t, i) => ({
        id: `todo-${i}`,
        kind: 'task',
        title: t.text || '',
        body: '',
        tags: t.tags || [],
      })),
    ];
    if (docs.length === 0) {
      setContentHits([]);
      return;
    }
    core.search(q, docs)
      .then((hits) => { if (!cancelled) setContentHits(hits.slice(0, 6)); })
      .catch(() => { if (!cancelled) setContentHits([]); });
    return () => { cancelled = true; };
  }, [query, todos]);

  const go = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Command palette"
      description="Search tools, pages, notes and todos"
      shouldFilter={false}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search tools, pages, notes and todos…"
      />
      <CommandList>
        <CommandEmpty>No matches for “{query}”.</CommandEmpty>
        {contentHits.length > 0 && (
          <>
            <CommandGroup heading="Your content">
              {contentHits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={hit.id}
                  onSelect={() => go(hit.kind === 'note' ? '/note-taking' : '/to-do-list')}
                >
                  {hit.kind === 'note' ? <FileText /> : <ListChecks />}
                  <div className="min-w-0">
                    <div className="truncate">{hit.snippet}</div>
                    <div className="text-xs text-muted-foreground">
                      {hit.kind === 'note' ? 'Note' : 'To-do'}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Tools & pages">
          {tools.map((item) => (
            <CommandItem key={item.path} value={item.path} onSelect={() => go(item.path)}>
              <span aria-hidden="true">{item.icon}</span>
              <div className="min-w-0">
                <div className="truncate">{item.name}</div>
                <div className="truncate text-xs text-muted-foreground">{item.desc}</div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
