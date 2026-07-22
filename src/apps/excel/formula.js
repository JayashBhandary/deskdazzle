// A real spreadsheet formula engine: tokenizer → recursive-descent parser →
// evaluator, plus a library of ~70 Excel functions. It is deliberately
// self-contained (no deps) and resolver-driven: the engine never reads the grid
// directly — it asks a `resolver(sheetName, row, col)` supplied by engine.js for
// every cell reference, so the same code handles single- and cross-sheet refs
// and lazy recalculation.

// ---- errors -------------------------------------------------------------
// Any error thrown during evaluation is a FormulaError; the cell compute layer
// catches it and shows its code (e.g. "#DIV/0!"). Errors thrown from ctx.ev
// propagate naturally, so functions get correct #VALUE!/#REF! semantics for
// free — IFERROR/IFNA just try/catch around it.
export class FormulaError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.isFormulaError = true;
  }
}
export const ERR = {
  DIV0: '#DIV/0!',
  VALUE: '#VALUE!',
  REF: '#REF!',
  NAME: '#NAME?',
  NA: '#N/A',
  NUM: '#NUM!',
  CIRC: '#CIRC!',
};
const err = (code) => { throw new FormulaError(code); };

// A range value flowing through evaluation: a 2D array of scalar cell values.
const isRange = (v) => v && typeof v === 'object' && v.__range === true;
const mkRange = (cells) => ({ __range: true, cells });

// ---- column letters <-> index ------------------------------------------
export function colToIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function indexToCol(n) {
  let s = '';
  let i = n;
  do {
    s = String.fromCharCode(65 + (i % 26)) + s;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return s;
}

// ---- tokenizer ----------------------------------------------------------
const RE = {
  ws: /^\s+/,
  num: /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/,
  str: /^"(?:[^"]|"")*"/,
  // function name immediately followed by "(" — checked before ref so LOG10(
  // isn't mistaken for the ref "LOG10".
  func: /^[A-Za-z_][A-Za-z0-9_.]*(?=\s*\()/,
  // optional sheet prefix, then A1 / $A$1 (col up to 3 letters).
  ref: /^(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?[A-Za-z]{1,3}\$?\d+/,
  // full-column (A:A) / full-row (1:1) handled in parser via ':'; bare column
  // or row endpoints:
  colref: /^(?:(?:'[^']+'|[A-Za-z_][A-Za-z0-9_.]*)!)?\$?[A-Za-z]{1,3}(?![A-Za-z0-9_])/,
  ident: /^[A-Za-z_][A-Za-z0-9_.]*/,
};

function tokenize(src) {
  const t = [];
  let s = src;
  const push = (type, value) => t.push({ type, value });
  while (s.length) {
    let m;
    if ((m = RE.ws.exec(s))) { s = s.slice(m[0].length); continue; }
    if ((m = RE.str.exec(s))) { push('str', m[0].slice(1, -1).replace(/""/g, '"')); s = s.slice(m[0].length); continue; }
    if ((m = RE.func.exec(s))) { push('func', m[0]); s = s.slice(m[0].length); continue; }
    if ((m = RE.ref.exec(s))) { push('ref', m[0]); s = s.slice(m[0].length); continue; }
    if ((m = RE.num.exec(s))) { push('num', m[0]); s = s.slice(m[0].length); continue; }
    // two-char operators first
    const two = s.slice(0, 2);
    if (two === '<>' || two === '<=' || two === '>=') { push('op', two); s = s.slice(2); continue; }
    const ch = s[0];
    if ('+-*/^&=<>%(),:'.includes(ch)) { push('op', ch); s = s.slice(1); continue; }
    if ((m = RE.colref.exec(s))) { push('colref', m[0]); s = s.slice(m[0].length); continue; }
    if ((m = RE.ident.exec(s))) { push('ident', m[0]); s = s.slice(m[0].length); continue; }
    err(ERR.NAME);
  }
  push('eof', null);
  return t;
}

// ---- parser -------------------------------------------------------------
// AST nodes: {k:'num'|'str'|'bool'|'ref'|'range'|'unary'|'binary'|'call'|'name'}
function parse(tokens) {
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const eat = (type, value) => {
    const tk = tokens[i];
    if (tk.type !== type || (value !== undefined && tk.value !== value)) err(ERR.NA);
    i++;
    return tk;
  };

  // binding powers for infix operators (higher = tighter)
  const BP = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 6 };

  function parseRefNode(raw) {
    // split optional sheet prefix
    let sheet = null;
    let cell = raw;
    const bang = raw.indexOf('!');
    if (bang >= 0) {
      sheet = raw.slice(0, bang);
      if (sheet[0] === "'") sheet = sheet.slice(1, -1);
      cell = raw.slice(bang + 1);
    }
    const mm = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(cell);
    if (!mm) err(ERR.REF);
    return { k: 'ref', sheet, col: colToIndex(mm[2]), row: parseInt(mm[4], 10) - 1 };
  }

  function primary() {
    const tk = peek();
    if (tk.type === 'num') { next(); return { k: 'num', v: parseFloat(tk.value) }; }
    if (tk.type === 'str') { next(); return { k: 'str', v: tk.value }; }
    if (tk.type === 'op' && (tk.value === '-' || tk.value === '+')) {
      next();
      return { k: 'unary', op: tk.value, a: unaryTail() };
    }
    if (tk.type === 'op' && tk.value === '(') {
      next();
      const e = expr(0);
      eat('op', ')');
      return e;
    }
    if (tk.type === 'func') {
      const name = tk.value.toUpperCase();
      next();
      eat('op', '(');
      const args = [];
      if (!(peek().type === 'op' && peek().value === ')')) {
        args.push(expr(0));
        while (peek().type === 'op' && peek().value === ',') { next(); args.push(expr(0)); }
      }
      eat('op', ')');
      return { k: 'call', name, args };
    }
    if (tk.type === 'ref' || tk.type === 'colref') {
      next();
      const start = tk.value;
      // range?
      if (peek().type === 'op' && peek().value === ':') {
        next();
        const endTk = peek();
        if (endTk.type !== 'ref' && endTk.type !== 'colref') err(ERR.REF);
        next();
        return { k: 'range', a: start, b: endTk.value };
      }
      if (tk.type === 'colref') err(ERR.REF); // a bare column only valid inside a range
      return parseRefNode(start);
    }
    if (tk.type === 'ident') {
      next();
      const up = tk.value.toUpperCase();
      if (up === 'TRUE') return { k: 'bool', v: true };
      if (up === 'FALSE') return { k: 'bool', v: false };
      return { k: 'name', name: up }; // resolves to #NAME? at eval (no named ranges yet)
    }
    err(ERR.NA);
    return null;
  }

  // postfix % binds tighter than ^
  function postfix(node) {
    while (peek().type === 'op' && peek().value === '%') {
      next();
      node = { k: 'unary', op: '%', a: node };
    }
    return node;
  }
  function unaryTail() { return postfix(primary()); }

  function expr(minbp) {
    let left = unaryTail();
    for (;;) {
      const tk = peek();
      if (tk.type !== 'op' || !(tk.value in BP)) break;
      const bp = BP[tk.value];
      if (bp < minbp) break;
      next();
      // ^ is right-associative
      const right = expr(tk.value === '^' ? bp : bp + 1);
      left = { k: 'binary', op: tk.value, a: left, b: right };
    }
    return left;
  }

  const tree = expr(0);
  if (peek().type !== 'eof') err(ERR.NA);
  return tree;
}

// cheap parse cache keyed on the formula text
const parseCache = new Map();
function parseFormula(text) {
  let ast = parseCache.get(text);
  if (ast === undefined) {
    ast = parse(tokenize(text));
    if (parseCache.size > 5000) parseCache.clear();
    parseCache.set(text, ast);
  }
  return ast;
}

// ---- value coercion -----------------------------------------------------
export const isBlank = (v) => v === null || v === undefined || v === '';

export function toNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (isBlank(v)) return 0;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return 0;
    const n = Number(s);
    if (!Number.isNaN(n)) return n;
    // percent literal like "50%"
    if (/^-?\d*\.?\d+%$/.test(s)) return Number(s.slice(0, -1)) / 100;
    err(ERR.VALUE);
  }
  err(ERR.VALUE);
  return 0;
}
export function toText(v) {
  if (isBlank(v)) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return numToStr(v);
  return String(v);
}
export function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (isBlank(v)) return false;
  const s = String(v).trim().toUpperCase();
  if (s === 'TRUE') return true;
  if (s === 'FALSE') return false;
  return toNumber(v) !== 0;
}

