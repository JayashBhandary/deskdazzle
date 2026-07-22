import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Bold, Download, Eye, FileText, Heading, Italic, List, ListOrdered,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, Table as TableIcon, Trash2, Underline, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, readFileBytes, MIME } from '@/lib/office';
import { humanDuration } from '@/lib/image-shared';
import { FileDown } from 'lucide-react';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { useSidebarShortcut } from '@/lib/sidebarShortcut';
import { ShortcutTip } from '@/components/ShortcutTip';
import { SidebarShell } from '@/components/SidebarShell';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

// A blank document starts with one empty paragraph so there's always something
// to type into.
const blankDoc = () => ({ blocks: [{ type: 'paragraph', runs: [{ text: '' }] }] });

const newId = () =>
  `w-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ---- paragraph run helpers (the editor edits a paragraph as one text field;
// character formatting is applied to the whole paragraph, which still exports
// as real runs and round-trips through the model) ----
const runsText = (runs) => (runs || []).map((r) => r.text).join('');
const runsFlags = (runs) => {
  const r = (runs && runs[0]) || {};
  return { bold: !!r.bold, italic: !!r.italic, underline: !!r.underline };
};
const makeRuns = (text, flags) => [{ text, ...flags }];

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

// The Word (word-processor) app. One component powers both the full page and the
// desktop widget; a `@container` root and a width-based `narrow` switch adapt the
// layout. Documents are a native block model persisted to the synced workspace
// store; the WASM office core turns that model into real .docx on export/import.
function WordApp() {
  const [docs, setDocs] = useStore('wordDocs', []);
  const [selectedId, setSelectedId] = useState(null);
  const [focusedBlock, setFocusedBlock] = useState(0);
  const [view, setView] = useState('edit'); // 'edit' | 'read'
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const selected = docs.find((d) => d.id === selectedId) || null;

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useSidebarShortcut(rootRef, setSidebarOpen);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...docs].sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0)),
    [docs],
  );

  const touch = (id, model) =>
    setDocs(docs.map((d) => (d.id === id ? { ...d, doc: model, updatedMs: Date.now() } : d)));

  const createDoc = (name = 'Untitled', doc = blankDoc()) => {
    const id = newId();
    setDocs([{ id, name, doc, updatedMs: Date.now() }, ...docs]);
    setSelectedId(id);
    setFocusedBlock(0);
    if (narrow) setSidebarOpen(false);
    return id;
  };

  const rename = (id, name) =>
    setDocs(docs.map((d) => (d.id === id ? { ...d, name } : d)));

  const remove = (id) => {
    setDocs(docs.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success('Document deleted');
  };

  const openDoc = (id) => {
    setSelectedId(id);
    setFocusedBlock(0);
    if (narrow) setSidebarOpen(false);
  };

  // ---- block editing (operate on the selected doc) ----
  const blocks = selected?.doc?.blocks || [];
  const setBlocks = (next) => selected && touch(selected.id, { blocks: next });
  const updateBlock = (i, patch) =>
    setBlocks(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const addBlock = (block) => {
    const at = Math.min(focusedBlock + 1, blocks.length);
    const next = [...blocks.slice(0, at), block, ...blocks.slice(at)];
    setBlocks(next);
    setFocusedBlock(at);
  };
  const removeBlock = (i) => {
    const next = blocks.filter((_, idx) => idx !== i);
    setBlocks(next.length ? next : blankDoc().blocks);
    setFocusedBlock((f) => Math.max(0, Math.min(f, next.length - 1)));
  };
  const moveBlock = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
    setFocusedBlock(j);
  };

  // Toggle a character-format flag on the focused paragraph/heading.
  const toggleFlag = (flag) => {
    const b = blocks[focusedBlock];
    if (!b) return;
    if (b.type === 'paragraph') {
      const flags = runsFlags(b.runs);
      flags[flag] = !flags[flag];
      updateBlock(focusedBlock, { runs: makeRuns(runsText(b.runs), flags) });
    }
  };
  const setAlign = (align) => {
    const b = blocks[focusedBlock];
    if (b?.type === 'paragraph') updateBlock(focusedBlock, { align });
  };

  const activeFlags = blocks[focusedBlock]?.type === 'paragraph'
    ? runsFlags(blocks[focusedBlock].runs)
    : { bold: false, italic: false, underline: false };

  // ---- import / export ----
  const onPickFile = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await readFileBytes(file);
      const t0 = performance.now();
      const model = await office.wordImport(bytes);
      const ms = performance.now() - t0;
      const name = file.name.replace(/\.docx$/i, '') || 'Imported';
      createDoc(name, model);
      toast.success(`Imported "${name}" · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Couldn't open that file: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const exportDoc = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const t0 = performance.now();
      const bytes = await office.wordExport(selected.doc);
      const ms = performance.now() - t0;
      downloadBytes(bytes, `${selected.name || 'document'}.docx`, MIME.docx);
      toast.success(`Saved .docx · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const t0 = performance.now();
      const bytes = await office.wordPdf(selected.doc);
      const ms = performance.now() - t0;
      downloadBytes(bytes, `${selected.name || 'document'}.pdf`, MIME.pdf);
      toast.success(`Exported PDF · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`PDF export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const hasDetail = !!selected;
  const showDetail = narrow ? hasDetail && !sidebarOpen : true;
  const showSidebar = narrow ? !showDetail : sidebarOpen;

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0">
      <input
        ref={fileRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={onFile}
      />

      {/* Sidebar — document list */}
      {(narrow ? showSidebar : true) && (
        <SidebarShell narrow={narrow} open={sidebarOpen} width={256}>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => createDoc()}>
              <Plus /> New
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onPickFile} disabled={busy}>
              <Upload /> Open
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sorted.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No documents yet. 📄
                </CardContent>
              </Card>
            ) : (
              sorted.map((d) => (
                <Card
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDoc(d.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoc(d.id); }
                  }}
                  className={cn(
                    'cursor-pointer gap-1 py-3 transition-colors hover:border-primary/40',
                    selectedId === d.id && 'border-primary/60',
                  )}
                >
                  <CardContent className="flex items-start justify-between gap-2 px-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        {d.name || 'Untitled'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(d.doc?.blocks?.length || 0)} blocks · {relativeTime(d.updatedMs)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Delete ${d.name || 'document'}`}
                      onClick={(e) => { e.stopPropagation(); remove(d.id); }}
                    >
                      <Trash2 />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SidebarShell>
      )}

      {/* Detail — the editor */}
      {showDetail && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              {/* Title + actions */}
              <div className="mb-2 flex shrink-0 items-center gap-2 border-b pb-2">
                <ShortcutTip label={`${showSidebar ? 'Hide' : 'Show'} sidebar · Shift+B`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setSidebarOpen((o) => !o)}
                    aria-label={showSidebar ? 'Hide list' : 'Show list'}
                  >
                    {showSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
                  </Button>
                </ShortcutTip>
                <Input
                  value={selected.name}
                  onChange={(e) => rename(selected.id, e.target.value)}
                  className="h-8 min-w-0 flex-1 font-medium"
                  aria-label="Document name"
                />
                {/* Edit / Read segmented toggle */}
                <div className="flex shrink-0 items-center rounded-md border p-0.5">
                  <button
                    type="button"
                    onClick={() => setView('edit')}
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                      view === 'edit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-pressed={view === 'edit'}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('read')}
                    className={cn(
                      'flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                      view === 'read' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    aria-pressed={view === 'read'}
                  >
                    <Eye className="size-3.5" /> Read
                  </button>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPdf} disabled={busy} title="Export as PDF">
                  <FileDown /> PDF
                </Button>
                <Button size="sm" className="gap-1.5" onClick={exportDoc} disabled={busy} title="Save as .docx">
                  <Download /> Save
                </Button>
              </div>

              {view === 'read' ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <ReaderView doc={selected.doc} />
                </div>
              ) : (
              <>
              {/* Formatting toolbar */}
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1">
                <ToolbarToggle active={activeFlags.bold} onClick={() => toggleFlag('bold')} label="Bold"><Bold /></ToolbarToggle>
                <ToolbarToggle active={activeFlags.italic} onClick={() => toggleFlag('italic')} label="Italic"><Italic /></ToolbarToggle>
                <ToolbarToggle active={activeFlags.underline} onClick={() => toggleFlag('underline')} label="Underline"><Underline /></ToolbarToggle>
                <span className="mx-1 h-5 w-px bg-border" />
                <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'heading', level: 2, text: 'Heading' })}>
                  <Heading className="size-3.5" /> Heading
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'paragraph', runs: [{ text: '' }] })}>
                  <Plus className="size-3.5" /> Text
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'list', ordered: false, items: ['Item'] })}>
                  <List className="size-3.5" /> List
                </Button>
                <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'table', rows: [['', ''], ['', '']] })}>
                  <TableIcon className="size-3.5" /> Table
                </Button>
              </div>

              {/* Blocks */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {blocks.map((b, i) => (
                  <BlockEditor
                    key={i}
                    block={b}
                    focused={focusedBlock === i}
                    onFocus={() => setFocusedBlock(i)}
                    onChange={(patch) => updateBlock(i, patch)}
                    onRemove={() => removeBlock(i)}
                    onMoveUp={() => moveBlock(i, -1)}
                    onMoveDown={() => moveBlock(i, 1)}
                    onSetAlign={setAlign}
                  />
                ))}
              </div>
              </>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a document, create a new one, or open a .docx.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ToolbarToggle({ active, onClick, label, children }) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? 'default' : 'ghost'}
      className="size-8"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// One block's editor. Headings are an input + level; paragraphs a textarea;
