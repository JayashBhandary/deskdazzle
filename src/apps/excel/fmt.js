// Sheet-level structural transforms (insert / delete / sort) and formatting
// presets. Every function is pure: it takes a sheet and returns a NEW sheet, so
// the caller records it for undo and the formula engine rebuilds cleanly.
//
// A sheet is { name, rows: string[][], fmts: {"r:c":CellFmt}, colWidths:{"c":px},
// rowHeights:{"r":px}, merges:[[r1,c1,r2,c2]], freeze:[rows,cols] }.

import { adjustFormula } from './formula';

// Number-format presets offered in the toolbar (label → Excel code, "" = General).
export const NUMBER_FORMATS = [
  { label: 'General', code: '' },
  { label: 'Number', code: '0.00' },
  { label: 'Number (1,000)', code: '#,##0.00' },
  { label: 'Currency', code: '$#,##0.00' },
  { label: 'Percent', code: '0.00%' },
  { label: 'Percent (0)', code: '0%' },
  { label: 'Date', code: 'yyyy-mm-dd' },
  { label: 'Date (long)', code: 'dd mmm yyyy' },
  { label: 'Time', code: 'hh:mm:ss' },
  { label: 'Scientific', code: '0.00E+00' },
];

const clone = (sheet) => ({
  name: sheet.name,
  rows: sheet.rows ? sheet.rows.map((r) => r.slice()) : [],
  fmts: { ...(sheet.fmts || {}) },
  colWidths: { ...(sheet.colWidths || {}) },
  rowHeights: { ...(sheet.rowHeights || {}) },
  merges: (sheet.merges || []).map((m) => m.slice()),
  freeze: sheet.freeze ? sheet.freeze.slice() : undefined,
});

const key = (r, c) => `${r}:${c}`;

// Remap a "r:c" fmt map through a (r,c)->{r,c}|null transform.
function remapFmts(fmts, fn) {
  const out = {};
  for (const k in fmts) {
    const [r, c] = k.split(':').map(Number);
    const t = fn(r, c);
    if (t) out[key(t.r, t.c)] = fmts[k];
  }
  return out;
}
function remapIndexMap(map, fn) {
  const out = {};
  for (const k in map) {
    const i = Number(k);
    const t = fn(i);
    if (t !== null) out[t] = map[k];
  }
  return out;
}
// Rewrite every formula in the sheet for a structural change.
function adjustAllFormulas(rows, spec) {
  return rows.map((row) => row.map((cell) => (typeof cell === 'string' && cell[0] === '=' ? adjustFormula(cell, spec) : cell)));
}

export function insertRows(sheet, at, count = 1) {
  const s = clone(sheet);
  const blanks = Array.from({ length: count }, () => []);
  s.rows.splice(Math.min(at, s.rows.length), 0, ...blanks);
  s.rows = adjustAllFormulas(s.rows, { axis: 'row', at, delta: count });
  s.fmts = remapFmts(sheet.fmts || {}, (r, c) => ({ r: r >= at ? r + count : r, c }));
  s.rowHeights = remapIndexMap(sheet.rowHeights || {}, (i) => (i >= at ? i + count : i));
  s.merges = (sheet.merges || []).map(([r1, c1, r2, c2]) => [r1 >= at ? r1 + count : r1, c1, r2 >= at ? r2 + count : r2, c2]);
  return s;
}

export function deleteRows(sheet, at, count = 1) {
  const s = clone(sheet);
  s.rows.splice(at, count);
  s.rows = adjustAllFormulas(s.rows, { axis: 'row', at, delta: -count });
  s.fmts = remapFmts(sheet.fmts || {}, (r, c) => {
    if (r >= at && r < at + count) return null;
    return { r: r >= at + count ? r - count : r, c };
  });
  s.rowHeights = remapIndexMap(sheet.rowHeights || {}, (i) => (i >= at && i < at + count ? null : i >= at + count ? i - count : i));
  s.merges = (sheet.merges || [])
    .filter(([r1, , r2]) => r2 < at || r1 >= at + count) // drop merges overlapping the deleted band
    .map(([r1, c1, r2, c2]) => [r1 >= at + count ? r1 - count : r1, c1, r2 >= at + count ? r2 - count : r2, c2]);
  return s;
}

