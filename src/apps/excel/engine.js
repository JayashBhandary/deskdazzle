// Workbook computation layer over the formula engine. It owns the memo cache
// and cycle detection, and hands the formula evaluator a `resolver` that returns
// a referenced cell's *value* (recursing into other formulas) so dependency
// recalculation happens on demand — only the cells you actually read (the
// visible window + their dependencies) get computed, which keeps huge sheets
// cheap.
//
// One engine instance is bound to a specific `sheets` snapshot. Any edit
// produces a new sheets array (copy-on-write in ExcelApp), so the UI just builds
// a fresh engine and the stale cache is discarded.

import { evaluateFormula, displayValue, formatByCode, FormulaError, ERR } from './formula';

const isFormulaText = (v) => typeof v === 'string' && v[0] === '=' && v.length > 1;

export function createEngine(sheets) {
  const list = Array.isArray(sheets) ? sheets : [];
  const byName = new Map();
  list.forEach((s, i) => byName.set(String(s?.name || '').toLowerCase(), i));

  const cache = new Map(); // "si:r:c" -> scalar value | FormulaError
  const visiting = new Set();
  const key = (si, r, c) => `${si}:${r}:${c}`;

  const rawAt = (si, r, c) => list[si]?.rows?.[r]?.[c] ?? '';

  function computeCell(si, r, c) {
    if (si === undefined || si < 0 || si >= list.length || r < 0 || c < 0) {
      return new FormulaError(ERR.REF);
    }
    const raw = rawAt(si, r, c);
    if (!isFormulaText(raw)) return raw; // literal — resolver coerces it
    const k = key(si, r, c);
    if (cache.has(k)) return cache.get(k);
    if (visiting.has(k)) return new FormulaError(ERR.CIRC); // cycle — don't cache
    visiting.add(k);
    let val;
    try {
      val = evaluateFormula(raw.slice(1), makeResolver(si), list[si].name);
    } finally {
      visiting.delete(k);
    }
    cache.set(k, val);
    return val;
  }

  // A resolver bound to the sheet a formula lives on, so bare refs (no "Sheet!")
  // resolve against that sheet while "Other!A1" resolves cross-sheet.
  function makeResolver(homeSi) {
    const resolveIdx = (sheetName) =>
      sheetName == null ? homeSi : byName.get(String(sheetName).toLowerCase());
    const resolver = (sheetName, r, c) => computeCell(resolveIdx(sheetName), r, c);
    resolver.bounds = (sheetName) => {
      const si = resolveIdx(sheetName);
      const rows = list[si]?.rows || [];
      let cols = 0;
      for (const row of rows) if (row.length > cols) cols = row.length;
      return { rows: Math.max(rows.length, 1), cols: Math.max(cols, 1) };
    };
    return resolver;
  }

  return {
    // Computed scalar value (or FormulaError) of a cell on sheet `si`.
    value: (si, r, c) => computeCell(si, r, c),
    // What the grid shows: formulas show their result, literals show as typed.
    display: (si, r, c) => {
      const raw = rawAt(si, r, c);
      return isFormulaText(raw) ? displayValue(computeCell(si, r, c)) : (raw ?? '');
    },
    // True when the cell holds a formula (drives the "show raw while editing").
    isFormula: (si, r, c) => isFormulaText(rawAt(si, r, c)),
    // Display text + value type, so the grid can right-align numbers and paint
    // errors red — matching Excel's type-driven presentation.
    typed: (si, r, c) => {
      const raw = rawAt(si, r, c);
      const code = list[si]?.fmts?.[`${r}:${c}`]?.numFmt;
      const fmtNum = (v, fallback) => (code ? (formatByCode(v, code) ?? fallback) : fallback);
      if (isFormulaText(raw)) {
        const v = computeCell(si, r, c);
        if (v && v.isFormulaError) return { text: v.code, type: 'error' };
        if (typeof v === 'number') return { text: fmtNum(v, displayValue(v)), type: 'number' };
        if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE', type: 'bool' };
        if (v === null || v === '') return { text: '', type: 'empty' };
        return { text: displayValue(v), type: 'text' };
      }
      if (raw === '' || raw == null) return { text: '', type: 'empty' };
      const s = String(raw).trim();
      if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return { text: fmtNum(Number(s), String(raw)), type: 'number' };
      const up = s.toUpperCase();
      if (up === 'TRUE' || up === 'FALSE') return { text: up, type: 'bool' };
      return { text: String(raw), type: 'text' };
    },
  };
}
