import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Copy, Download, FileDown, Image as ImageIcon, List as ListIcon,
  PanelLeftClose, PanelLeftOpen, Plus, Presentation as PresentationIcon,
  Table as TableIcon, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, readFileBytes, MIME } from '@/lib/office';
import { humanDuration } from '@/lib/image-shared';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { cn } from '@/lib/utils';
import { useSidebarShortcut } from '@/lib/sidebarShortcut';
import { ShortcutTip } from '@/components/ShortcutTip';
import { SidebarShell } from '@/components/SidebarShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

const LAYOUTS = [
  { id: 'title', label: 'Title' },
  { id: 'titleContent', label: 'Title + Content' },
  { id: 'section', label: 'Section' },
  { id: 'blank', label: 'Blank' },
];

const newSlide = (layout = 'titleContent') => ({
  layout, title: '', subtitle: '', content: [], notes: '',
});
const blankPres = () => ({ slides: [newSlide('title')] });
const newId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Bullets <-> textarea text. Each line is a bullet; two leading spaces = one
// indent level (max 4).
const bulletsToText = (items) =>
  (items || []).map((b) => '  '.repeat(Math.min(4, b.level || 0)) + b.text).join('\n');
const textToBullets = (text) =>
  text
    .split('\n')
    .map((line) => {
      const lead = line.match(/^ */)[0].length;
      return { text: line.trim(), level: Math.min(4, Math.floor(lead / 2)) };
    })
    .filter((b) => b.text.length > 0);

const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });

function slideSummary(s) {
  if (s.title?.trim()) return s.title.trim();
  const b = s.content?.find((x) => x.type === 'bullets');
  if (b?.items?.[0]?.text) return b.items[0].text;
  return 'Untitled slide';
}