// Number → clean string (trim float noise; Excel-ish 15 sig figs).
export function numToStr(n) {
  if (!Number.isFinite(n)) return n > 0 ? ERR.NUM : (n < 0 ? ERR.NUM : ERR.NUM);
  if (Number.isInteger(n)) return String(n);
  let s = n.toPrecision(15);
  if (s.includes('.') && !s.includes('e') && !s.includes('E')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  const back = Number(s);
  return String(back);
}

// ---- evaluator ----------------------------------------------------------
// resolver(sheetName|null, row, col) -> raw cell string ('' when blank) OR
// throws FormulaError('#CIRC!') on a cycle. The engine layer implements it.
function makeCtx(resolver, curSheet) {
  const ctx = {};

  // Evaluate a literal cell string into a scalar value.
  const literal = (raw) => {
    if (isBlank(raw)) return null;
    if (typeof raw !== 'string') return raw;
    const s = raw.trim();
    if (s === '') return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(s)) return Number(s);
    const up = s.toUpperCase();
    if (up === 'TRUE') return true;
    if (up === 'FALSE') return false;
    return raw;
  };

  // Evaluate a single cell reference to its VALUE (recursing into formulas via
  // the resolver, which returns the already-computed display for formula cells).
  const cellValue = (sheet, row, col) => {
    const raw = resolver(sheet, row, col); // may throw #CIRC!
    if (raw && typeof raw === 'object' && raw.isFormulaError) throw raw;
    return literal(raw);
  };

  const rangeCells = (aRaw, bRaw) => {
    const parseEnd = (raw) => {
      let sheet = curSheet;
      let cell = raw;
      const bang = raw.indexOf('!');
      if (bang >= 0) {
        sheet = raw.slice(0, bang);
        if (sheet[0] === "'") sheet = sheet.slice(1, -1);
        cell = raw.slice(bang + 1);
      }
      const full = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(cell);
      if (full) return { sheet, col: colToIndex(full[2]), row: parseInt(full[4], 10) - 1 };
      const colOnly = /^(\$?)([A-Za-z]{1,3})$/.exec(cell);
      if (colOnly) return { sheet, col: colToIndex(colOnly[2]), row: null };
      const rowOnly = /^(\$?)(\d+)$/.exec(cell);
      if (rowOnly) return { sheet, col: null, row: parseInt(rowOnly[2], 10) - 1 };
      err(ERR.REF);
      return null;
    };
    const a = parseEnd(aRaw);
    const b = parseEnd(bRaw);
    const sheet = a.sheet;
    const bounds = resolver.bounds ? resolver.bounds(sheet) : { rows: 1000, cols: 100 };
    const r1 = a.row === null ? 0 : Math.min(a.row, b.row);
    const r2 = a.row === null ? bounds.rows - 1 : Math.max(a.row, b.row);
    const c1 = a.col === null ? 0 : Math.min(a.col, b.col);
    const c2 = a.col === null ? bounds.cols - 1 : Math.max(a.col, b.col);
    const cells = [];
    for (let r = r1; r <= r2; r++) {
      const line = [];
      for (let c = c1; c <= c2; c++) line.push(cellValue(sheet, r, c));
      cells.push(line);
    }
    return mkRange(cells);
  };

  ctx.ev = (node) => {
    switch (node.k) {
      case 'num': return node.v;
      case 'str': return node.v;
      case 'bool': return node.v;
      case 'name': return err(ERR.NAME);
      case 'ref': return cellValue(node.sheet ?? curSheet, node.row, node.col);
      case 'range': return rangeCells(node.a, node.b);
      case 'unary': {
        if (node.op === '%') return toNumber(ctx.scalar(node.a)) / 100;
        const v = toNumber(ctx.scalar(node.a));
        return node.op === '-' ? -v : v;
      }
      case 'binary': return evalBinary(node);
      case 'call': return evalCall(node);
      default: return err(ERR.VALUE);
    }
  };

  // scalar: collapse a 1×1 range, else error on a real range.
  ctx.scalar = (node) => {
    const v = ctx.ev(node);
    if (isRange(v)) {
      if (v.cells.length === 1 && v.cells[0].length === 1) return v.cells[0][0];
      err(ERR.VALUE);
    }
    return v;
  };
  ctx.num = (node) => toNumber(ctx.scalar(node));
  ctx.text = (node) => toText(ctx.scalar(node));
  ctx.bool = (node) => toBool(ctx.scalar(node));

  // Flatten node(s) to a scalar list (for aggregation). Ranges contribute all
  // cells; direct scalars contribute themselves.
  ctx.flat = (nodes) => {
    const out = [];
    for (const n of nodes) {
      const v = ctx.ev(n);
      if (isRange(v)) { for (const line of v.cells) for (const c of line) out.push(c); }
      else out.push(v);
    }
    return out;
  };
  // Numbers only, applying Excel aggregation rules (text/blank in ranges are
  // ignored; direct scalar text that is numeric is coerced).
  ctx.numbers = (nodes) => {
    const out = [];
    for (const n of nodes) {
      const v = ctx.ev(n);
      if (isRange(v)) {
        for (const line of v.cells) for (const c of line) if (typeof c === 'number') out.push(c);
      } else if (typeof v === 'number') out.push(v);
      else if (typeof v === 'boolean') out.push(v ? 1 : 0);
      else if (!isBlank(v)) out.push(toNumber(v)); // may throw #VALUE! for junk text
    }
    return out;
  };
  ctx.matrix = (node) => {
    const v = ctx.ev(node);
    if (isRange(v)) return v.cells;
    return [[v]];
  };
  ctx.raw = (node) => ctx.ev(node);

  function evalBinary(node) {
    const op = node.op;
    if (op === '&') return toText(ctx.scalar(node.a)) + toText(ctx.scalar(node.b));
    if (op === '+' || op === '-' || op === '*' || op === '/' || op === '^') {
      const a = ctx.num(node.a);
      const b = ctx.num(node.b);
      switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? err(ERR.DIV0) : a / b;
        case '^': { const r = Math.pow(a, b); return Number.isFinite(r) ? r : err(ERR.NUM); }
        default: return err(ERR.VALUE);
      }
    }
    // comparison
    const a = ctx.scalar(node.a);
    const b = ctx.scalar(node.b);
    const cmp = compareValues(a, b);
    switch (op) {
      case '=': return cmp === 0;
      case '<>': return cmp !== 0;
      case '<': return cmp < 0;
      case '>': return cmp > 0;
      case '<=': return cmp <= 0;
      case '>=': return cmp >= 0;
      default: return err(ERR.VALUE);
    }
  }

  function evalCall(node) {
    const fn = FUNCTIONS[node.name];
    if (!fn) err(ERR.NAME);
    return fn(node.args, ctx);
  }

  return ctx;
}

