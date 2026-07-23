import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter, AlignLeft, AlignRight, BarChart3, Baseline, Bold, ChevronDown, Download, Droplet,
  FileDown, Filter, Italic, ListChecks, PaintBucket, PanelLeftClose, PanelLeftOpen, Plus, Redo2,
  Search, Sheet as SheetIcon, Snowflake, Table2, Trash2, Underline, Undo2, Upload, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { office, downloadBytes, downloadText, readFileBytes, readFileText, MIME } from '@/lib/office';
import { humanDuration } from '@/lib/image-shared';
import { newId as genId } from '@/lib/id';
import { useStore } from '@/lib/store/WorkspaceProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { createEngine } from './engine';
import { translateFormula } from './formula';
import {
  NUMBER_FORMATS, insertRows, deleteRows, insertCols, deleteCols, sortRange, patchFmts,
} from './fmt';
import { buildCond, condStyle, COND_KINDS } from './cond';
import { validationAt, checkValue, VALIDATION_KINDS } from './validation';
import { buildPivot, PIVOT_AGGS } from './pivot';
import { useSidebarShortcut } from '@/lib/sidebarShortcut';
import { consumeOpen } from '@/lib/openWith';
import { ShortcutTip } from '@/components/ShortcutTip';
import { SidebarShell } from '@/components/SidebarShell';

const MIN_ROWS = 100;
const MIN_COLS = 26;
const MAX_ROWS = 1_048_576;
const MAX_COLS = 16_384;
const MAX_IMPORT_BYTES = 40 * 1024 * 1024;

const ROW_H = 26;
const COL_W = 104;
const MIN_COL_W = 44;
const HEADER_H = 26;
const GUTTER_W = 52;
const OVERSCAN = 6;

const blankSheet = (name = 'Sheet1') => ({ name, rows: [], fmts: {}, colWidths: {}, merges: [] });
const blankBook = () => ({ sheets: [blankSheet()] });

const newId = () => genId('x');

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const normRange = (a, b) => ({
  r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c),
  r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c),
});

// Excel's signature green — used for the active cell, selected headers and the
// fill handle so the grid reads as "Excel" at a glance.
const EXCEL_GREEN = '#217346';