// The PowerPoint app. Same app-and-widget shape as the rest: a native
// Presentation model in the synced workspace store, and the office WASM core for
// real .pptx import/export + PDF export. A deck list (sidebar) → a slide rail +
// per-slide editor.
function PptApp() {
  const [decks, setDecks] = useStore('pptDecks', []);
  const [selectedId, setSelectedId] = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const imgRef = useRef(null);

  const selected = decks.find((d) => d.id === selectedId) || null;
  const slides = selected?.pres?.slides || [];
  const slide = slides[slideIdx] || slides[0] || null;

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useSidebarShortcut(rootRef, setSidebarOpen);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...decks].sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0)),
    [decks],
  );

  const touch = (id, pres) =>
    setDecks(decks.map((d) => (d.id === id ? { ...d, pres, updatedMs: Date.now() } : d)));

  const createDeck = (name = 'Untitled', pres = blankPres()) => {
    const id = newId();
    setDecks([{ id, name, pres, updatedMs: Date.now() }, ...decks]);
    setSelectedId(id);
    setSlideIdx(0);
    if (narrow) setSidebarOpen(false);
    return id;
  };
  const rename = (id, name) => setDecks(decks.map((d) => (d.id === id ? { ...d, name } : d)));
  const remove = (id) => {
    setDecks(decks.filter((d) => d.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success('Deck deleted');
  };
  const openDeck = (id) => {
    setSelectedId(id);
    setSlideIdx(0);
    if (narrow) setSidebarOpen(false);
  };

  // ---- slide operations ----
  const setSlides = (next) => selected && touch(selected.id, { slides: next });
  const updateSlide = (i, patch) => setSlides(slides.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addSlide = () => {
    const next = [...slides.slice(0, slideIdx + 1), newSlide(), ...slides.slice(slideIdx + 1)];
    setSlides(next);
    setSlideIdx(slideIdx + 1);
  };
  const duplicateSlide = () => {
    if (!slide) return;
    const copy = JSON.parse(JSON.stringify(slide));
    const next = [...slides.slice(0, slideIdx + 1), copy, ...slides.slice(slideIdx + 1)];
    setSlides(next);
    setSlideIdx(slideIdx + 1);
  };
  const deleteSlide = (i) => {
    const next = slides.filter((_, idx) => idx !== i);
    setSlides(next.length ? next : blankPres().slides);
    setSlideIdx((s) => Math.max(0, Math.min(s, next.length - 1)));
  };
  const moveSlide = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const next = [...slides];
    [next[i], next[j]] = [next[j], next[i]];
    setSlides(next);
    setSlideIdx(j);
  };

  // ---- content-block operations (on current slide) ----
  const setBlocks = (blocks) => updateSlide(slideIdx, { content: blocks });
  const blocks = slide?.content || [];
  const addBlock = (block) => setBlocks([...blocks, block]);
  const updateBlock = (bi, patch) => setBlocks(blocks.map((b, idx) => (idx === bi ? { ...b, ...patch } : b)));
  const removeBlock = (bi) => setBlocks(blocks.filter((_, idx) => idx !== bi));

  const onAddImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = await readAsBase64(file);
      addBlock({ type: 'image', data, mime: file.type || 'image/png' });
    } catch {
      toast.error('Could not read image');
    }
  };

  // ---- import / export ----
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await readFileBytes(file);
      const t0 = performance.now();
      const pres = await office.pptImport(bytes);
      const ms = performance.now() - t0;
      const name = file.name.replace(/\.pptx$/i, '') || 'Imported';
      createDeck(name, pres);
      toast.success(`Imported "${name}" · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Couldn't open that file: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };
  const exportPptx = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const t0 = performance.now();
      const bytes = await office.pptExport(selected.pres);
      const ms = performance.now() - t0;
      downloadBytes(bytes, `${selected.name || 'presentation'}.pptx`, MIME.pptx);
      toast.success(`Saved .pptx · ${humanDuration(ms)}`);
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
      const bytes = await office.pptPdf(selected.pres);
      const ms = performance.now() - t0;
      downloadBytes(bytes, `${selected.name || 'presentation'}.pdf`, MIME.pdf);
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
  const showContent = slide && slide.layout !== 'title' && slide.layout !== 'section';
  const showSubtitle = slide && (slide.layout === 'title' || slide.layout === 'section');

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0">
      <input ref={fileRef} type="file" accept=".pptx" className="hidden" onChange={onFile} />
      <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={onAddImage} />

      {/* Sidebar — deck list */}
      {(narrow ? showSidebar : true) && (
        <SidebarShell narrow={narrow} open={sidebarOpen} width={240}>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => createDeck()}>
              <Plus /> New
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload /> Open
            </Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sorted.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No presentations yet. 📽️
                </CardContent>
              </Card>
            ) : (
              sorted.map((d) => (
                <Card
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDeck(d.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDeck(d.id); } }}
                  className={cn('cursor-pointer gap-1 py-3 transition-colors hover:border-primary/40', selectedId === d.id && 'border-primary/60')}
                >
                  <CardContent className="flex items-start justify-between gap-2 px-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <PresentationIcon className="size-4 shrink-0 text-muted-foreground" />
                        {d.name || 'Untitled'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{d.pres?.slides?.length || 0} slides</p>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="size-7 shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Delete ${d.name || 'deck'}`}
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

      {/* Detail — slide rail + editor */}
      {showDetail && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected && slide ? (
            <>
              <div className="mb-2 flex shrink-0 items-center gap-2 border-b pb-2">
                <ShortcutTip label={`${showSidebar ? 'Hide' : 'Show'} sidebar · Shift+B`}>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setSidebarOpen((o) => !o)} aria-label={showSidebar ? 'Hide list' : 'Show list'}>
                    {showSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
                  </Button>
                </ShortcutTip>
                <Input value={selected.name} onChange={(e) => rename(selected.id, e.target.value)} className="h-8 min-w-0 flex-1 font-medium" aria-label="Deck name" />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPdf} disabled={busy} title="Export as PDF"><FileDown /> PDF</Button>
                <Button size="sm" className="gap-1.5" onClick={exportPptx} disabled={busy} title="Save as .pptx"><Download /> Save</Button>
              </div>

              <div className="flex min-h-0 flex-1 gap-3">
                {/* Slide rail */}
                <div className="flex w-36 shrink-0 flex-col gap-2">
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 px-1.5 text-xs" onClick={addSlide}><Plus className="size-3.5" /> Slide</Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={duplicateSlide} title="Duplicate slide"><Copy className="size-3.5" /></Button>
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    {slides.map((s, i) => (
                      <div
                        key={i}
                        onClick={() => setSlideIdx(i)}
                        className={cn(
                          'group relative cursor-pointer rounded-md border bg-card p-2 text-xs transition-colors hover:border-primary/40',
                          i === slideIdx && 'border-primary/70 ring-1 ring-primary/40',
                        )}
                      >
                        <div className="flex items-start gap-1">
                          <span className="shrink-0 text-muted-foreground">{i + 1}.</span>
                          <span className="line-clamp-2 flex-1 font-medium">{slideSummary(s)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button type="button" className="rounded p-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }} aria-label="Move up"><ArrowUp className="size-3" /></button>
                          <button type="button" className="rounded p-0.5 hover:bg-accent" onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }} aria-label="Move down"><ArrowDown className="size-3" /></button>
                          <button type="button" className="ml-auto rounded p-0.5 text-destructive hover:bg-accent" onClick={(e) => { e.stopPropagation(); deleteSlide(i); }} aria-label="Delete slide"><Trash2 className="size-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slide editor */}
                <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {/* Layout selector */}
                  <div className="flex flex-wrap gap-1">
                    {LAYOUTS.map((l) => (
                      <Button
                        key={l.id}
                        size="sm"
                        variant={slide.layout === l.id ? 'default' : 'outline'}
                        className="h-7 px-2 text-xs"
                        onClick={() => updateSlide(slideIdx, { layout: l.id })}
                      >
                        {l.label}
                      </Button>
                    ))}
                  </div>

                  <Input
                    value={slide.title}
                    onChange={(e) => updateSlide(slideIdx, { title: e.target.value })}
                    placeholder="Slide title"
                    className="font-semibold"
                  />
                  {showSubtitle && (
                    <Input
                      value={slide.subtitle}
                      onChange={(e) => updateSlide(slideIdx, { subtitle: e.target.value })}
                      placeholder="Subtitle"
                    />
                  )}

                  {showContent && (
                    <>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'bullets', items: [] })}><ListIcon className="size-3.5" /> Bullets</Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => addBlock({ type: 'table', rows: [['', ''], ['', '']] })}><TableIcon className="size-3.5" /> Table</Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => imgRef.current?.click()}><ImageIcon className="size-3.5" /> Image</Button>
                      </div>
                      {blocks.length === 0 && (
                        <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                          Add bullets, a table or an image.
                        </p>
                      )}
                      {blocks.map((b, bi) => (
                        <BlockEditor key={bi} block={b} onChange={(patch) => updateBlock(bi, patch)} onRemove={() => removeBlock(bi)} />
                      ))}
                    </>
                  )}

                  {/* Speaker notes */}
                  <div className="pt-1">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Speaker notes</p>
                    <Textarea
                      value={slide.notes}
                      onChange={(e) => updateSlide(slideIdx, { notes: e.target.value })}
                      placeholder="Notes for this slide…"
                      rows={2}
                      className="resize-y text-sm"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a presentation, create a new one, or open a .pptx.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function BlockEditor({ block, onChange, onRemove }) {
  return (
    <div className="group rounded-md border bg-card/40 p-2">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{block.type}</span>
        <Button type="button" variant="ghost" size="icon" className="ml-auto size-6 text-destructive hover:text-destructive" onClick={onRemove} aria-label="Delete block">
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {block.type === 'bullets' && (
        <Textarea
          value={bulletsToText(block.items)}
          onChange={(e) => onChange({ items: textToBullets(e.target.value) })}
          placeholder={'One bullet per line\n  Indent with two spaces for sub-points'}
          rows={Math.max(3, (block.items || []).length + 1)}
          className="resize-y font-mono text-sm"
        />
      )}

      {block.type === 'table' && (
        <TableEditor rows={block.rows} onChange={(rows) => onChange({ rows })} />
      )}

      {block.type === 'image' && (
        <img
          src={`data:${block.mime || 'image/png'};base64,${block.data}`}
          alt="Slide"
          className="max-h-48 rounded border object-contain"
        />
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
                      className={cn('w-full min-w-20 bg-transparent px-2 py-1 outline-none focus:bg-accent/50', r === 0 && 'font-semibold')}
                      placeholder={r === 0 ? 'Header' : ''}
                    />
                  </td>
                ))}
                <td className="pl-1">
                  <Button type="button" variant="ghost" size="icon" className="size-6 text-destructive hover:text-destructive" onClick={() => delRow(r)} aria-label="Delete row"><Trash2 className="size-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={addRow}><Plus className="size-3.5" /> Row</Button>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={addCol}><Plus className="size-3.5" /> Column</Button>
      </div>
    </div>
  );
}

export default PptApp;
