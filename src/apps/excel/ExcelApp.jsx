import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, FileDown, PanelLeftClose, PanelLeftOpen, Plus, Sheet as SheetIcon, Trash2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, downloadText, readFileBytes, readFileText, MIME } from '@/lib/office';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

const MIN_ROWS = 12;
const MIN_COLS = 6;
const MAX_IMPORT_BYTES = 40 * 1024 * 1024;

// Virtual-grid geometry (px).
const ROW_H = 28;
const COL_W = 104;
const HEADER_H = 26;
const GUTTER_W = 52;
const OVERSCAN = 6; // extra rows/cols rendered beyond the viewport, each side

const blankSheet = (name = 'Sheet1') => ({ name, rows: [] });
const blankBook = () => ({ sheets: [blankSheet()] });

const newId = () =>
  `x-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Spreadsheet column label: 0→A, 25→Z, 26→AA…
function colLabel(n) {
  let s = '';
  let i = n;
  do {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

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

// The Excel (spreadsheet) app. Same app-and-widget model as the rest: one
// container-query component, a native `Workbook` model in the synced workspace
// store, and the WASM office core for real .xlsx import/export. Numbers,
// `=formulas` and text are inferred per cell at export time.
function ExcelApp() {
  const [books, setBooks] = useStore('excelBooks', []);
  const [selectedId, setSelectedId] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const selected = books.find((b) => b.id === selectedId) || null;

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...books].sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0)),
    [books],
  );

  const touch = (id, wb) =>
    setBooks(books.map((b) => (b.id === id ? { ...b, wb, updatedMs: Date.now() } : b)));

  const createBook = (name = 'Untitled', wb = blankBook()) => {
    const id = newId();
    setBooks([{ id, name, wb, updatedMs: Date.now() }, ...books]);
    setSelectedId(id);
    setActiveSheet(0);
    if (narrow) setSidebarOpen(false);
    return id;
  };

  const rename = (id, name) => setBooks(books.map((b) => (b.id === id ? { ...b, name } : b)));

  const remove = (id) => {
    setBooks(books.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success('Workbook deleted');
  };

  const openBook = (id) => {
    setSelectedId(id);
    setActiveSheet(0);
    if (narrow) setSidebarOpen(false);
  };

  // ---- sheet + cell editing ----
  const sheets = selected?.wb?.sheets || [];
  const sheet = sheets[activeSheet] || sheets[0] || blankSheet();
  const rows = sheet.rows || [];

  const setSheets = (next) => selected && touch(selected.id, { sheets: next });
  const updateSheet = (idx, patch) =>
    setSheets(sheets.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  // Grid dimensions. Memoised on `rows` so scanning for the widest row (O(rows))
  // doesn't run on every render — important for large imported sheets.
  const displayRows = Math.max(MIN_ROWS, rows.length + 1);
  const displayCols = useMemo(
    () => Math.max(MIN_COLS, rows.reduce((m, r) => Math.max(m, r.length), 0) + 1),
    [rows],
  );

  // Edit one cell. Copies only the outer array + the single touched row (not a
  // deep clone of the whole grid), so editing a 100k-row sheet stays cheap.
  const setCell = (r, c, v) => {
    const next = rows.slice();
    while (next.length <= r) next.push([]);
    const row = next[r].slice();
    while (row.length <= c) row.push('');
    row[c] = v;
    next[r] = row;
    updateSheet(activeSheet, { rows: next });
  };

  const addSheet = () => {
    const name = `Sheet${sheets.length + 1}`;
    setSheets([...sheets, blankSheet(name)]);
    setActiveSheet(sheets.length);
  };
  const renameSheet = (idx, name) => updateSheet(idx, { name });
  const deleteSheet = (idx) => {
    if (sheets.length <= 1) return;
    setSheets(sheets.filter((_, i) => i !== idx));
    setActiveSheet((a) => Math.max(0, Math.min(a, sheets.length - 2)));
  };

  // ---- import / export ----
  const onPickFile = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Guard against pathological files that would exhaust memory. 40 MB of
    // spreadsheet is already hundreds of thousands of rows; the grid handles
    // that fine, but we refuse the truly absurd rather than crash.
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(`File too large (${(file.size / 1e6).toFixed(0)} MB). Max ${MAX_IMPORT_BYTES / 1e6} MB.`);
      return;
    }
    setBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const base = file.name.replace(/\.(csv|xlsx|xls|xlsb|ods)$/i, '') || 'Imported';
      let wb;
      if (isCsv) {
        const rows = await office.csvImport(await readFileText(file));
        wb = { sheets: [{ name: base.slice(0, 31) || 'Sheet1', rows }] };
      } else {
        wb = await office.excelImport(await readFileBytes(file));
      }
      createBook(base, wb);
      toast.success(`Imported "${base}"`);
    } catch (err) {
      toast.error(`Couldn't open that file: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const exportBook = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const bytes = await office.excelExport(selected.wb);
      downloadBytes(bytes, `${selected.name || 'workbook'}.xlsx`, MIME.xlsx);
      toast.success('Saved .xlsx');
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
      const bytes = await office.excelPdf(selected.wb);
      downloadBytes(bytes, `${selected.name || 'workbook'}.pdf`, MIME.pdf);
      toast.success('Exported PDF');
    } catch (err) {
      toast.error(`PDF export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  // CSV is a single table, so this exports the active sheet only.
  const exportCsv = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const text = await office.csvExport(sheet.rows || []);
      downloadText(text, `${selected.name || 'workbook'}-${sheet.name}.csv`, MIME.csv);
      toast.success('Saved .csv (active sheet)');
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };

  const hasDetail = !!selected;
  const showDetail = narrow ? hasDetail && !sidebarOpen : true;
  const showSidebar = narrow ? !showDetail : sidebarOpen;

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0">
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsb,.ods,.csv" className="hidden" onChange={onFile} />

      {/* Sidebar — workbook list */}
      {showSidebar && (
        <aside className={cn('flex min-h-0 flex-col gap-3', narrow ? 'w-full' : 'w-64 shrink-0 pr-3')}>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => createBook()}>
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
                  No workbooks yet. 📊
                </CardContent>
              </Card>
            ) : (
              sorted.map((b) => (
                <Card
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openBook(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(b.id); }
                  }}
                  className={cn(
                    'cursor-pointer gap-1 py-3 transition-colors hover:border-primary/40',
                    selectedId === b.id && 'border-primary/60',
                  )}
                >
                  <CardContent className="flex items-start justify-between gap-2 px-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <SheetIcon className="size-4 shrink-0 text-muted-foreground" />
                        {b.name || 'Untitled'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(b.wb?.sheets?.length || 0)} sheet(s) · {relativeTime(b.updatedMs)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Delete ${b.name || 'workbook'}`}
                      onClick={(e) => { e.stopPropagation(); remove(b.id); }}
                    >
                      <Trash2 />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </aside>
      )}

      {/* Detail — the grid editor */}
      {showDetail && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="mb-2 flex shrink-0 items-center gap-2 border-b pb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label={showSidebar ? 'Hide list' : 'Show list'}
                >
                  {showSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
                </Button>
                <Input
                  value={selected.name}
                  onChange={(e) => rename(selected.id, e.target.value)}
                  className="h-8 min-w-0 flex-1 font-medium"
                  aria-label="Workbook name"
                />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPdf} disabled={busy} title="Export as PDF">
                  <FileDown /> PDF
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={busy} title="Export the active sheet as .csv">
                  <Download /> CSV
                </Button>
                <Button size="sm" className="gap-1.5" onClick={exportBook} disabled={busy} title="Save as .xlsx">
                  <Download /> Save
                </Button>
              </div>

              {/* Grid — virtualized: only the visible window of cells is in the
                  DOM, so even a 100k-row import stays smooth and never crashes. */}
              <VirtualGrid
                key={`${selected.id}:${activeSheet}`}
                rows={rows}
                displayRows={displayRows}
                displayCols={displayCols}
                onCell={setCell}
              />
              <p className="mt-1 shrink-0 text-[11px] text-muted-foreground">
                {rows.length.toLocaleString()} rows × {Math.max(0, displayCols - 1)} cols
              </p>

              {/* Sheet tabs */}
              <div className="mt-2 flex shrink-0 items-center gap-1 overflow-x-auto border-t pt-2">
                {sheets.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      'group flex shrink-0 items-center gap-0.5 rounded-md border px-1 pl-2 text-sm',
                      i === activeSheet ? 'border-primary/60 bg-accent' : 'border-transparent hover:bg-accent/50',
                    )}
                  >
                    <button
                      type="button"
                      className="max-w-32 truncate py-1"
                      onClick={() => setActiveSheet(i)}
                      onDoubleClick={() => {
                        const name = window.prompt('Sheet name', s.name);
                        if (name) renameSheet(i, name);
                      }}
                      title="Click to open · double-click to rename"
                    >
                      {s.name}
                    </button>
                    {sheets.length > 1 && (
                      <button
                        type="button"
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => deleteSheet(i)}
                        aria-label={`Delete ${s.name}`}
                      >
                        <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={addSheet} aria-label="Add sheet">
                  <Plus />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Select a workbook, create a new one, or open an .xlsx.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// A windowed spreadsheet grid. Only the cells inside (viewport + overscan) are
// mounted; the scroll surface is sized to the full grid via a spacer, and
// frozen column headers / row numbers track the scroll offset. This keeps the
// DOM at a few hundred inputs no matter how large the sheet is.
function VirtualGrid({ rows, displayRows, displayCols, onCell }) {
  const scrollRef = useRef(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const totalH = displayRows * ROW_H;
  const totalW = displayCols * COL_W;

  const startRow = Math.max(0, Math.floor(scroll.top / ROW_H) - OVERSCAN);
  const endRow = Math.min(displayRows, Math.ceil((scroll.top + size.h) / ROW_H) + OVERSCAN);
  const startCol = Math.max(0, Math.floor(scroll.left / COL_W) - OVERSCAN);
  const endCol = Math.min(displayCols, Math.ceil((scroll.left + size.w) / COL_W) + OVERSCAN);

  const rowIdx = [];
  for (let r = startRow; r < endRow; r++) rowIdx.push(r);
  const colIdx = [];
  for (let c = startCol; c < endCol; c++) colIdx.push(c);

  const onScroll = (e) =>
    setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
      {/* Corner */}
      <div
        className="absolute left-0 top-0 z-30 border-b border-r bg-muted"
        style={{ width: GUTTER_W, height: HEADER_H }}
      />
      {/* Column headers (frozen top, follow horizontal scroll) */}
      <div
        className="absolute top-0 z-20 overflow-hidden border-b bg-muted"
        style={{ left: GUTTER_W, right: 0, height: HEADER_H }}
      >
        <div style={{ width: totalW, height: HEADER_H, transform: `translateX(${-scroll.left}px)` }} className="relative">
          {colIdx.map((c) => (
            <div
              key={c}
              className="absolute top-0 flex items-center justify-center border-r text-xs font-medium text-muted-foreground"
              style={{ left: c * COL_W, width: COL_W, height: HEADER_H }}
            >
              {colLabel(c)}
            </div>
          ))}
        </div>
      </div>
      {/* Row numbers (frozen left, follow vertical scroll) */}
      <div
        className="absolute left-0 z-20 overflow-hidden border-r bg-muted"
        style={{ top: HEADER_H, bottom: 0, width: GUTTER_W }}
      >
        <div style={{ height: totalH, transform: `translateY(${-scroll.top}px)` }} className="relative">
          {rowIdx.map((r) => (
            <div
              key={r}
              className="absolute left-0 flex items-center justify-center border-b text-xs text-muted-foreground"
              style={{ top: r * ROW_H, width: GUTTER_W, height: ROW_H }}
            >
              {r + 1}
            </div>
          ))}
        </div>
      </div>
      {/* Scrollable body */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="absolute overflow-auto"
        style={{ left: GUTTER_W, top: HEADER_H, right: 0, bottom: 0 }}
      >
        <div style={{ width: totalW, height: totalH }} className="relative">
          {rowIdx.map((r) =>
            colIdx.map((c) => (
              <input
                key={`${r}:${c}`}
                value={rows[r]?.[c] ?? ''}
                onChange={(e) => onCell(r, c, e.target.value)}
                className={cn(
                  'absolute border-b border-r bg-transparent px-2 text-sm outline-none focus:z-10 focus:bg-accent/60 focus:ring-1 focus:ring-primary',
                  r === 0 && 'font-semibold',
                )}
                style={{ top: r * ROW_H, left: c * COL_W, width: COL_W, height: ROW_H }}
              />
            )),
          )}
        </div>
      </div>
    </div>
  );
}

export default ExcelApp;