export function insertCols(sheet, at, count = 1) {
  const s = clone(sheet);
  s.rows = s.rows.map((row) => { const r = row.slice(); r.splice(Math.min(at, r.length), 0, ...Array.from({ length: count }, () => '')); return r; });
  s.rows = adjustAllFormulas(s.rows, { axis: 'col', at, delta: count });
  s.fmts = remapFmts(sheet.fmts || {}, (r, c) => ({ r, c: c >= at ? c + count : c }));
  s.colWidths = remapIndexMap(sheet.colWidths || {}, (i) => (i >= at ? i + count : i));
  s.merges = (sheet.merges || []).map(([r1, c1, r2, c2]) => [r1, c1 >= at ? c1 + count : c1, r2, c2 >= at ? c2 + count : c2]);
  return s;
}

export function deleteCols(sheet, at, count = 1) {
  const s = clone(sheet);
  s.rows = s.rows.map((row) => { const r = row.slice(); r.splice(at, count); return r; });
  s.rows = adjustAllFormulas(s.rows, { axis: 'col', at, delta: -count });
  s.fmts = remapFmts(sheet.fmts || {}, (r, c) => {
    if (c >= at && c < at + count) return null;
    return { r, c: c >= at + count ? c - count : c };
  });
  s.colWidths = remapIndexMap(sheet.colWidths || {}, (i) => (i >= at && i < at + count ? null : i >= at + count ? i - count : i));
  s.merges = (sheet.merges || [])
    .filter(([, c1, , c2]) => c2 < at || c1 >= at + count) // drop merges overlapping the deleted band
    .map(([r1, c1, r2, c2]) => [r1, c1 >= at + count ? c1 - count : c1, r2, c2 >= at + count ? c2 - count : c2]);
  return s;
}

// Sort the rows of a range by one column (absolute index), carrying each row's
// values AND per-cell formatting. Formula text is preserved as-is.
export function sortRange(sheet, rg, byCol, asc = true) {
  const s = clone(sheet);
  const { r1, c1, r2, c2 } = rg;
  const parseVal = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isNaN(n) ? String(v).toLowerCase() : n;
  };
  const bundle = [];
  for (let r = r1; r <= r2; r++) {
    const vals = [];
    const fmts = [];
    for (let c = c1; c <= c2; c++) { vals.push(s.rows[r]?.[c] ?? ''); fmts.push(sheet.fmts?.[key(r, c)]); }
    bundle.push({ vals, fmts, sortKey: parseVal(s.rows[r]?.[byCol] ?? '') });
  }
  bundle.sort((a, b) => {
    const x = a.sortKey; const y = b.sortKey;
    if (x === null) return y === null ? 0 : 1; // blanks last
    if (y === null) return -1;
    const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
    return asc ? cmp : -cmp;
  });
  // clear old fmts in range, write sorted values + fmts back
  const fmts = { ...(sheet.fmts || {}) };
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) delete fmts[key(r, c)];
  bundle.forEach((b, i) => {
    const r = r1 + i;
    while (s.rows.length <= r) s.rows.push([]);
    const row = s.rows[r].slice();
    b.vals.forEach((v, j) => { const c = c1 + j; while (row.length <= c) row.push(''); row[c] = v; if (b.fmts[j]) fmts[key(r, c)] = b.fmts[j]; });
    s.rows[r] = row;
  });
  s.fmts = fmts;
  return s;
}

// Merge a formatting patch into every cell of a range (removing keys set to
// undefined). Returns a new fmts map.
export function patchFmts(fmts, rg, patch) {
  const out = { ...(fmts || {}) };
  for (let r = rg.r1; r <= rg.r2; r++) {
    for (let c = rg.c1; c <= rg.c2; c++) {
      const k = key(r, c);
      const merged = { ...(out[k] || {}), ...patch };
      Object.keys(merged).forEach((p) => { if (merged[p] === undefined || merged[p] === false || merged[p] === null) delete merged[p]; });
      if (Object.keys(merged).length) out[k] = merged; else delete out[k];
    }
  }
  return out;
}