const numToStrLocal = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(15))));

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
  useSidebarShortcut(rootRef, setSidebarOpen);
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
  // Opened from Drive ("Open in Excel") — import the handed-off spreadsheet.
  useEffect(() => {
    const pending = consumeOpen('excel');
    if (!pending) return;
    (async () => {
      try {
        const base = pending.name.replace(/\.(xlsx?|xlsb|ods|csv)$/i, '');
        let wb;
        if (/\.csv$/i.test(pending.name)) {
          const text = new TextDecoder().decode(pending.bytes);
          wb = { sheets: [{ name: base.slice(0, 31) || 'Sheet1', rows: await office.csvImport(text) }] };
        } else {
          wb = await office.excelImport(pending.bytes);
        }
        createBook(base, wb);
        toast.success(`Opened "${pending.name}"`);
      } catch (err) { toast.error(`Couldn't open "${pending.name}": ${err.message || err}`); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ---- sheet + cell model ----
  const sheets = selected?.wb?.sheets || [];
  const sheet = sheets[activeSheet] || sheets[0] || blankSheet();
  const rows = sheet.rows || [];
  const engine = useMemo(() => createEngine(sheets), [sheets]);

  // Precomputed conditional-formatting rules (with per-range stats).
  const cfRules = useMemo(
    () => buildCond(sheet.condFmt, (r, c) => { const v = engine.value(activeSheet, r, c); if (typeof v === 'number') return v; const n = Number(v); return Number.isNaN(n) ? null : n; }),
    [sheet.condFmt, engine, activeSheet, rows],
  );

  // ---- selection & editing ----
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState(null);
  const [menu, setMenu] = useState(null); // { x, y }
  const [dialog, setDialog] = useState(null); // 'find' | 'chart'
  const [fillTo, setFillTo] = useState(null); // { r, c } live fill-handle target
  const gridApiRef = useRef(null);

  useEffect(() => {
    setSel({ r: 0, c: 0 });
    setAnchor({ r: 0, c: 0 });
    setEditing(null);
    setMenu(null);
  }, [selectedId, activeSheet]);

  const range = useMemo(() => normRange(anchor, sel), [anchor, sel]);

  // ---- undo / redo (whole-sheet snapshots, per book + sheet) ----
  const histRef = useRef(new Map());
  const histKey = `${selectedId}:${activeSheet}`;
  const hist = () => {
    let h = histRef.current.get(histKey);
    if (!h) { h = { undo: [], redo: [] }; histRef.current.set(histKey, h); }
    return h;
  };
  const [, forceHist] = useState(0);

  const setSheets = (next) => selected && touch(selected.id, { sheets: next });
  const applySheet = (ns) => setSheets(sheets.map((s, i) => (i === activeSheet ? ns : s)));

  // Every structural/content edit funnels through here so it's undoable.
  const mutateSheet = useCallback((producer) => {
    const cur = sheet;
    const next = producer(cur);
    if (next === cur) return;
    const h = hist();
    h.undo.push(cur);
    if (h.undo.length > 200) h.undo.shift();
    h.redo.length = 0;
    applySheet(next);
    forceHist((n) => n + 1);
  }, [sheet, sheets, activeSheet, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(() => {
    const h = hist();
    if (!h.undo.length) return;
    h.redo.push(sheet);
    applySheet(h.undo.pop());
    forceHist((n) => n + 1);
  }, [sheet, sheets, activeSheet, selected]); // eslint-disable-line react-hooks/exhaustive-deps
  const redo = useCallback(() => {
    const h = hist();
    if (!h.redo.length) return;
    h.undo.push(sheet);
    applySheet(h.redo.pop());
    forceHist((n) => n + 1);
  }, [sheet, sheets, activeSheet, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // rows-only mutation helper
  const mutate = (producer) => mutateSheet((s) => {
    const nr = producer(s.rows || []);
    return nr === (s.rows || []) ? s : { ...s, rows: nr };
  });

  const writeCell = (src, r, c, v) => {
    const next = src.slice();
    while (next.length <= r) next.push([]);
    const row = next[r].slice();
    while (row.length <= c) row.push('');
    row[c] = v;
    next[r] = row;
    return next;
  };
  const setCell = (r, c, v) => mutate((src) => writeCell(src, r, c, v));

  const clearRange = (rg) => mutate((src) => {
    let next = src;
    let touched = false;
    for (let r = rg.r1; r <= rg.r2; r++) {
      if (!next[r]) continue;
      for (let c = rg.c1; c <= rg.c2; c++) {
        if ((next[r][c] ?? '') === '') continue;
        if (next === src) next = src.slice();
        if (next[r] === src[r]) next[r] = src[r].slice();
        next[r][c] = '';
        touched = true;
      }
    }
    return touched ? next : src;
  });

  // ---- formatting ----
  const applyFmt = (patch) => mutateSheet((s) => ({ ...s, fmts: patchFmts(s.fmts, range, patch) }));
  const curFmt = sheet.fmts?.[`${sel.r}:${sel.c}`] || {};
  const toggleFmt = (prop) => applyFmt({ [prop]: !curFmt[prop] });
  const setNumFmt = (code) => applyFmt({ numFmt: code || undefined });

  // ---- structure ops ----
  const doInsertRows = (at, n = 1) => mutateSheet((s) => insertRows(s, at, n));
  const doDeleteRows = (at, n = 1) => mutateSheet((s) => deleteRows(s, at, n));
  const doInsertCols = (at, n = 1) => mutateSheet((s) => insertCols(s, at, n));
  const doDeleteCols = (at, n = 1) => mutateSheet((s) => deleteCols(s, at, n));
  const doSort = (asc) => mutateSheet((s) => sortRange(s, range, range.c1, asc));
  const sortByColumn = (c, asc) => mutateSheet((s) => {
    const af = s.autofilter; if (!af) return s;
    return sortRange(s, { r1: af.range.r1 + 1, c1: af.range.c1, r2: af.range.r2, c2: af.range.c2 }, c, asc);
  });
  const setColWidth = (c, px) => mutateSheet((s) => ({ ...s, colWidths: { ...(s.colWidths || {}), [c]: Math.max(MIN_COL_W, Math.round(px)) } }));

  // Fill handle: extend the selection's values into `target` (down or right),
  // continuing a numeric series when the source is numeric, otherwise copying
  // the pattern with relative formula refs adjusted — like Excel's fill handle.
  const doAutofill = (target) => {
    const src = range;
    const down = target.r > src.r2;
    const right = !down && target.c > src.c2;
    if (!down && !right) return;
    mutate((srcRows) => {
      let next = srcRows;
      const write = (r, c, v) => { next = writeCell(next === srcRows ? srcRows : next, r, c, v); };
      const fillLine = (readAt, writeAt, base, len, count) => {
        const raws = Array.from({ length: len }, (_, i) => readAt(i));
        const nums = raws.map((v) => (v === '' || v == null ? NaN : Number(v)));
        const allNum = raws.every((v) => v !== '' && typeof v !== 'undefined' && !(typeof v === 'string' && v[0] === '=')) && nums.every((n) => !Number.isNaN(n));
        const diff = len >= 2 ? nums[len - 1] - nums[len - 2] : 0;
        for (let j = 0; j < count; j++) {
          const pos = base + 1 + j;
          if (allNum) writeAt(pos, numToStrLocal(nums[len - 1] + diff * (j + 1)));
          else {
            const si = j % len;
            const raw = raws[si];
            const off = pos - (base - (len - 1) + si);
            writeAt(pos, (typeof raw === 'string' && raw[0] === '=') ? translateFormula(raw, down ? off : 0, right ? off : 0) : raw);
          }
        }
      };
      if (down) {
        for (let c = src.c1; c <= src.c2; c++) {
          fillLine((i) => srcRows[src.r1 + i]?.[c] ?? '', (r, v) => write(r, c, v), src.r2, src.r2 - src.r1 + 1, target.r - src.r2);
        }
      } else {
        for (let r = src.r1; r <= src.r2; r++) {
          fillLine((i) => srcRows[r]?.[src.c1 + i] ?? '', (c, v) => write(r, c, v), src.c2, src.c2 - src.c1 + 1, target.c - src.c2);
        }
      }
      return next;
    });
    if (down) setSel({ r: target.r, c: sel.c });
    else setSel({ r: sel.r, c: target.c });
  };

  const isMerged = (sheet.merges || []).some(([r1, c1, r2, c2]) => r1 <= range.r1 && c1 <= range.c1 && r2 >= range.r2 && c2 >= range.c2 && (r1 !== r2 || c1 !== c2));
  const toggleMerge = () => {
    if (range.r1 === range.r2 && range.c1 === range.c2) return;
    mutateSheet((s) => {
      const merges = s.merges || [];
      const overlaps = merges.some(([r1, c1, r2, c2]) => !(r2 < range.r1 || r1 > range.r2 || c2 < range.c1 || c1 > range.c2));
      if (overlaps) return { ...s, merges: merges.filter(([r1, c1, r2, c2]) => (r2 < range.r1 || r1 > range.r2 || c2 < range.c1 || c1 > range.c2)) };
      return { ...s, merges: [...merges, [range.r1, range.c1, range.r2, range.c2]] };
    });
  };
  const toggleFreeze = () => mutateSheet((s) => ({ ...s, freeze: s.freeze && s.freeze[0] === sel.r && s.freeze[1] === sel.c ? undefined : [sel.r, sel.c] }));

  // conditional formatting
  const addCondRule = (rule) => mutateSheet((s) => ({ ...s, condFmt: [...(s.condFmt || []), { ...rule, range: { ...range } }] }));
  const clearCondRules = () => mutateSheet((s) => ({ ...s, condFmt: [] }));

  // data validation
  const addValidation = (rule) => mutateSheet((s) => ({ ...s, validations: [...(s.validations || []), { ...rule, range: { ...range } }] }));
  const clearValidations = () => mutateSheet((s) => ({ ...s, validations: [] }));
  const validationFor = (r, c) => validationAt(sheet.validations, r, c);
  const [listMenu, setListMenu] = useState(null); // { r, c, x, y, list }

  // pivot table → new sheet
  const makePivot = (opts) => {
    const grid = buildPivot(range, (r, c) => engine.typed(activeSheet, r, c).text, opts);
    const name = `Pivot${sheets.length + 1}`;
    setSheets([...sheets, { name, rows: grid, fmts: {}, colWidths: {}, merges: [] }]);
    setActiveSheet(sheets.length);
    setDialog(null);
    toast.success('Pivot table created');
  };

  // ---- AutoFilter ----
  const [filterMenu, setFilterMenu] = useState(null); // { c, x, y }
  const toggleFilter = () => mutateSheet((s) => {
    if (s.autofilter) return { ...s, autofilter: undefined };
    const rg = (range.r1 === range.r2 && range.c1 === range.c2)
      ? { r1: 0, c1: 0, r2: Math.max(0, (s.rows || []).length - 1), c2: Math.max(0, dataCols - 1) }
      : { ...range };
    return { ...s, autofilter: { range: rg, cols: {} } };
  });
  const setColFilter = (c, allowed) => mutateSheet((s) => {
    const af = s.autofilter; if (!af) return s;
    const cols = { ...af.cols };
    if (allowed === null) delete cols[c]; else cols[c] = allowed;
    return { ...s, autofilter: { ...af, cols } };
  });
  const uniqueValuesFor = (c) => {
    const af = sheet.autofilter; if (!af) return [];
    const set = new Set();
    for (let r = af.range.r1 + 1; r <= af.range.r2; r++) set.add(engine.typed(activeSheet, r, c).text);
    return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  };

  // ---- find & replace ----
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const replaceAll = () => {
    if (!findText) return;
    let count = 0;
    mutate((src) => {
      const next = src.map((row) => row.map((cell) => {
        const str = String(cell ?? '');
        if (!str) return cell;
        let out; let hit = false;
        if (matchCase) { out = str.split(findText).join(replaceText); hit = out !== str; }
        else {
          const rx = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          out = str.replace(rx, () => { hit = true; return replaceText; });
        }
        if (hit) count++;
        return out;
      }));
      return count ? next : src;
    });
    toast.success(count ? `Replaced ${count} cell(s)` : 'No matches');
  };

  // ---- grid geometry ----
  const dataCols = useMemo(() => rows.reduce((m, r) => Math.max(m, r.length), 0), [rows]);
  const displayRows = clamp(Math.max(MIN_ROWS, rows.length + 1, sel.r + 2, range.r2 + 2), 1, MAX_ROWS);
  const displayCols = clamp(Math.max(MIN_COLS, dataCols + 1, sel.c + 2, range.c2 + 2), 1, MAX_COLS);

  // Visible rows after AutoFilter (null = no filtering → identity fast path).
  const visRows = useMemo(() => {
    const af = sheet.autofilter;
    if (!af || !af.cols || Object.keys(af.cols).length === 0) return null;
    const out = [];
    for (let r = 0; r < displayRows; r++) {
      if (r > af.range.r1 && r <= af.range.r2) {
        let ok = true;
        for (const c of Object.keys(af.cols)) {
          const allowed = af.cols[c];
          if (allowed && !allowed.includes(engine.typed(activeSheet, r, Number(c)).text)) { ok = false; break; }
        }
        if (!ok) continue;
      }
      out.push(r);
    }
    return out;
  }, [sheet.autofilter, rows, displayRows, engine, activeSheet]);
  const posMap = useMemo(() => { if (!visRows) return null; const m = new Map(); visRows.forEach((r, i) => m.set(r, i)); return m; }, [visRows]);
  const posCount = visRows ? visRows.length : displayRows;
  const posToRow = (p) => (visRows ? (visRows[clamp(p, 0, visRows.length - 1)] ?? 0) : clamp(p, 0, MAX_ROWS - 1));
  const rowToPos = (r) => {
    if (!visRows) return r;
    if (posMap.has(r)) return posMap.get(r);
    let lo = 0; let hi = visRows.length - 1; let ans = 0;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (visRows[mid] <= r) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  };
  // Let the memoised move/goto read the latest view mapping without re-creating.
  const viewRef = useRef({});
  viewRef.current = { visRows, posToRow, rowToPos };

  const move = useCallback((dr, dc, extend) => {
    setSel((prev) => {
      const v = viewRef.current;
      const r = (dr !== 0 && v.visRows) ? v.posToRow(v.rowToPos(prev.r) + dr) : clamp(prev.r + dr, 0, MAX_ROWS - 1);
      const c = clamp(prev.c + dc, 0, MAX_COLS - 1);
      const nv = { r, c };
      if (!extend) setAnchor(nv);
      gridApiRef.current?.scrollTo(r, c);
      return nv;
    });
  }, []);
  const goto = useCallback((r, c, extend) => {
    const nv = { r: clamp(r, 0, MAX_ROWS - 1), c: clamp(c, 0, MAX_COLS - 1) };
    setSel(nv);
    if (!extend) setAnchor(nv);
    gridApiRef.current?.scrollTo(nv.r, nv.c);
  }, []);

  const beginEdit = (r, c, initial) => {
    const cur = initial !== undefined ? initial : (rows[r]?.[c] ?? '');
    setEditing({ r, c, value: cur, source: 'grid' });
  };
  const commitEdit = (dr = 1, dc = 0) => {
    setEditing((e) => {
      if (e) {
        const rule = validationFor(e.r, e.c);
        const res = checkValue(rule, e.value);
        if (!res.ok) { toast.error(res.msg); return null; } // reject invalid edit
        setCell(e.r, e.c, e.value);
      }
      return null;
    });
    if (dr || dc) move(dr, dc, false);
    gridApiRef.current?.focus();
  };
  const cancelEdit = () => { setEditing(null); gridApiRef.current?.focus(); };

  // ---- clipboard (values + formats, formula-aware) ----
  const clipRef = useRef(null);
  const buildBlock = (rg) => {
    const block = []; const fmtBlock = []; const disp = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const braw = []; const bfmt = []; const bdisp = [];
      for (let c = rg.c1; c <= rg.c2; c++) {
        braw.push(rows[r]?.[c] ?? '');
        bfmt.push(sheet.fmts?.[`${r}:${c}`]);
        bdisp.push(engine.typed(activeSheet, r, c).text);
      }
      block.push(braw); fmtBlock.push(bfmt); disp.push(bdisp);
    }
    return { block, fmtBlock, tsv: disp.map((l) => l.join('\t')).join('\n'), origin: { r: rg.r1, c: rg.c1 } };
  };
  const onCopy = (e) => {
    if (editing) return;
    const b = buildBlock(range);
    clipRef.current = b;
    e.clipboardData.setData('text/plain', b.tsv);
    e.preventDefault();
  };
  const onCut = (e) => { if (editing) return; onCopy(e); clearRange(range); };
  const onPaste = (e) => {
    if (editing) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const clip = clipRef.current;
    const top = sel.r; const left = sel.c;
    if (clip && text === clip.tsv) {
      const dr = top - clip.origin.r; const dc = left - clip.origin.c;
      mutateSheet((s) => {
        let nextRows = s.rows || [];
        const fmts = { ...(s.fmts || {}) };
        clip.block.forEach((line, ri) => line.forEach((raw, ci) => {
          const val = typeof raw === 'string' && raw[0] === '=' ? translateFormula(raw, dr, dc) : raw;
          nextRows = writeCell(nextRows === s.rows ? s.rows : nextRows, top + ri, left + ci, val);
          const f = clip.fmtBlock[ri][ci];
          if (f) fmts[`${top + ri}:${left + ci}`] = f;
        }));
        return { ...s, rows: nextRows, fmts };
      });
      setAnchor({ r: top, c: left });
      setSel({ r: top + clip.block.length - 1, c: left + (clip.block[0]?.length || 1) - 1 });
      return;
    }
    const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
    mutate((src) => {
      let next = src;
      lines.forEach((line, ri) => line.forEach((val, ci) => { next = writeCell(next === src ? src : next, top + ri, left + ci, val); }));
      return next;
    });
    setAnchor({ r: top, c: left });
    setSel({ r: top + lines.length - 1, c: left + (lines[0]?.length || 1) - 1 });
    gridApiRef.current?.scrollTo(top + lines.length - 1, left + (lines[0]?.length || 1) - 1);
  };

  const onGridKeyDown = (e) => {
    if (editing) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'b') { e.preventDefault(); toggleFmt('bold'); return; }
      if (k === 'i') { e.preventDefault(); toggleFmt('italic'); return; }
      if (k === 'u') { e.preventDefault(); toggleFmt('underline'); return; }
      if (k === 'f') { e.preventDefault(); setDialog('find'); return; }
      if (k === 'a') { e.preventDefault(); setAnchor({ r: 0, c: 0 }); setSel({ r: displayRows - 1, c: displayCols - 1 }); return; }
      if (k === 'arrowdown') { e.preventDefault(); goto(displayRows - 1, sel.c, e.shiftKey); return; }
      if (k === 'arrowup') { e.preventDefault(); goto(0, sel.c, e.shiftKey); return; }
      if (k === 'arrowright') { e.preventDefault(); goto(sel.r, displayCols - 1, e.shiftKey); return; }
      if (k === 'arrowleft') { e.preventDefault(); goto(sel.r, 0, e.shiftKey); return; }
      if (k === 'home') { e.preventDefault(); goto(0, 0, e.shiftKey); return; }
      return;
    }
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0, e.shiftKey); return;
      case 'ArrowDown': e.preventDefault(); move(1, 0, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); move(0, -1, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1, e.shiftKey); return;
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1, false); return;
      case 'Enter': e.preventDefault(); beginEdit(sel.r, sel.c); return;
      case 'F2': e.preventDefault(); beginEdit(sel.r, sel.c); return;
      case 'Home': e.preventDefault(); goto(sel.r, 0, e.shiftKey); return;
      case 'End': e.preventDefault(); goto(sel.r, Math.max(0, displayCols - 1), e.shiftKey); return;
      case 'PageDown': e.preventDefault(); move(20, 0, e.shiftKey); return;
      case 'PageUp': e.preventDefault(); move(-20, 0, e.shiftKey); return;
      case 'Delete':
      case 'Backspace': e.preventDefault(); clearRange(range); return;
      case 'Escape': e.preventDefault(); setAnchor(sel); return;
      default:
        // Shift+B is the sidebar toggle (handled by the root onKeyDown); don't
        // start a cell edit for it.
        if (e.shiftKey && (e.key === 'B' || e.key === 'b')) return;
        if (e.key.length === 1 && !e.altKey) { e.preventDefault(); beginEdit(sel.r, sel.c, e.key); }
    }
  };

  // ---- import / export ----
  const onPickFile = () => fileRef.current?.click();
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error(`File too large (${(file.size / 1e6).toFixed(0)} MB). Max ${MAX_IMPORT_BYTES / 1e6} MB.`);
      return;
    }
    setBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const base = file.name.replace(/\.(csv|xlsx|xls|xlsb|ods)$/i, '') || 'Imported';
      let wb;
      const t0 = performance.now();
      if (isCsv) {
        const imported = await office.csvImport(await readFileText(file));
        wb = { sheets: [{ name: base.slice(0, 31) || 'Sheet1', rows: imported }] };
      } else {
        wb = await office.excelImport(await readFileBytes(file));
      }
      const ms = performance.now() - t0;
      createBook(base, wb);
      toast.success(`Imported "${base}" · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Couldn't open that file: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };
  const runExport = async (fn, ok, ext) => {
    if (!selected) return;
    setBusy(true);
    try {
      const t0 = performance.now();
      const bytes = await fn();
      const ms = performance.now() - t0;
      if (ext === 'csv') downloadText(bytes, `${selected.name || 'workbook'}-${sheet.name}.csv`, MIME.csv);
      else downloadBytes(bytes, `${selected.name || 'workbook'}.${ext}`, MIME[ext]);
      toast.success(`${ok} · ${humanDuration(ms)}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || err}`);
    } finally {
      setBusy(false);
    }
  };
  const exportBook = () => runExport(() => office.excelExport(selected.wb), 'Saved .xlsx', 'xlsx');
  const exportPdf = () => runExport(() => office.excelPdf(selected.wb), 'Exported PDF', 'pdf');
  const exportCsv = () => runExport(() => office.csvExport(sheet.rows || []), 'Saved .csv (active sheet)', 'csv');

  // ---- sheet ops ----
  const updateSheetMeta = (idx, patch) => setSheets(sheets.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const addSheet = () => { setSheets([...sheets, blankSheet(`Sheet${sheets.length + 1}`)]); setActiveSheet(sheets.length); };
  const renameSheet = (idx, name) => updateSheetMeta(idx, { name });
  const deleteSheet = (idx) => {
    if (sheets.length <= 1) return;
    setSheets(sheets.filter((_, i) => i !== idx));
    setActiveSheet((a) => Math.max(0, Math.min(a, sheets.length - 2)));
  };

  const hasDetail = !!selected;
  const showDetail = narrow ? hasDetail && !sidebarOpen : true;
  const showSidebar = narrow ? !showDetail : sidebarOpen;

  const h = hist();
  const activeRaw = rows[sel.r]?.[sel.c] ?? '';
  const fbValue = editing ? editing.value : activeRaw;
  const numFmtValue = curFmt.numFmt || '';

  const fmtBtn = (active) => cn('size-8 shrink-0', active && 'bg-accent text-accent-foreground');

  return (
    <div ref={rootRef} className="@container flex h-full min-h-0" onClick={() => menu && setMenu(null)}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.xlsb,.ods,.csv" className="hidden" onChange={onFile} />

      {(narrow ? showSidebar : true) && (
        <SidebarShell narrow={narrow} open={sidebarOpen} width={256}>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={() => createBook()}><Plus /> New</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onPickFile} disabled={busy}><Upload /> Open</Button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {sorted.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No workbooks yet. 📊</CardContent></Card>
            ) : (
              sorted.map((b) => (
                <Card
                  key={b.id} role="button" tabIndex={0}
                  onClick={() => openBook(b.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(b.id); } }}
                  className={cn('cursor-pointer gap-1 py-3 transition-colors hover:border-primary/40', selectedId === b.id && 'border-primary/60')}
                >
                  <CardContent className="flex items-start justify-between gap-2 px-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                        <SheetIcon className="size-4 shrink-0 text-muted-foreground" />{b.name || 'Untitled'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{(b.wb?.sheets?.length || 0)} sheet(s) · {relativeTime(b.updatedMs)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 text-destructive hover:text-destructive" aria-label={`Delete ${b.name || 'workbook'}`} onClick={(e) => { e.stopPropagation(); remove(b.id); }}>
                      <Trash2 />
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SidebarShell>
      )}

      {showDetail && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="mb-2 flex shrink-0 items-center gap-2 border-b pb-2">
                <ShortcutTip label={`${showSidebar ? 'Hide' : 'Show'} sidebar · Shift+B`}>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setSidebarOpen((o) => !o)} aria-label={showSidebar ? 'Hide list' : 'Show list'}>
                    {showSidebar ? <PanelLeftClose /> : <PanelLeftOpen />}
                  </Button>
                </ShortcutTip>
                <Input value={selected.name} onChange={(e) => rename(selected.id, e.target.value)} className="h-8 min-w-0 flex-1 font-medium" aria-label="Workbook name" />
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={undo} disabled={!h.undo.length} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 /></Button>
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={redo} disabled={!h.redo.length} aria-label="Redo" title="Redo (Ctrl+Y)"><Redo2 /></Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPdf} disabled={busy} title="Export as PDF"><FileDown /> PDF</Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={busy} title="Export active sheet as .csv"><Download /> CSV</Button>
                <Button size="sm" className="gap-1.5" onClick={exportBook} disabled={busy} title="Save as .xlsx"><Download /> Save</Button>
              </div>

              {/* Formatting toolbar */}
              <div className="mb-2 flex shrink-0 flex-wrap items-center gap-1">
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.bold)} onClick={() => toggleFmt('bold')} title="Bold (Ctrl+B)"><Bold /></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.italic)} onClick={() => toggleFmt('italic')} title="Italic (Ctrl+I)"><Italic /></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.underline)} onClick={() => toggleFmt('underline')} title="Underline (Ctrl+U)"><Underline /></Button>
                <label className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Font colour">
                  <Baseline className="size-4" />
                  <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={curFmt.color || '#000000'} onChange={(e) => applyFmt({ color: e.target.value })} />
                </label>
                <label className="relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Fill colour">
                  <PaintBucket className="size-4" />
                  <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={curFmt.bg || '#ffff00'} onChange={(e) => applyFmt({ bg: e.target.value })} />
                </label>
                <span className="mx-1 h-5 w-px bg-border" />
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.align === 'left')} onClick={() => applyFmt({ align: 'left' })} title="Align left"><AlignLeft /></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.align === 'center')} onClick={() => applyFmt({ align: 'center' })} title="Align center"><AlignCenter /></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(curFmt.align === 'right')} onClick={() => applyFmt({ align: 'right' })} title="Align right"><AlignRight /></Button>
                <span className="mx-1 h-5 w-px bg-border" />
                <select
                  value={numFmtValue}
                  onChange={(e) => setNumFmt(e.target.value)}
                  className="h-8 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                  title="Number format"
                >
                  {NUMBER_FORMATS.map((f) => <option key={f.label} value={f.code}>{f.label}</option>)}
                </select>
                <span className="mx-1 h-5 w-px bg-border" />
                <Button variant="ghost" size="icon" className="size-8" onClick={() => doSort(true)} title="Sort A→Z (selection)"><span className="text-xs font-semibold">A↓</span></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => doSort(false)} title="Sort Z→A (selection)"><span className="text-xs font-semibold">Z↓</span></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(isMerged)} onClick={toggleMerge} title="Merge / unmerge selection"><span className="text-xs font-semibold">⤬</span></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(sheet.freeze && sheet.freeze[0] === sel.r && sheet.freeze[1] === sel.c)} onClick={toggleFreeze} title="Freeze panes at cursor"><Snowflake /></Button>
                <Button variant="ghost" size="icon" className={fmtBtn(sheet.autofilter)} onClick={toggleFilter} title="Toggle AutoFilter on selection"><Filter /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog('cond')} title="Conditional formatting"><Droplet /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog('find')} title="Find & replace (Ctrl+F)"><Search /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog('chart')} title="Chart from selection"><BarChart3 /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog('validate')} title="Data validation"><ListChecks /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setDialog('pivot')} title="Pivot table from selection"><Table2 /></Button>
              </div>

              {/* Name box + formula bar */}
              <div className="mb-2 flex shrink-0 items-stretch gap-2">
                <div className="flex w-20 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-sm font-medium">{colLabel(sel.c)}{sel.r + 1}</div>
                <div className="flex items-center px-1 text-sm italic text-muted-foreground">fx</div>
                <input
                  className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={fbValue}
                  placeholder="Enter a value or =formula"
                  onChange={(e) => setEditing({ r: sel.r, c: sel.c, value: e.target.value, source: 'bar' })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitEdit(1, 0); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                  }}
                  aria-label="Formula bar"
                />
              </div>

              <VirtualGrid
                apiRef={gridApiRef}
                engine={engine}
                sheet={sheet}
                sheetIdx={activeSheet}
                rows={rows}
                displayRows={displayRows}
                displayCols={displayCols}
                sel={sel}
                range={range}
                editing={editing}
                onSelect={(r, c, extend) => goto(r, c, extend)}
                onSelectStart={(r, c) => { setAnchor({ r, c }); setSel({ r, c }); }}
                onSelectRow={(r, extend) => { setAnchor({ r: extend ? anchor.r : r, c: 0 }); setSel({ r, c: displayCols - 1 }); }}
                onSelectCol={(c, extend) => { setAnchor({ r: 0, c: extend ? anchor.c : c }); setSel({ r: displayRows - 1, c }); }}
                onBeginEdit={beginEdit}
                onEditChange={(v) => setEditing((e) => (e ? { ...e, value: v } : e))}
                onCommitEdit={commitEdit}
                onCancelEdit={cancelEdit}
                onKeyDown={onGridKeyDown}
                onCopy={onCopy}
                onCut={onCut}
                onPaste={onPaste}
                onContextMenu={(x, y, r, c) => { if (r < range.r1 || r > range.r2 || c < range.c1 || c > range.c2) { setAnchor({ r, c }); setSel({ r, c }); } setMenu({ x, y }); }}
                onColResize={setColWidth}
                fillTo={fillTo}
                onFillOver={(r, c) => setFillTo({ r, c })}
                onFillEnd={() => { if (fillTo) doAutofill(fillTo); setFillTo(null); }}
                cfRules={cfRules}
                posCount={posCount}
                posToRow={posToRow}
                rowToPos={rowToPos}
                autofilter={sheet.autofilter}
                onHeaderFilter={(c, x, y) => setFilterMenu({ c, x, y })}
                validationFor={validationFor}
                onListOpen={(r, c, x, y, list) => setListMenu({ r, c, x, y, list })}
              />
              <p className="mt-1 shrink-0 text-[11px] text-muted-foreground">
                {rows.length.toLocaleString()} rows × {dataCols} cols · {colLabel(range.c1)}{range.r1 + 1}
                {(range.r1 !== range.r2 || range.c1 !== range.c2) && `:${colLabel(range.c2)}${range.r2 + 1}`}
              </p>

              <div className="mt-2 flex shrink-0 items-center gap-1 overflow-x-auto border-t pt-2">
                {sheets.map((s, i) => (
                  <div key={i} className={cn('group flex shrink-0 items-center gap-0.5 rounded-md border px-1 pl-2 text-sm', i === activeSheet ? 'border-primary/60 bg-accent' : 'border-transparent hover:bg-accent/50')}>
                    <button type="button" className="max-w-32 truncate py-1" onClick={() => setActiveSheet(i)} onDoubleClick={() => { const name = window.prompt('Sheet name', s.name); if (name) renameSheet(i, name); }} title="Click to open · double-click to rename">{s.name}</button>
                    {sheets.length > 1 && (
                      <button type="button" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => deleteSheet(i)} aria-label={`Delete ${s.name}`}><X className="size-3.5 text-muted-foreground hover:text-destructive" /></button>
                    )}
                  </div>
                ))}
                <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={addSheet} aria-label="Add sheet"><Plus /></Button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">Select a workbook, create a new one, or open an .xlsx.</div>
          )}
        </section>
      )}

      {/* Right-click context menu */}
      {menu && (
        <div
          className="fixed z-[6000] min-w-44 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            ['Insert row above', () => doInsertRows(range.r1, range.r2 - range.r1 + 1)],
            ['Insert row below', () => doInsertRows(range.r2 + 1, range.r2 - range.r1 + 1)],
            ['Delete row(s)', () => doDeleteRows(range.r1, range.r2 - range.r1 + 1)],
            ['—', null],
            ['Insert column left', () => doInsertCols(range.c1, range.c2 - range.c1 + 1)],
            ['Insert column right', () => doInsertCols(range.c2 + 1, range.c2 - range.c1 + 1)],
            ['Delete column(s)', () => doDeleteCols(range.c1, range.c2 - range.c1 + 1)],
            ['—', null],
            [isMerged ? 'Unmerge' : 'Merge cells', toggleMerge],
            ['Clear contents', () => clearRange(range)],
          ].map(([label, fn], i) => (
            label === '—'
              ? <div key={i} className="my-1 h-px bg-border" />
              : <button key={i} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-accent" onClick={() => { fn(); setMenu(null); }}>{label}</button>
          ))}
        </div>
      )}

      {/* Find & replace */}
      <Dialog open={dialog === 'find'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Find & replace</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Find" value={findText} onChange={(e) => setFindText(e.target.value)} autoFocus />
            <Input placeholder="Replace with" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case</label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Close</Button>
            <Button onClick={replaceAll}>Replace all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chart */}
      <Dialog open={dialog === 'chart'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Chart from selection</DialogTitle></DialogHeader>
          <ChartView engine={engine} sheetIdx={activeSheet} range={range} />
        </DialogContent>
      </Dialog>

      {/* Conditional formatting */}
      <Dialog open={dialog === 'cond'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Conditional formatting</DialogTitle></DialogHeader>
          <CondDialog
            rangeLabel={`${colLabel(range.c1)}${range.r1 + 1}:${colLabel(range.c2)}${range.r2 + 1}`}
            existing={sheet.condFmt || []}
            onAdd={(rule) => addCondRule(rule)}
            onClear={clearCondRules}
          />
        </DialogContent>
      </Dialog>

      {/* AutoFilter dropdown */}
      {filterMenu && (
        <FilterMenu
          x={filterMenu.x}
          y={filterMenu.y}
          values={uniqueValuesFor(filterMenu.c)}
          allowed={sheet.autofilter?.cols?.[filterMenu.c] || null}
          onApply={(allowed) => { setColFilter(filterMenu.c, allowed); setFilterMenu(null); }}
          onSort={(asc) => { sortByColumn(filterMenu.c, asc); setFilterMenu(null); }}
          onClose={() => setFilterMenu(null)}
        />
      )}

      {/* Data validation */}
      <Dialog open={dialog === 'validate'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Data validation</DialogTitle></DialogHeader>
          <ValidationDialog
            rangeLabel={`${colLabel(range.c1)}${range.r1 + 1}:${colLabel(range.c2)}${range.r2 + 1}`}
            existing={sheet.validations || []}
            onAdd={(rule) => { addValidation(rule); setDialog(null); }}
            onClear={clearValidations}
          />
        </DialogContent>
      </Dialog>

      {/* Pivot table */}
      <Dialog open={dialog === 'pivot'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create pivot table</DialogTitle></DialogHeader>
          <PivotDialog
            range={range}
            header={(c) => engine.typed(activeSheet, range.r1, c).text || colLabel(c)}
            onCreate={makePivot}
          />
        </DialogContent>
      </Dialog>

      {/* List-validation dropdown */}
      {listMenu && (
        <ListMenu
          x={listMenu.x}
          y={listMenu.y}
          list={listMenu.list}
          onPick={(v) => { setCell(listMenu.r, listMenu.c, v); setListMenu(null); }}
          onClose={() => setListMenu(null)}
        />
      )}
    </div>
  );
}

// Cumulative x-offsets for variable column widths (bounded by displayCols).
function useColX(sheet, displayCols) {
  return useMemo(() => {
    const widths = sheet.colWidths || {};
    const xs = new Float64Array(displayCols + 1);
    for (let c = 0; c < displayCols; c++) xs[c + 1] = xs[c] + (widths[c] || COL_W);
    return xs;
  }, [sheet.colWidths, displayCols]);
}

function VirtualGrid({
  apiRef, engine, sheet, sheetIdx, rows, displayRows, displayCols, sel, range, editing,
  onSelect, onSelectStart, onSelectRow, onSelectCol, onBeginEdit, onEditChange, onCommitEdit,
  onCancelEdit, onKeyDown, onCopy, onCut, onPaste, onContextMenu, onColResize,
  fillTo, onFillOver, onFillEnd,
  cfRules, posCount, posToRow, rowToPos, autofilter, onHeaderFilter,
  validationFor, onListOpen,
}) {
  const scrollRef = useRef(null);
  const bodyRef = useRef(null);
  const editRef = useRef(null);
  const dragging = useRef(false);
  const filling = useRef(false);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [resize, setResize] = useState(null);

  const colX = useColX(sheet, displayCols);
  const widthOf = (c) => (sheet.colWidths?.[c] || COL_W);
  const xOf = (c) => (c < colX.length ? colX[c] : colX[colX.length - 1] + (c - displayCols) * COL_W);

  const { tlMap, hiddenSet } = useMemo(() => {
    const tl = new Map(); const hidden = new Set();
    for (const [r1, c1, r2, c2] of (sheet.merges || [])) {
      tl.set(`${r1}:${c1}`, { rs: r2 - r1 + 1, cs: c2 - c1 + 1 });
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (!(r === r1 && c === c1)) hidden.add(`${r}:${c}`);
    }
    return { tlMap: tl, hiddenSet: hidden };
  }, [sheet.merges]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      focus: () => bodyRef.current?.focus(),
      scrollTo: (r, c) => {
        const el = scrollRef.current;
        if (!el) return;
        const frP = sheet.freeze?.[0] != null ? rowToPos(sheet.freeze[0]) : 0;
        const fcc = sheet.freeze?.[1] || 0;
        const frozenH = frP * ROW_H;
        const frozenW = xOf(fcc);
        const p = rowToPos(r);
        const top = p * ROW_H;
        const left = xOf(c);
        const w = widthOf(c);
        if (p >= frP) {
          if (top - el.scrollTop < frozenH) el.scrollTop = top - frozenH;
          else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight;
        }
        if (c >= fcc) {
          if (left - el.scrollLeft < frozenW) el.scrollLeft = left - frozenW;
          else if (left + w > el.scrollLeft + el.clientWidth) el.scrollLeft = left + w - el.clientWidth;
        }
      },
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing && editing.source !== 'bar' && editRef.current) {
      const el = editRef.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [editing?.r, editing?.c]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!resize) return undefined;
    const onMove = (e) => setResize((rz) => (rz ? { ...rz, w: Math.max(MIN_COL_W, rz.startW + (e.clientX - rz.startX)) } : rz));
    const onUp = () => { setResize((rz) => { if (rz) onColResize(rz.col, rz.w); return null; }); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resize, onColResize]);

  // end a fill-handle drag anywhere the mouse is released
  useEffect(() => {
    const up = () => { if (filling.current) { filling.current = false; onFillEnd(); } dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [onFillEnd]);

  const totalH = posCount * ROW_H;
  const totalW = xOf(displayCols);
  const fr = sheet.freeze?.[0] != null ? rowToPos(sheet.freeze[0]) : 0; // frozen top POSITIONS
  const fc = sheet.freeze?.[1] || 0;
  const frozenH = fr * ROW_H;
  const frozenW = xOf(fc);

  const findCol = (x) => { let lo = 0; while (lo < displayCols && xOf(lo + 1) <= x) lo++; return lo; };
  // scrollable window sits AFTER the frozen band (positions, not raw rows)
  const startRow = Math.max(fr, Math.floor((scroll.top + frozenH) / ROW_H) - OVERSCAN);
  const endRow = Math.min(posCount, Math.ceil((scroll.top + size.h) / ROW_H) + OVERSCAN);
  const startCol = Math.max(fc, findCol(scroll.left + frozenW) - OVERSCAN);
  const endCol = Math.min(displayCols, findCol(scroll.left + size.w) + OVERSCAN + 1);

  const posIdx = []; for (let p = startRow; p < endRow; p++) posIdx.push(p);
  const colIdx = []; for (let c = startCol; c < endCol; c++) colIdx.push(c);
  const frozenPosIdx = []; for (let p = 0; p < fr; p++) frozenPosIdx.push(p);
  const frozenColIdx = []; for (let c = 0; c < fc; c++) frozenColIdx.push(c);

  const onScroll = (e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft });
  const inRange = (r, c) => r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
  const inFill = (r, c) => fillTo && r >= Math.min(range.r1, fillTo.r) && r <= Math.max(range.r2, fillTo.r) && c >= Math.min(range.c1, fillTo.c) && c <= Math.max(range.c2, fillTo.c);

  // Shared cell renderer, keyed by display position `p` (vertical) and column
  // `c`; the actual sheet row is posToRow(p) so AutoFilter can hide rows.
  const renderCell = (p, c) => {
    const r = posToRow(p);
    const kk = `${r}:${c}`;
    if (hiddenSet.has(kk)) return null;
    const span = tlMap.get(kk);
    const isActive = r === sel.r && c === sel.c;
    const isEditing = editing && editing.r === r && editing.c === c;
    const cell = engine.typed(sheetIdx, r, c);
    const f = sheet.fmts?.[kk];
    const cf = cfRules && cfRules.length ? condStyle(cfRules, r, c, engine.value(sheetIdx, r, c)) : null;
    const selCell = inRange(r, c);
    const w = span ? (xOf(c + span.cs) - xOf(c)) : widthOf(c);
    const hgt = span ? span.rs * ROW_H : ROW_H;
    const style = { top: p * ROW_H, left: xOf(c), width: w, height: hgt };
    if (isEditing) {
      return (
        <input
          key={kk} ref={editRef} value={editing.value}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={() => onCommitEdit(0, 0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onCommitEdit(e.shiftKey ? -1 : 1, 0); }
            else if (e.key === 'Tab') { e.preventDefault(); onCommitEdit(0, e.shiftKey ? -1 : 1); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
            e.stopPropagation();
          }}
          className="pointer-events-auto absolute z-20 bg-background px-2 text-sm outline-none"
          style={{ ...style, border: `2px solid ${EXCEL_GREEN}` }}
        />
      );
    }
    const align = f?.align || (cell.type === 'number' || cell.type === 'bool' ? 'right' : 'left');
    const filled = inFill(r, c) && !selCell;
    const val = validationFor ? validationFor(r, c) : null;
    const isList = val && val.kind === 'list';
    return (
      <div
        key={kk}
        onMouseDown={(e) => {
          if (e.button === 2) return;
          if (e.shiftKey) onSelect(r, c, true);
          else { onSelectStart(r, c); dragging.current = true; }
          bodyRef.current?.focus();
        }}
        onMouseEnter={() => { if (filling.current) onFillOver(r, c); else if (dragging.current) onSelect(r, c, true); }}
        onDoubleClick={() => onBeginEdit(r, c)}
        className={cn(
          'pointer-events-auto absolute flex items-center overflow-hidden whitespace-nowrap border-b border-r px-2 text-sm',
          align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start',
          cell.type === 'error' && 'text-destructive',
          r === 0 && !f?.bold && 'font-semibold',
        )}
        style={{
          ...style,
          fontWeight: f?.bold ? 700 : undefined,
          fontStyle: f?.italic ? 'italic' : undefined,
          textDecoration: f?.underline ? 'underline' : undefined,
          color: cf?.color || f?.color || undefined,
          background: selCell && !isActive ? 'rgba(33,115,70,0.12)' : (cf?.bg || f?.bg || undefined),
          outline: isActive ? `2px solid ${EXCEL_GREEN}` : (filled ? '1px dashed rgba(33,115,70,0.6)' : undefined),
          outlineOffset: isActive ? '-2px' : undefined,
          zIndex: isActive ? 10 : undefined,
        }}
        title={cell.text}
      >
        {cf?.bar && <div className="pointer-events-none absolute inset-y-px left-px rounded-sm" style={{ width: `calc(${(cf.bar.pct * 100).toFixed(1)}% - 2px)`, background: cf.bar.color, opacity: 0.35 }} />}
        <span className="relative w-full truncate" style={{ textAlign: align }}>{cell.text}</span>
        {isList && (
          <button
            type="button"
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onListOpen(r, c, e.clientX, e.clientY, val.list); }}
            className="relative ml-0.5 flex size-4 shrink-0 items-center justify-center rounded border bg-muted hover:bg-accent"
            title="Choose from list"
          >
            <ChevronDown className="size-3" />
          </button>
        )}
      </div>
    );
  };

  const headerCell = (c) => {
    const selc = c >= range.c1 && c <= range.c2;
    const showCaret = autofilter && c >= autofilter.range.c1 && c <= autofilter.range.c2;
    const filtered = showCaret && autofilter.cols && autofilter.cols[c];
    return (
      <div
        key={c}
        onMouseDown={(e) => { if (e.button === 0 && !e.target.dataset.resize) onSelectCol(c, e.shiftKey); }}
        className={cn('pointer-events-auto absolute top-0 flex items-center justify-center border-r text-xs font-medium', selc ? 'text-foreground' : 'text-muted-foreground')}
        style={{ left: xOf(c), width: widthOf(c), height: HEADER_H, background: selc ? 'rgba(33,115,70,0.18)' : undefined }}
      >
        {colLabel(c)}
        {showCaret && (
          <button
            type="button" data-resize="1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onHeaderFilter(c, e.clientX, e.clientY); }}
            className="absolute right-2 flex size-4 items-center justify-center rounded hover:bg-primary/30"
            style={{ color: filtered ? EXCEL_GREEN : undefined }}
            title="Filter"
          >
            <ChevronDown className="size-3" />
          </button>
        )}
        <div
          data-resize="1"
          onMouseDown={(e) => { e.stopPropagation(); setResize({ col: c, startX: e.clientX, startW: widthOf(c), w: widthOf(c) }); }}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
        />
      </div>
    );
  };
  const rowNumCell = (p) => {
    const r = posToRow(p);
    return (
      <div
        key={p}
        onMouseDown={(e) => { if (e.button === 0) onSelectRow(r, e.shiftKey); }}
        className={cn('pointer-events-auto absolute left-0 flex cursor-pointer items-center justify-center border-b text-xs', r >= range.r1 && r <= range.r2 ? 'text-foreground' : 'text-muted-foreground')}
        style={{ top: p * ROW_H, width: GUTTER_W, height: ROW_H, background: r >= range.r1 && r <= range.r2 ? 'rgba(33,115,70,0.18)' : undefined }}
      >
        {r + 1}
      </div>
    );
  };

  // fill handle sits at the bottom-right corner of the selection (display space)
  const handleX = xOf(range.c2) + widthOf(range.c2);
  const handleY = (rowToPos(range.r2) + 1) * ROW_H;

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border" style={{ fontFamily: 'Calibri, "Segoe UI", system-ui, sans-serif', fontSize: 13 }}>
      <div className="absolute left-0 top-0 z-40 border-b border-r bg-muted" style={{ width: GUTTER_W, height: HEADER_H }} />

      {/* Column headers (scrolling) */}
      <div className="absolute top-0 z-20 overflow-hidden border-b bg-muted" style={{ left: GUTTER_W, right: 0, height: HEADER_H }}>
        <div style={{ width: totalW, height: HEADER_H, transform: `translateX(${-scroll.left}px)` }} className="relative">
          {colIdx.map(headerCell)}
        </div>
      </div>
      {/* Frozen column headers */}
      {fc > 0 && (
        <div className="absolute top-0 z-30 overflow-hidden border-b border-r-2 border-r-primary bg-muted" style={{ left: GUTTER_W, width: frozenW, height: HEADER_H }}>
          <div style={{ width: frozenW, height: HEADER_H }} className="relative">{frozenColIdx.map(headerCell)}</div>
        </div>
      )}

      {/* Row numbers (scrolling) */}
      <div className="absolute left-0 z-20 overflow-hidden border-r bg-muted" style={{ top: HEADER_H, bottom: 0, width: GUTTER_W }}>
        <div style={{ height: totalH, transform: `translateY(${-scroll.top}px)` }} className="relative">
          {posIdx.map(rowNumCell)}
        </div>
      </div>
      {/* Frozen row numbers */}
      {fr > 0 && (
        <div className="absolute left-0 z-30 overflow-hidden border-b-2 border-b-primary border-r bg-muted" style={{ top: HEADER_H, width: GUTTER_W, height: frozenH }}>
          <div style={{ width: GUTTER_W, height: frozenH }} className="relative">{frozenPosIdx.map(rowNumCell)}</div>
        </div>
      )}

      {/* Body (scrollable) */}
      <div
        ref={(el) => { scrollRef.current = el; bodyRef.current = el; }}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onContextMenu={(e) => {
          const el = scrollRef.current;
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left + el.scrollLeft;
          const y = e.clientY - rect.top + el.scrollTop;
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY, posToRow(Math.floor(y / ROW_H)), findCol(x));
        }}
        className="absolute overflow-auto outline-none"
        style={{ left: GUTTER_W, top: HEADER_H, right: 0, bottom: 0, scrollPaddingTop: frozenH, scrollPaddingLeft: frozenW }}
      >
        <div style={{ width: totalW, height: totalH }} className="relative">
          {posIdx.map((p) => colIdx.map((c) => renderCell(p, c)))}
          {/* fill preview */}
          {fillTo && (
            <div className="pointer-events-none absolute z-[11]" style={{ border: `1px dashed ${EXCEL_GREEN}`, left: xOf(Math.min(range.c1, fillTo.c)), top: rowToPos(Math.min(range.r1, fillTo.r)) * ROW_H, width: xOf(Math.max(range.c2, fillTo.c) + 1) - xOf(Math.min(range.c1, fillTo.c)), height: (rowToPos(Math.max(range.r2, fillTo.r)) - rowToPos(Math.min(range.r1, fillTo.r)) + 1) * ROW_H }} />
          )}
          {/* fill handle */}
          {!editing && (
            <div
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); filling.current = true; }}
              className="absolute z-[12]"
              style={{ left: handleX - 4, top: handleY - 4, width: 7, height: 7, background: EXCEL_GREEN, border: '1px solid white', cursor: 'crosshair' }}
            />
          )}
          {resize && <div className="pointer-events-none absolute top-0 z-40 w-px bg-primary" style={{ left: xOf(resize.col) + resize.w, height: totalH }} />}
        </div>
      </div>

      {/* Frozen overlays (top rows / left cols / corner) render over the body. */}
      {fr > 0 && (
        <div className="pointer-events-none absolute z-[15] overflow-hidden border-b-2 border-b-primary" style={{ left: GUTTER_W + frozenW, right: 0, top: HEADER_H, height: frozenH, background: 'var(--background)' }}>
          <div className="relative h-full" style={{ width: totalW, transform: `translateX(${-scroll.left}px)` }}>
            {frozenPosIdx.map((p) => colIdx.map((c) => renderCell(p, c)))}
          </div>
        </div>
      )}
      {fc > 0 && (
        <div className="pointer-events-none absolute z-[15] overflow-hidden border-r-2 border-r-primary" style={{ left: GUTTER_W, top: HEADER_H, bottom: 0, width: frozenW, background: 'var(--background)' }}>
          <div className="relative w-full" style={{ height: totalH, transform: `translateY(${-scroll.top}px)` }}>
            {posIdx.map((p) => frozenColIdx.map((c) => renderCell(p, c)))}
          </div>
        </div>
      )}
      {fr > 0 && fc > 0 && (
        <div className="pointer-events-none absolute z-[16] overflow-hidden border-b-2 border-r-2 border-b-primary border-r-primary" style={{ left: GUTTER_W, top: HEADER_H, width: frozenW, height: frozenH, background: 'var(--background)' }}>
          <div className="relative" style={{ width: frozenW, height: frozenH }}>
            {frozenPosIdx.map((p) => frozenColIdx.map((c) => renderCell(p, c)))}
          </div>
        </div>
      )}
    </div>
  );
}

// A lightweight SVG chart (bar / line / pie) built from the selected range: the
// first column is category labels, remaining numeric columns are series.
function ChartView({ engine, sheetIdx, range }) {
  const [type, setType] = useState('bar');
  const { labels, series } = useMemo(() => {
    const labs = [];
    const cols = [];
    const firstRowHeader = true;
    const headerRow = range.r1;
    for (let c = range.c1 + 1; c <= range.c2; c++) {
      cols.push({ name: engine.typed(sheetIdx, headerRow, c).text || `Series ${c - range.c1}`, data: [] });
    }
    for (let r = range.r1 + (firstRowHeader ? 1 : 0); r <= range.r2; r++) {
      labs.push(engine.typed(sheetIdx, r, range.c1).text || `${r + 1}`);
      cols.forEach((col, i) => {
        const v = engine.value(sheetIdx, r, range.c1 + 1 + i);
        col.data.push(typeof v === 'number' ? v : Number(v) || 0);
      });
    }
    return { labels: labs, series: cols };
  }, [engine, sheetIdx, range]);

  const W = 560; const H = 320; const pad = 40;
  const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  const allVals = series.flatMap((s) => s.data);
  const maxV = Math.max(1, ...allVals, 0);
  const minV = Math.min(0, ...allVals);
  const n = labels.length;

  if (!n || !series.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Select a range with a label column and at least one numeric column.</p>;
  }

  const plotW = W - pad * 2; const plotH = H - pad * 2;
  const y = (v) => pad + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  const x = (i) => pad + (i + 0.5) * (plotW / n);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {['bar', 'line', 'pie'].map((t) => (
          <Button key={t} size="sm" variant={type === t ? 'default' : 'outline'} onClick={() => setType(t)} className="capitalize">{t}</Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border bg-background p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
          {type !== 'pie' && (
            <>
              <line x1={pad} y1={pad} x2={pad} y2={pad + plotH} stroke="currentColor" strokeOpacity="0.3" />
              <line x1={pad} y1={y(0)} x2={pad + plotW} y2={y(0)} stroke="currentColor" strokeOpacity="0.3" />
            </>
          )}
          {type === 'bar' && series.map((s, si) => s.data.map((v, i) => {
            const bw = (plotW / n) / (series.length + 1);
            const bx = pad + i * (plotW / n) + bw * si + bw * 0.5;
            return <rect key={`${si}:${i}`} x={bx} y={Math.min(y(v), y(0))} width={bw} height={Math.abs(y(v) - y(0))} fill={palette[si % palette.length]} />;
          }))}
          {type === 'line' && series.map((s, si) => (
            <polyline key={si} fill="none" stroke={palette[si % palette.length]} strokeWidth="2" points={s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          ))}
          {type === 'pie' && (() => {
            const data = series[0].data;
            const total = data.reduce((a, b) => a + Math.abs(b), 0) || 1;
            let a0 = -Math.PI / 2;
            const cx = W / 2; const cy = H / 2; const rad = Math.min(plotW, plotH) / 2;
            return data.map((v, i) => {
              const a1 = a0 + (Math.abs(v) / total) * Math.PI * 2;
              const large = a1 - a0 > Math.PI ? 1 : 0;
              const p = `M ${cx} ${cy} L ${cx + rad * Math.cos(a0)} ${cy + rad * Math.sin(a0)} A ${rad} ${rad} 0 ${large} 1 ${cx + rad * Math.cos(a1)} ${cy + rad * Math.sin(a1)} Z`;
              a0 = a1;
              return <path key={i} d={p} fill={palette[i % palette.length]} />;
            });
          })()}
          {type !== 'pie' && labels.map((l, i) => (
            <text key={i} x={x(i)} y={pad + plotH + 14} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.7">{String(l).slice(0, 8)}</text>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {(type === 'pie' ? labels : series.map((s) => s.name)).map((name, i) => (
          <span key={i} className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{ background: palette[i % palette.length] }} />{name}</span>
        ))}
      </div>
    </div>
  );
}

// Build a conditional-formatting rule for the current selection.
function CondDialog({ rangeLabel, existing, onAdd, onClear }) {
  const [kind, setKind] = useState('gt');
  const [value, setValue] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [text, setText] = useState('');
  const [n, setN] = useState('3');
  const [bg, setBg] = useState('#ffe08a');
  const [color, setColor] = useState('#7a4b00');
  const [lo, setLo] = useState('#f8696b');
  const [mid, setMid] = useState('#ffeb84');
  const [hi, setHi] = useState('#63be7b');
  const needs = COND_KINDS.find((k) => k.key === kind).needs;
  const isScale = kind === 'scale2' || kind === 'scale3' || kind === 'databar';
  const submit = () => {
    const rule = { kind };
    if (needs.includes('value')) rule.value = Number(value);
    if (needs.includes('min')) rule.min = Number(min);
    if (needs.includes('max')) rule.max = Number(max);
    if (needs.includes('text')) rule.text = text;
    if (needs.includes('n')) rule.n = Number(n) || 1;
    if (needs.includes('lo')) rule.lo = lo;
    if (needs.includes('mid')) rule.mid = mid;
    if (needs.includes('hi')) rule.hi = hi;
    if (kind === 'databar') rule.color = hi;
    if (!isScale) { rule.bg = bg; rule.color = color; }
    onAdd(rule);
  };
  const swatch = (v, set, label) => (
    <label className="flex items-center gap-1 text-xs">{label}
      <input type="color" value={v} onChange={(e) => set(e.target.value)} className="size-6 cursor-pointer rounded border" />
    </label>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Applies to <span className="font-medium text-foreground">{rangeLabel}</span></p>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary">
        {COND_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        {needs.includes('value') && <Input type="number" placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-28" />}
        {needs.includes('min') && <Input type="number" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} className="h-9 w-24" />}
        {needs.includes('max') && <Input type="number" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className="h-9 w-24" />}
        {needs.includes('text') && <Input placeholder="Text" value={text} onChange={(e) => setText(e.target.value)} className="h-9 w-40" />}
        {needs.includes('n') && <Input type="number" placeholder="N" value={n} onChange={(e) => setN(e.target.value)} className="h-9 w-20" />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!isScale && swatch(bg, setBg, 'Fill')}
        {!isScale && swatch(color, setColor, 'Text')}
        {needs.includes('lo') && swatch(lo, setLo, 'Low')}
        {needs.includes('mid') && swatch(mid, setMid, 'Mid')}
        {needs.includes('hi') && swatch(hi, setHi, kind === 'databar' ? 'Bar' : 'High')}
      </div>
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">{existing.length} rule(s)</span>
        <div className="flex gap-2">
          {existing.length > 0 && <Button variant="outline" size="sm" onClick={onClear}>Clear all</Button>}
          <Button size="sm" onClick={submit}>Add rule</Button>
        </div>
      </div>
    </div>
  );
}

// AutoFilter dropdown popover: sort + per-value checkboxes.
function FilterMenu({ x, y, values, allowed, onApply, onSort, onClose }) {
  const [checked, setChecked] = useState(() => new Set(allowed || values));
  const toggle = (v) => setChecked((s) => { const nn = new Set(s); if (nn.has(v)) nn.delete(v); else nn.add(v); return nn; });
  const allOn = checked.size === values.length;
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [onClose]);
  return (
    <div className="fixed z-[6000] w-56 rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-lg" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex gap-1 border-b pb-2">
        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => onSort(true)}>A → Z</Button>
        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => onSort(false)}>Z → A</Button>
      </div>
      <label className="flex items-center gap-2 py-1 font-medium">
        <input type="checkbox" checked={allOn} onChange={() => setChecked(allOn ? new Set() : new Set(values))} /> (Select all)
      </label>
      <div className="max-h-48 overflow-y-auto">
        {values.map((v, i) => (
          <label key={i} className="flex items-center gap-2 py-0.5">
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} />
            <span className="truncate">{v === '' ? '(blank)' : v}</span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-1 border-t pt-2">
        <Button size="sm" variant="ghost" className="h-7" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="h-7" onClick={() => onApply(checked.size === values.length ? null : [...checked])}>Apply</Button>
      </div>
    </div>
  );
}

// Build a data-validation rule for the current selection.
function ValidationDialog({ rangeLabel, existing, onAdd, onClear }) {
  const [kind, setKind] = useState('list');
  const [list, setList] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const needs = VALIDATION_KINDS.find((k) => k.key === kind).needs;
  const submit = () => {
    const rule = { kind };
    if (needs.includes('list')) rule.list = list.split(',').map((s) => s.trim()).filter(Boolean);
    if (needs.includes('min') && min !== '') rule.min = Number(min);
    if (needs.includes('max') && max !== '') rule.max = Number(max);
    onAdd(rule);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">Applies to <span className="font-medium text-foreground">{rangeLabel}</span></p>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary">
        {VALIDATION_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
      </select>
      {needs.includes('list') && <Input placeholder="Comma-separated values, e.g. Low, Medium, High" value={list} onChange={(e) => setList(e.target.value)} className="h-9" />}
      {(needs.includes('min') || needs.includes('max')) && (
        <div className="flex gap-2">
          <Input type="number" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} className="h-9" />
          <Input type="number" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} className="h-9" />
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-xs text-muted-foreground">{existing.length} rule(s)</span>
        <div className="flex gap-2">
          {existing.length > 0 && <Button variant="outline" size="sm" onClick={onClear}>Clear all</Button>}
          <Button size="sm" onClick={submit}>Add validation</Button>
        </div>
      </div>
    </div>
  );
}

// Configure a pivot table over the selected range.
function PivotDialog({ range, header, onCreate }) {
  const cols = [];
  for (let c = range.c1; c <= range.c2; c++) cols.push({ c, name: header(c) });
  const [rowField, setRowField] = useState(range.c1);
  const [colField, setColField] = useState(-1);
  const [valField, setValField] = useState(Math.min(range.c1 + 1, range.c2));
  const [agg, setAgg] = useState('sum');
  const sel = (value, set, extra) => (
    <select value={value} onChange={(e) => set(Number(e.target.value))} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary">
      {extra}
      {cols.map((c) => <option key={c.c} value={c.c}>{c.name}</option>)}
    </select>
  );
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm"><span className="w-24 text-muted-foreground">Rows</span>{sel(rowField, setRowField)}</label>
      <label className="flex items-center gap-2 text-sm"><span className="w-24 text-muted-foreground">Columns</span>{sel(colField, setColField, <option value={-1}>(none)</option>)}</label>
      <label className="flex items-center gap-2 text-sm"><span className="w-24 text-muted-foreground">Values</span>{sel(valField, setValField)}</label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-24 text-muted-foreground">Summarise</span>
        <select value={agg} onChange={(e) => setAgg(e.target.value)} className="h-9 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary">
          {PIVOT_AGGS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </label>
      <div className="flex justify-end border-t pt-2">
        <Button size="sm" onClick={() => onCreate({ rowField, colField: colField < 0 ? null : colField, valField, agg })}>Create pivot</Button>
      </div>
    </div>
  );
}

// List-validation dropdown popover.
function ListMenu({ x, y, list, onPick, onClose }) {
  useEffect(() => {
    const h = () => onClose();
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, [onClose]);
  return (
    <div className="fixed z-[6000] max-h-56 w-40 overflow-y-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-lg" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {list.length === 0 && <div className="px-2 py-1 text-muted-foreground">No values</div>}
      {list.map((v, i) => (
        <button key={i} type="button" className="block w-full truncate rounded px-2 py-1 text-left hover:bg-accent" onClick={() => onPick(v)}>{v}</button>
      ))}
    </div>
  );
}

export default ExcelApp;