// lists a textarea (one item per line); tables an editable grid.
function BlockEditor({ block, focused, onFocus, onChange, onRemove, onMoveUp, onMoveDown }) {
  const ring = focused ? 'border-primary/60' : 'border-transparent';
  return (
    <div
      className={cn('group rounded-md border bg-card/40 p-2 transition-colors', ring)}
      onFocusCapture={onFocus}
      onClick={onFocus}
    >
      <div className="mb-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <span className="mr-auto text-[10px] uppercase tracking-wide text-muted-foreground">{block.type}</span>
        <IconBtn label="Move up" onClick={onMoveUp}><ArrowUp /></IconBtn>
        <IconBtn label="Move down" onClick={onMoveDown}><ArrowDown /></IconBtn>
        <IconBtn label="Delete block" destructive onClick={onRemove}><Trash2 /></IconBtn>
      </div>

      {block.type === 'heading' && (
        <div className="flex items-center gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ level: Number(e.target.value) })}
            className="h-9 rounded-md border bg-background px-2 text-sm"
            aria-label="Heading level"
          >
            {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>H{l}</option>)}
          </select>
          <Input
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            className="flex-1 font-semibold"
            placeholder="Heading text"
          />
        </div>
      )}

      {block.type === 'paragraph' && (
        <Textarea
          value={runsText(block.runs)}
          onChange={(e) => onChange({ runs: makeRuns(e.target.value, runsFlags(block.runs)) })}
          placeholder="Write here…"
          rows={3}
          className={cn(
            'min-h-16 resize-y',
            block.align === 'center' && 'text-center',
            block.align === 'right' && 'text-right',
            block.align === 'justify' && 'text-justify',
            runsFlags(block.runs).bold && 'font-bold',
            runsFlags(block.runs).italic && 'italic',
            runsFlags(block.runs).underline && 'underline',
          )}
        />
      )}

      {block.type === 'list' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={block.ordered ? 'default' : 'outline'}
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onChange({ ordered: !block.ordered })}
            >
              {block.ordered ? <ListOrdered className="size-3.5" /> : <List className="size-3.5" />}
              {block.ordered ? 'Numbered' : 'Bulleted'}
            </Button>
          </div>
          <Textarea
            value={(block.items || []).join('\n')}
            onChange={(e) => onChange({ items: e.target.value.split('\n') })}
            placeholder="One item per line"
            rows={Math.max(2, (block.items || []).length)}
            className="resize-y font-mono text-sm"
          />
        </div>
      )}

      {block.type === 'table' && (
        <TableEditor rows={block.rows} onChange={(rows) => onChange({ rows })} />
      )}
    </div>
  );
}

