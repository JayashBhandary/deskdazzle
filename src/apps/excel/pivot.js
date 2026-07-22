// Build a pivot-table result grid from a source range. The first row of the
// range is treated as the header; `rowField`, `colField` and `valField` are
// absolute column indices. Returns a dense string[][] ready to drop into a new
// sheet.

const AGGS = {
  sum: (xs) => xs.reduce((a, b) => a + b, 0),
  count: (xs) => xs.length,
  avg: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  min: (xs) => (xs.length ? Math.min(...xs) : 0),
  max: (xs) => (xs.length ? Math.max(...xs) : 0),
};

const num = (v) => { const n = Number(v); return Number.isNaN(n) ? null : n; };
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));

export const PIVOT_AGGS = [
  { key: 'sum', label: 'Sum' },
  { key: 'count', label: 'Count' },
  { key: 'avg', label: 'Average' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
];

// `getText(r,c)` → displayed text; `getVal(r,c)` → the value column raw text.
export function buildPivot(range, getText, { rowField, colField, valField, agg = 'sum' }) {
  const { r1, r2 } = range;
  const rowName = getText(r1, rowField) || 'Row';
  const valName = getText(r1, valField != null ? valField : rowField) || 'Value';
  const aggName = (PIVOT_AGGS.find((a) => a.key === agg) || {}).label || 'Sum';
  const aggFn = AGGS[agg] || AGGS.sum;

  const rowKeys = [];
  const colKeys = [];
  const seenRow = new Set();
  const seenCol = new Set();
  // bucket[rowKey][colKey] = [numbers]
  const bucket = new Map();
  const push = (rk, ck, v) => {
    if (!bucket.has(rk)) bucket.set(rk, new Map());
    const m = bucket.get(rk);
    if (!m.has(ck)) m.set(ck, []);
    if (v != null) m.get(ck).push(v);
    else if (agg === 'count') m.get(ck).push(0); // count still counts non-numeric rows via length below
  };

  for (let r = r1 + 1; r <= r2; r++) {
    const rk = getText(r, rowField);
    const ck = colField != null ? getText(r, colField) : '__all__';
    const raw = valField != null ? getText(r, valField) : '';
    const v = agg === 'count' ? 1 : num(raw);
    if (!seenRow.has(rk)) { seenRow.add(rk); rowKeys.push(rk); }
    if (!seenCol.has(ck)) { seenCol.add(ck); colKeys.push(ck); }
    push(rk, ck, agg === 'count' ? 1 : v);
  }
  rowKeys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const hasCols = colField != null;
  if (hasCols) colKeys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const out = [];
  if (hasCols) {
    out.push([`${aggName} of ${valName}`, ...colKeys, 'Grand Total']);
    for (const rk of rowKeys) {
      const line = [rk];
      let total = [];
      for (const ck of colKeys) {
        const xs = bucket.get(rk)?.get(ck) || [];
        line.push(xs.length ? fmt(aggFn(xs)) : '');
        total = total.concat(xs);
      }
      line.push(total.length ? fmt(aggFn(total)) : '');
      out.push(line);
    }
    // grand-total row
    const gt = ['Grand Total'];
    let all = [];
    for (const ck of colKeys) {
      let col = [];
      for (const rk of rowKeys) col = col.concat(bucket.get(rk)?.get(ck) || []);
      gt.push(col.length ? fmt(aggFn(col)) : '');
      all = all.concat(col);
    }
    gt.push(all.length ? fmt(aggFn(all)) : '');
    out.push(gt);
  } else {
    out.push([rowName, `${aggName} of ${valName}`]);
    let all = [];
    for (const rk of rowKeys) {
      const xs = bucket.get(rk)?.get('__all__') || [];
      out.push([rk, xs.length ? fmt(aggFn(xs)) : '']);
      all = all.concat(xs);
    }
    out.push(['Grand Total', all.length ? fmt(aggFn(all)) : '']);
  }
  return out;
}