// Excel comparison: numbers/blank numeric, text case-insensitive, text > number.
function compareValues(a, b) {
  const an = isBlank(a) ? null : a;
  const bn = isBlank(b) ? null : b;
  const ta = typeof an;
  const tb = typeof bn;
  if ((ta === 'number' || an === null) && (tb === 'number' || bn === null)) {
    return (an ?? 0) - (bn ?? 0);
  }
  if (ta === 'boolean' && tb === 'boolean') return (an ? 1 : 0) - (bn ? 1 : 0);
  const sa = toText(an).toUpperCase();
  const sb = toText(bn).toUpperCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

// ---- criteria matching (COUNTIF/SUMIF/…) --------------------------------
function matchCriteria(value, criteria) {
  let op = '=';
  let target = criteria;
  if (typeof criteria === 'string') {
    const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(criteria);
    if (m) { op = m[1]; target = m[2]; }
    else { op = '='; target = criteria; }
  }
  // numeric target?
  const tnum = typeof target === 'string' && target.trim() !== '' && !Number.isNaN(Number(target))
    ? Number(target) : target;
  if ((op === '=' || op === '<>') && typeof tnum === 'string') {
    // wildcard text match
    const rx = wildcardToRegExp(tnum);
    const hit = rx.test(toText(value));
    return op === '=' ? hit : !hit;
  }
  const cmp = compareValues(value, tnum);
  switch (op) {
    case '=': return cmp === 0;
    case '<>': return cmp !== 0;
    case '<': return cmp < 0;
    case '>': return cmp > 0;
    case '<=': return cmp <= 0;
    case '>=': return cmp >= 0;
    default: return false;
  }
}
function wildcardToRegExp(pat) {
  let out = '';
  for (let i = 0; i < pat.length; i++) {
    const ch = pat[i];
    if (ch === '~' && (pat[i + 1] === '*' || pat[i + 1] === '?')) { out += pat[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; }
    else if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`, 'i');
}

// ---- date serials (Excel 1900 system) -----------------------------------
const DAY_MS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30); // Excel day 0 (accounts for the 1900 leap bug offset)
function dateToSerial(y, m, d) { return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS); }
function serialToDate(serial) { return new Date(EPOCH + Math.round(serial) * DAY_MS); }
function todaySerial() { return dateToSerial(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()); }
function nowSerial() { return (Date.now() - EPOCH) / DAY_MS; }

// ---- function library ---------------------------------------------------
const FUNCTIONS = {
  // math / aggregation
  SUM: (a, c) => c.numbers(a).reduce((s, n) => s + n, 0),
  PRODUCT: (a, c) => c.numbers(a).reduce((s, n) => s * n, 1),
  AVERAGE: (a, c) => { const n = c.numbers(a); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : err(ERR.DIV0); },
  AVERAGEA: (a, c) => { const v = c.flat(a).filter((x) => !isBlank(x)); return v.length ? v.reduce((s, x) => s + toNumber(x), 0) / v.length : err(ERR.DIV0); },
  COUNT: (a, c) => c.flat(a).filter((v) => typeof v === 'number').length,
  COUNTA: (a, c) => c.flat(a).filter((v) => !isBlank(v)).length,
  COUNTBLANK: (a, c) => c.flat(a).filter((v) => isBlank(v)).length,
  MAX: (a, c) => { const n = c.numbers(a); return n.length ? Math.max(...n) : 0; },
  MIN: (a, c) => { const n = c.numbers(a); return n.length ? Math.min(...n) : 0; },
  MEDIAN: (a, c) => { const n = c.numbers(a).sort((x, y) => x - y); if (!n.length) return err(ERR.NUM); const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; },
  MODE: (a, c) => { const n = c.numbers(a); const cnt = new Map(); let best = null, bc = 1; for (const x of n) { const k = (cnt.get(x) || 0) + 1; cnt.set(x, k); if (k > bc) { bc = k; best = x; } } return best === null ? err(ERR.NA) : best; },
  ABS: (a, c) => Math.abs(c.num(a[0])),
  SIGN: (a, c) => Math.sign(c.num(a[0])),
  SQRT: (a, c) => { const x = c.num(a[0]); return x < 0 ? err(ERR.NUM) : Math.sqrt(x); },
  POWER: (a, c) => { const r = Math.pow(c.num(a[0]), c.num(a[1])); return Number.isFinite(r) ? r : err(ERR.NUM); },
  EXP: (a, c) => Math.exp(c.num(a[0])),
  LN: (a, c) => { const x = c.num(a[0]); return x <= 0 ? err(ERR.NUM) : Math.log(x); },
  LOG10: (a, c) => { const x = c.num(a[0]); return x <= 0 ? err(ERR.NUM) : Math.log10(x); },
  LOG: (a, c) => { const x = c.num(a[0]); const b = a[1] ? c.num(a[1]) : 10; return x <= 0 ? err(ERR.NUM) : Math.log(x) / Math.log(b); },
  MOD: (a, c) => { const d = c.num(a[1]); if (d === 0) return err(ERR.DIV0); const n = c.num(a[0]); return n - d * Math.floor(n / d); },
  QUOTIENT: (a, c) => { const d = c.num(a[1]); if (d === 0) return err(ERR.DIV0); return Math.trunc(c.num(a[0]) / d); },
  INT: (a, c) => Math.floor(c.num(a[0])),
  TRUNC: (a, c) => { const d = a[1] ? c.num(a[1]) : 0; const f = 10 ** d; return Math.trunc(c.num(a[0]) * f) / f; },
  ROUND: (a, c) => { const d = a[1] ? c.num(a[1]) : 0; const f = 10 ** d; return Math.round((c.num(a[0]) + Number.EPSILON) * f) / f; },
  ROUNDUP: (a, c) => { const d = a[1] ? c.num(a[1]) : 0; const f = 10 ** d; const x = c.num(a[0]); return (x < 0 ? -Math.ceil(-x * f) : Math.ceil(x * f)) / f; },
  ROUNDDOWN: (a, c) => { const d = a[1] ? c.num(a[1]) : 0; const f = 10 ** d; const x = c.num(a[0]); return (x < 0 ? -Math.floor(-x * f) : Math.floor(x * f)) / f; },
  CEILING: (a, c) => { const sig = a[1] ? c.num(a[1]) : 1; return sig === 0 ? 0 : Math.ceil(c.num(a[0]) / sig) * sig; },
  FLOOR: (a, c) => { const sig = a[1] ? c.num(a[1]) : 1; return sig === 0 ? err(ERR.DIV0) : Math.floor(c.num(a[0]) / sig) * sig; },
  GCD: (a, c) => c.numbers(a).map((x) => Math.abs(Math.trunc(x))).reduce((g, x) => { while (x) { [g, x] = [x, g % x]; } return g; }, 0),
  LCM: (a, c) => c.numbers(a).map((x) => Math.abs(Math.trunc(x))).reduce((l, x) => { if (l === 0 || x === 0) return 0; let g = l, y = x; while (y) { [g, y] = [y, g % y]; } return (l / g) * x; }, 1),
  PI: () => Math.PI,
  RAND: () => Math.random(),
  RANDBETWEEN: (a, c) => { const lo = c.num(a[0]); const hi = c.num(a[1]); return lo + Math.floor(Math.random() * (hi - lo + 1)); },
  SUMPRODUCT: (a, c) => {
    const mats = a.map((n) => c.matrix(n));
    const rows = mats[0].length;
    const cols = mats[0][0]?.length || 0;
    let total = 0;
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      let p = 1;
      for (const m of mats) p *= toNumber(m[r]?.[col] ?? 0);
      total += p;
    }
    return total;
  },
  SUMSQ: (a, c) => c.numbers(a).reduce((s, n) => s + n * n, 0),

  // conditional aggregation
  COUNTIF: (a, c) => { const range = c.matrix(a[0]).flat(); const crit = c.scalar(a[1]); return range.filter((v) => matchCriteria(v, crit)).length; },
  COUNTIFS: (a, c) => countifs(a, c),
  SUMIF: (a, c) => sumif(a, c),
  SUMIFS: (a, c) => sumifs(a, c),
  AVERAGEIF: (a, c) => { const { sum, n } = avgif(a, c); return n ? sum / n : err(ERR.DIV0); },
  AVERAGEIFS: (a, c) => { const { sum, n } = avgifs(a, c); return n ? sum / n : err(ERR.DIV0); },
  MAXIFS: (a, c) => ifExtreme(a, c, Math.max, -Infinity),
  MINIFS: (a, c) => ifExtreme(a, c, Math.min, Infinity),

  // stats
  STDEV: (a, c) => stdev(c.numbers(a), true),
  'STDEV.S': (a, c) => stdev(c.numbers(a), true),
  STDEVP: (a, c) => stdev(c.numbers(a), false),
  'STDEV.P': (a, c) => stdev(c.numbers(a), false),
  VAR: (a, c) => variance(c.numbers(a), true),
  VARP: (a, c) => variance(c.numbers(a), false),
  LARGE: (a, c) => { const n = c.numbers([a[0]]).sort((x, y) => y - x); const k = c.num(a[1]); return n[k - 1] ?? err(ERR.NUM); },
  SMALL: (a, c) => { const n = c.numbers([a[0]]).sort((x, y) => x - y); const k = c.num(a[1]); return n[k - 1] ?? err(ERR.NUM); },
  RANK: (a, c) => { const x = c.num(a[0]); const arr = c.numbers([a[1]]); const asc = a[2] ? c.bool(a[2]) : false; const sorted = arr.slice().sort((p, q) => asc ? p - q : q - p); const idx = sorted.indexOf(x); return idx < 0 ? err(ERR.NA) : idx + 1; },

  // logical (lazy where needed via node args)
  IF: (a, c) => (c.bool(a[0]) ? (a[1] ? c.ev(a[1]) : true) : (a[2] ? c.ev(a[2]) : false)),
  IFS: (a, c) => { for (let i = 0; i + 1 < a.length; i += 2) if (c.bool(a[i])) return c.ev(a[i + 1]); return err(ERR.NA); },
  IFERROR: (a, c) => { try { return c.ev(a[0]); } catch (e) { if (e.isFormulaError) return c.ev(a[1]); throw e; } },
  IFNA: (a, c) => { try { return c.ev(a[0]); } catch (e) { if (e.isFormulaError && e.code === ERR.NA) return c.ev(a[1]); throw e; } },
  AND: (a, c) => c.flat(a).filter((v) => !isBlank(v)).every((v) => toBool(v)),
  OR: (a, c) => c.flat(a).filter((v) => !isBlank(v)).some((v) => toBool(v)),
  XOR: (a, c) => c.flat(a).filter((v) => !isBlank(v)).reduce((acc, v) => acc !== toBool(v), false),
  NOT: (a, c) => !c.bool(a[0]),
  TRUE: () => true,
  FALSE: () => false,
  SWITCH: (a, c) => {
    const target = c.scalar(a[0]);
    let i = 1;
    for (; i + 1 < a.length; i += 2) if (compareValues(target, c.scalar(a[i])) === 0) return c.ev(a[i + 1]);
    return i < a.length ? c.ev(a[i]) : err(ERR.NA); // trailing default
  },

  // information
  ISBLANK: (a, c) => isBlank(c.scalar(a[0])),
  ISNUMBER: (a, c) => { try { return typeof c.scalar(a[0]) === 'number'; } catch { return false; } },
  ISTEXT: (a, c) => { try { return typeof c.scalar(a[0]) === 'string'; } catch { return false; } },
  ISNONTEXT: (a, c) => { try { return typeof c.scalar(a[0]) !== 'string'; } catch { return true; } },
  ISLOGICAL: (a, c) => { try { return typeof c.scalar(a[0]) === 'boolean'; } catch { return false; } },
  ISERROR: (a, c) => { try { c.ev(a[0]); return false; } catch (e) { if (e.isFormulaError) return true; throw e; } },
  ISERR: (a, c) => { try { c.ev(a[0]); return false; } catch (e) { if (e.isFormulaError) return e.code !== ERR.NA; throw e; } },
  ISNA: (a, c) => { try { c.ev(a[0]); return false; } catch (e) { if (e.isFormulaError) return e.code === ERR.NA; throw e; } },
  NA: () => err(ERR.NA),
  N: (a, c) => { const v = c.scalar(a[0]); return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : 0; },
  IFERROR2: null,

  // text
  CONCAT: (a, c) => c.flat(a).map(toText).join(''),
  CONCATENATE: (a, c) => a.map((n) => toText(c.scalar(n))).join(''),
  TEXTJOIN: (a, c) => { const delim = toText(c.scalar(a[0])); const skip = c.bool(a[1]); const vals = c.flat(a.slice(2)); return vals.filter((v) => !skip || !isBlank(v)).map(toText).join(delim); },
  LEN: (a, c) => toText(c.scalar(a[0])).length,
  LOWER: (a, c) => c.text(a[0]).toLowerCase(),
  UPPER: (a, c) => c.text(a[0]).toUpperCase(),
  PROPER: (a, c) => c.text(a[0]).replace(/\b\w/g, (m) => m.toUpperCase()).replace(/\B\w/g, (m) => m.toLowerCase()),
  TRIM: (a, c) => c.text(a[0]).replace(/\s+/g, ' ').trim(),
  LEFT: (a, c) => c.text(a[0]).slice(0, a[1] ? c.num(a[1]) : 1),
  RIGHT: (a, c) => { const s = c.text(a[0]); const n = a[1] ? c.num(a[1]) : 1; return n <= 0 ? '' : s.slice(Math.max(0, s.length - n)); },
  MID: (a, c) => { const start = c.num(a[1]); const len = c.num(a[2]); return start < 1 ? err(ERR.VALUE) : c.text(a[0]).substr(start - 1, len); },
  REPT: (a, c) => { const n = c.num(a[1]); return n < 0 ? err(ERR.VALUE) : c.text(a[0]).repeat(n); },
  SUBSTITUTE: (a, c) => {
    const text = c.text(a[0]); const oldT = c.text(a[1]); const newT = c.text(a[2]);
    if (oldT === '') return text;
    if (a[3]) { let n = c.num(a[3]); let idx = -1; while (n-- > 0) { idx = text.indexOf(oldT, idx + 1); if (idx < 0) return text; } return text.slice(0, idx) + newT + text.slice(idx + oldT.length); }
    return text.split(oldT).join(newT);
  },
  REPLACE: (a, c) => { const s = c.text(a[0]); const start = c.num(a[1]); const len = c.num(a[2]); const repl = c.text(a[3]); return s.slice(0, start - 1) + repl + s.slice(start - 1 + len); },
  FIND: (a, c) => { const pos = c.text(a[1]).indexOf(c.text(a[0]), a[2] ? c.num(a[2]) - 1 : 0); return pos < 0 ? err(ERR.VALUE) : pos + 1; },
  SEARCH: (a, c) => { const rx = wildcardToRegExp('*' + c.text(a[0]) + '*'); void rx; const hay = c.text(a[1]).toLowerCase(); const needle = c.text(a[0]).toLowerCase(); const pos = hay.indexOf(needle, a[2] ? c.num(a[2]) - 1 : 0); return pos < 0 ? err(ERR.VALUE) : pos + 1; },
  EXACT: (a, c) => c.text(a[0]) === c.text(a[1]),
  VALUE: (a, c) => toNumber(c.scalar(a[0])),
  TEXT: (a, c) => formatText(c.scalar(a[0]), c.text(a[1])),
  CHAR: (a, c) => String.fromCharCode(c.num(a[0])),
  CODE: (a, c) => { const s = c.text(a[0]); return s.length ? s.charCodeAt(0) : err(ERR.VALUE); },
  UNICHAR: (a, c) => String.fromCodePoint(c.num(a[0])),
  T: (a, c) => { const v = c.scalar(a[0]); return typeof v === 'string' ? v : ''; },

  // lookup / reference
  VLOOKUP: (a, c) => vlookup(a, c),
  HLOOKUP: (a, c) => hlookup(a, c),
  XLOOKUP: (a, c) => xlookup(a, c),
  LOOKUP: (a, c) => lookup(a, c),
  INDEX: (a, c) => index(a, c),
  MATCH: (a, c) => match(a, c),
  CHOOSE: (a, c) => { const i = c.num(a[0]); return a[i] ? c.ev(a[i]) : err(ERR.VALUE); },
  ROWS: (a, c) => c.matrix(a[0]).length,
  COLUMNS: (a, c) => c.matrix(a[0])[0]?.length || 0,

  // date / time
  TODAY: () => todaySerial(),
  NOW: () => nowSerial(),
  DATE: (a, c) => dateToSerial(c.num(a[0]), c.num(a[1]), c.num(a[2])),
  YEAR: (a, c) => serialToDate(c.num(a[0])).getUTCFullYear(),
  MONTH: (a, c) => serialToDate(c.num(a[0])).getUTCMonth() + 1,
  DAY: (a, c) => serialToDate(c.num(a[0])).getUTCDate(),
  HOUR: (a, c) => { const f = c.num(a[0]); return Math.floor(((f % 1) + 1) % 1 * 24 + 1e-9); },
  MINUTE: (a, c) => { const f = c.num(a[0]) * 24; return Math.floor(((f % 1) + 1) % 1 * 60 + 1e-9); },
  SECOND: (a, c) => { const f = c.num(a[0]) * 24 * 60; return Math.round(((f % 1) + 1) % 1 * 60); },
  WEEKDAY: (a, c) => { const d = serialToDate(c.num(a[0])).getUTCDay(); const type = a[1] ? c.num(a[1]) : 1; if (type === 1) return d + 1; if (type === 2) return d === 0 ? 7 : d; if (type === 3) return d === 0 ? 6 : d - 1; return d + 1; },
  WEEKNUM: (a, c) => { const dt = serialToDate(c.num(a[0])); const start = Date.UTC(dt.getUTCFullYear(), 0, 1); return Math.floor((dt - start) / DAY_MS / 7) + 1; },
  EOMONTH: (a, c) => { const d = serialToDate(c.num(a[0])); const m = c.num(a[1]); return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + m + 1, 0); },
  EDATE: (a, c) => { const d = serialToDate(c.num(a[0])); const m = c.num(a[1]); return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + m, d.getUTCDate()); },
  DATEDIF: (a, c) => datedif(c.num(a[0]), c.num(a[1]), c.text(a[2])),
  DAYS: (a, c) => Math.round(c.num(a[0]) - c.num(a[1])),
  DATEVALUE: (a, c) => { const t = Date.parse(c.text(a[0])); return Number.isNaN(t) ? err(ERR.VALUE) : Math.floor((t - EPOCH) / DAY_MS); },
};

// ---- helpers for the more involved functions ----------------------------
function stdev(nums, sample) { const v = variance(nums, sample); return v === undefined ? err(ERR.DIV0) : Math.sqrt(v); }
function variance(nums, sample) {
  const n = nums.length;
  if (n < (sample ? 2 : 1)) return err(ERR.DIV0);
  const mean = nums.reduce((s, x) => s + x, 0) / n;
  const ss = nums.reduce((s, x) => s + (x - mean) ** 2, 0);
  return ss / (sample ? n - 1 : n);
}
function pairs(a, c, startIdx) {
  // returns list of {range: value[][] flat, crit} for [range, criteria] pairs
  const out = [];
  for (let i = startIdx; i + 1 < a.length; i += 2) out.push({ vals: c.matrix(a[i]).flat(), crit: c.scalar(a[i + 1]) });
  return out;
}
function countifs(a, c) {
  const conds = pairs(a, c, 0);
  const len = conds[0].vals.length;
  let n = 0;
  for (let i = 0; i < len; i++) if (conds.every((cd) => matchCriteria(cd.vals[i], cd.crit))) n++;
  return n;
}
function sumif(a, c) {
  const range = c.matrix(a[0]).flat();
  const crit = c.scalar(a[1]);
  const sumRange = a[2] ? c.matrix(a[2]).flat() : range;
  let s = 0;
  for (let i = 0; i < range.length; i++) if (matchCriteria(range[i], crit)) s += toNumber(sumRange[i] ?? 0) || 0;
  return s;
}
function sumifs(a, c) {
  const sumRange = c.matrix(a[0]).flat();
  const conds = pairs(a, c, 1);
  let s = 0;
  for (let i = 0; i < sumRange.length; i++) if (conds.every((cd) => matchCriteria(cd.vals[i], cd.crit))) s += typeof sumRange[i] === 'number' ? sumRange[i] : 0;
  return s;
}
function avgif(a, c) {
  const range = c.matrix(a[0]).flat();
  const crit = c.scalar(a[1]);
  const sumRange = a[2] ? c.matrix(a[2]).flat() : range;
  let sum = 0, n = 0;
  for (let i = 0; i < range.length; i++) if (matchCriteria(range[i], crit)) { const v = sumRange[i]; if (typeof v === 'number') { sum += v; n++; } }
  return { sum, n };
}
function avgifs(a, c) {
  const avgRange = c.matrix(a[0]).flat();
  const conds = pairs(a, c, 1);
  let sum = 0, n = 0;
  for (let i = 0; i < avgRange.length; i++) if (conds.every((cd) => matchCriteria(cd.vals[i], cd.crit))) { const v = avgRange[i]; if (typeof v === 'number') { sum += v; n++; } }
  return { sum, n };
}
function ifExtreme(a, c, fn, seed) {
  const range = c.matrix(a[0]).flat();
  const conds = pairs(a, c, 1);
  let best = seed;
  for (let i = 0; i < range.length; i++) if (conds.every((cd) => matchCriteria(cd.vals[i], cd.crit)) && typeof range[i] === 'number') best = fn(best, range[i]);
  return Number.isFinite(best) ? best : 0;
}
function vlookup(a, c) {
  const key = c.scalar(a[0]);
  const table = c.matrix(a[1]);
  const colIdx = c.num(a[2]) - 1;
  const approx = a[3] ? c.bool(a[3]) : true;
  if (colIdx < 0 || (table[0] && colIdx >= table[0].length)) return err(ERR.REF);
  if (approx) {
    let found = null;
    for (const row of table) { if (compareValues(row[0], key) <= 0) found = row; else break; }
    return found ? (found[colIdx] ?? null) : err(ERR.NA);
  }
  for (const row of table) if (compareValues(row[0], key) === 0) return row[colIdx] ?? null;
  return err(ERR.NA);
}
function hlookup(a, c) {
  const key = c.scalar(a[0]);
  const table = c.matrix(a[1]);
  const rowIdx = c.num(a[2]) - 1;
  const approx = a[3] ? c.bool(a[3]) : true;
  const header = table[0] || [];
  if (rowIdx < 0 || rowIdx >= table.length) return err(ERR.REF);
  if (approx) {
    let col = -1;
    for (let j = 0; j < header.length; j++) { if (compareValues(header[j], key) <= 0) col = j; else break; }
    return col < 0 ? err(ERR.NA) : (table[rowIdx][col] ?? null);
  }
  for (let j = 0; j < header.length; j++) if (compareValues(header[j], key) === 0) return table[rowIdx][j] ?? null;
  return err(ERR.NA);
}
function xlookup(a, c) {
  const key = c.scalar(a[0]);
  const lookupArr = c.matrix(a[1]).flat();
  const returnMat = c.matrix(a[2]);
  const returnArr = returnMat.length === 1 ? returnMat[0] : returnMat.map((r) => r[0]);
  const ifNotFound = a[3];
  for (let i = 0; i < lookupArr.length; i++) if (compareValues(lookupArr[i], key) === 0) return returnArr[i] ?? null;
  return ifNotFound ? c.ev(ifNotFound) : err(ERR.NA);
}
function lookup(a, c) {
  const key = c.scalar(a[0]);
  const vec = c.matrix(a[1]).flat();
  const res = a[2] ? c.matrix(a[2]).flat() : vec;
  let found = -1;
  for (let i = 0; i < vec.length; i++) { if (compareValues(vec[i], key) <= 0) found = i; else break; }
  return found < 0 ? err(ERR.NA) : (res[found] ?? null);
}
function index(a, c) {
  const mat = c.matrix(a[0]);
  const rn = c.num(a[1]);
  const cn = a[2] ? c.num(a[2]) : 0;
  if (rn === 0 && cn > 0) return mkRange(mat.map((r) => [r[cn - 1]]));
  if (cn === 0 && mat.length > 1 && (mat[0]?.length || 0) > 1) { const row = mat[rn - 1]; if (!row) return err(ERR.REF); return mkRange([row]); }
  const r = rn === 0 ? 0 : rn - 1;
  const cc = cn === 0 ? 0 : cn - 1;
  if (r < 0 || r >= mat.length || cc < 0 || cc >= (mat[r]?.length || 0)) return err(ERR.REF);
  return mat[r][cc] ?? null;
}
function match(a, c) {
  const key = c.scalar(a[0]);
  const arr = c.matrix(a[1]).flat();
  const type = a[2] ? c.num(a[2]) : 1;
  if (type === 0) {
    for (let i = 0; i < arr.length; i++) if (compareValues(arr[i], key) === 0) return i + 1;
    // wildcard for text keys
    if (typeof key === 'string') { const rx = wildcardToRegExp(key); for (let i = 0; i < arr.length; i++) if (rx.test(toText(arr[i]))) return i + 1; }
    return err(ERR.NA);
  }
  if (type === 1) { let idx = -1; for (let i = 0; i < arr.length; i++) if (compareValues(arr[i], key) <= 0) idx = i; else break; return idx < 0 ? err(ERR.NA) : idx + 1; }
  // type -1: descending, smallest >= key
  let idx = -1;
  for (let i = 0; i < arr.length; i++) if (compareValues(arr[i], key) >= 0) idx = i; else break;
  return idx < 0 ? err(ERR.NA) : idx + 1;
}
function datedif(start, end, unit) {
  const s = serialToDate(start);
  const e = serialToDate(end);
  const u = unit.toUpperCase();
  if (u === 'D') return Math.round(end - start);
  if (u === 'Y') { let y = e.getUTCFullYear() - s.getUTCFullYear(); if (e.getUTCMonth() < s.getUTCMonth() || (e.getUTCMonth() === s.getUTCMonth() && e.getUTCDate() < s.getUTCDate())) y--; return y; }
  if (u === 'M') { let m = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()); if (e.getUTCDate() < s.getUTCDate()) m--; return m; }
  if (u === 'MD') return e.getUTCDate() - s.getUTCDate();
  if (u === 'YM') { let m = e.getUTCMonth() - s.getUTCMonth(); if (e.getUTCDate() < s.getUTCDate()) m--; return (m + 12) % 12; }
  if (u === 'YD') { const anchor = dateToSerial(s.getUTCFullYear() + (e.getUTCMonth() < s.getUTCMonth() ? 1 : 0), e.getUTCMonth() + 1, e.getUTCDate()); return Math.abs(anchor - dateToSerial(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate())); }
  return err(ERR.NUM);
}

// A pragmatic TEXT()/format-code implementation covering the common patterns:
// 0/#/, thousands, decimals, %, and $. Not the full Excel grammar.
function formatText(value, code) {
  if (isBlank(value)) return '';
  const up = code.toUpperCase();
  // date codes
  if (/[DMYH]/.test(up) && /[/:\- ]/.test(code) && typeof value === 'number') return formatDate(value, code);
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  if (code.includes('%')) {
    const decimals = (code.split('.')[1] || '').replace(/[^0#]/g, '').length;
    return (num * 100).toFixed(decimals) + '%';
  }
  const hasComma = code.includes(',');
  const decimals = (code.split('.')[1] || '').replace(/[^0#]/g, '').length;
  let s = num.toFixed(decimals);
  if (hasComma) { const [int, dec] = s.split('.'); s = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : ''); }
  if (code.includes('$')) s = '$' + s;
  return s;
}
function formatDate(serial, code) {
  const d = serialToDate(serial);
  const p2 = (n) => String(n).padStart(2, '0');
  const map = {
    yyyy: d.getUTCFullYear(), yy: String(d.getUTCFullYear()).slice(-2),
    mmmm: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()],
    mmm: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()],
    mm: p2(d.getUTCMonth() + 1), dd: p2(d.getUTCDate()),
    hh: p2(d.getUTCHours()), ss: p2(d.getUTCSeconds()),
  };
  return code.replace(/yyyy|yy|mmmm|mmm|mm|dd|d|m|hh|ss/gi, (t) => {
    const k = t.toLowerCase();
    if (map[k] !== undefined) return map[k];
    if (k === 'd') return String(d.getUTCDate());
    if (k === 'm') return String(d.getUTCMonth() + 1);
    return t;
  });
}

// Apply an Excel number-format code to a value for display (currency, percent,
// dates, thousands…). Exposed so the grid can render formatted numbers.
export function formatByCode(value, code) {
  if (!code || code === 'General') return null;
  try { return formatText(value, code); } catch { return null; }
}

// ---- public entry -------------------------------------------------------
// Evaluate one formula's text (without the leading "="), given a resolver.
// Returns a scalar value or a FormulaError instance (never throws).
export function evaluateFormula(text, resolver, curSheet) {
  try {
    const ast = parseFormula(text);
    const ctx = makeCtx(resolver, curSheet);
    let v = ctx.ev(ast);
    if (isRange(v)) v = v.cells[0]?.[0] ?? null; // implicit intersection → top-left
    if (typeof v === 'number' && !Number.isFinite(v)) return new FormulaError(ERR.NUM);
    return v;
  } catch (e) {
    if (e && e.isFormulaError) return e;
    return new FormulaError(ERR.VALUE);
  }
}

// Turn a computed value into its display string.
export function displayValue(v) {
  if (v === null || v === undefined) return '';
  if (v && v.isFormulaError) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return numToStr(v);
  return String(v);
}

export const FUNCTION_NAMES = Object.keys(FUNCTIONS).filter((k) => FUNCTIONS[k]).sort();

// ---- relative-reference translation (for copy/paste & fill) --------------
function splitRef(raw) {
  let sheet = '';
  let cell = raw;
  const bang = raw.indexOf('!');
  if (bang >= 0) { sheet = raw.slice(0, bang + 1); cell = raw.slice(bang + 1); }
  return { sheet, cell };
}
function shiftRef(raw, dr, dc) {
  const { sheet, cell } = splitRef(raw);
  const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(cell);
  if (!m) return raw;
  let col = colToIndex(m[2]);
  let row = parseInt(m[4], 10) - 1;
  if (!m[1]) col += dc;
  if (!m[3]) row += dr;
  if (col < 0 || row < 0) return ERR.REF;
  return `${sheet}${m[1]}${indexToCol(col)}${m[3]}${row + 1}`;
}
function shiftColRef(raw, dc) {
  const { sheet, cell } = splitRef(raw);
  const m = /^(\$?)([A-Za-z]{1,3})$/.exec(cell);
  if (!m) return raw;
  if (m[1]) return raw;
  const col = colToIndex(m[2]) + dc;
  return col < 0 ? ERR.REF : `${sheet}${indexToCol(col)}`;
}
// Adjust references after a structural insert/delete of rows or columns. Unlike
// copy/paste, structural edits shift absolute ($) refs too, and refs that fall
// inside a deleted band become #REF!. `spec` = { axis:'row'|'col', at, delta }
// (delta > 0 = insert, delta < 0 = delete `-delta` bands starting at `at`).
function structRef(raw, spec) {
  const { sheet, cell } = splitRef(raw);
  const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(cell);
  const colOnly = m ? null : /^(\$?)([A-Za-z]{1,3})$/.exec(cell);
  let col = m ? colToIndex(m[2]) : (colOnly ? colToIndex(colOnly[2]) : null);
  let row = m ? parseInt(m[4], 10) - 1 : null;
  const shift = (idx) => {
    if (idx === null) return idx;
    if (spec.delta > 0) return idx >= spec.at ? idx + spec.delta : idx;
    const cnt = -spec.delta;
    if (idx >= spec.at && idx < spec.at + cnt) return 'ref'; // inside deleted band
    return idx >= spec.at + cnt ? idx + spec.delta : idx;
  };
  if (spec.axis === 'row' && row !== null) { const n = shift(row); if (n === 'ref') return ERR.REF; row = n; }
  if (spec.axis === 'col' && col !== null) { const n = shift(col); if (n === 'ref') return ERR.REF; col = n; }
  if (m) return `${sheet}${m[1]}${indexToCol(col)}${m[3]}${row + 1}`;
  if (colOnly) return `${sheet}${colOnly[1]}${indexToCol(col)}`;
  return raw;
}
export function adjustFormula(formula, spec) {
  if (typeof formula !== 'string' || formula[0] !== '=') return formula;
  let toks;
  try { toks = tokenize(formula.slice(1)); } catch { return formula; }
  let out = '=';
  for (const t of toks) {
    if (t.type === 'eof') break;
    if (t.type === 'str') out += `"${t.value.replace(/"/g, '""')}"`;
    else if (t.type === 'ref' || t.type === 'colref') out += structRef(t.value, spec);
    else out += t.value;
  }
  return out;
}

// Shift all relative references in a formula by (dr, dc). Absolute ($) parts are
// left untouched; strings and function names are preserved verbatim.
export function translateFormula(formula, dr, dc) {
  if (typeof formula !== 'string' || formula[0] !== '=') return formula;
  let toks;
  try { toks = tokenize(formula.slice(1)); } catch { return formula; }
  let out = '=';
  for (const t of toks) {
    if (t.type === 'eof') break;
    if (t.type === 'str') out += `"${t.value.replace(/"/g, '""')}"`;
    else if (t.type === 'ref') out += shiftRef(t.value, dr, dc);
    else if (t.type === 'colref') out += shiftColRef(t.value, dc);
    else out += t.value;
  }
  return out;
}