function TableEditor({ rows, onChange }) {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  const setCell = (r, c, v) =>
    onChange(rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  const addRow = () => onChange([...rows, Array(cols).fill('')]);
  const addCol = () => onChange(rows.map((r) => [...r, '']));
  const delRow = (r) => onChange(rows.length > 1 ? rows.filter((_, ri) => ri !== r) : rows);
  const delCol = (c) => onChange(cols > 1 ? rows.map((r) => r.filter((_, ci) => ci !== c)) : rows);

  return (
    <div className="space-y-1.5">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="border p-0">
                    <input
                      value={row[c] ?? ''}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      className={cn(
                        'w-full min-w-20 bg-transparent px-2 py-1 outline-none focus:bg-accent/50',
                        r === 0 && 'font-semibold',
                      )}
                      placeholder={r === 0 ? 'Header' : ''}
                    />
                  </td>
                ))}
                <td className="pl-1">
                  <IconBtn label="Delete row" destructive onClick={() => delRow(r)}><Trash2 /></IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={addRow}>
          <Plus className="size-3.5" /> Row
        </Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={addCol}>
          <Plus className="size-3.5" /> Column
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-muted-foreground" onClick={() => delCol(cols - 1)}>
          <Trash2 className="size-3.5" /> Last column
        </Button>
      </div>
    </div>
  );
}

function IconBtn({ label, destructive, onClick, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-6', destructive && 'text-destructive hover:text-destructive')}
      title={label}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {children}
    </Button>
  );
}

// Reader view: renders the document model as a styled, read-only page — what
// the exported .docx will look like. No editing chrome, just the content on a
// centred "sheet".
const HEADING_TAG = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' };
const HEADING_CLASS = {
  1: 'text-3xl font-bold mt-6 mb-3',
  2: 'text-2xl font-bold mt-5 mb-2.5',
  3: 'text-xl font-semibold mt-4 mb-2',
  4: 'text-lg font-semibold mt-3 mb-2',
  5: 'text-base font-semibold mt-3 mb-1.5',
  6: 'text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1.5',
};
const ALIGN_CLASS = {
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

function ReaderRuns({ runs }) {
  return (
    <>
      {(runs || []).map((r, i) => (
        <span
          key={i}
          className={cn(
            r.bold && 'font-bold',
            r.italic && 'italic',
            r.underline && 'underline',
          )}
        >
          {r.text}
        </span>
      ))}
    </>
  );
}

function ReaderView({ doc }) {
  const blocks = doc?.blocks || [];
  return (
    <div className="mx-auto my-4 max-w-[46rem] rounded-lg border bg-card px-8 py-10 leading-relaxed shadow-sm sm:px-12">
      {blocks.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">This document is empty.</p>
      )}
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const lvl = Math.min(6, Math.max(1, b.level || 1));
          const Tag = HEADING_TAG[lvl];
          return <Tag key={i} className={HEADING_CLASS[lvl]}>{b.text}</Tag>;
        }
        if (b.type === 'paragraph') {
          const text = runsText(b.runs);
          if (!text.trim()) return <div key={i} className="h-4" />;
          return (
            <p key={i} className={cn('my-2.5', ALIGN_CLASS[b.align])}>
              <ReaderRuns runs={b.runs} />
            </p>
          );
        }
        if (b.type === 'list') {
          const items = b.items || [];
          return b.ordered ? (
            <ol key={i} className="my-2.5 list-decimal space-y-1 pl-6">
              {items.map((it, j) => <li key={j}>{it}</li>)}
            </ol>
          ) : (
            <ul key={i} className="my-2.5 list-disc space-y-1 pl-6">
              {items.map((it, j) => <li key={j}>{it}</li>)}
            </ul>
          );
        }
        if (b.type === 'table') {
          const rows = b.rows || [];
          return (
            <div key={i} className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {rows.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => {
                        const Cell = r === 0 ? 'th' : 'td';
                        return (
                          <Cell
                            key={c}
                            className={cn(
                              'border px-3 py-1.5 text-left align-top',
                              r === 0 && 'bg-muted font-semibold',
                            )}
                          >
                            {cell}
                          </Cell>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default WordApp;
