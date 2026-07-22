// Conditional-formatting rules, evaluated at render time. A rule is stored on
// the sheet as { range, kind, ... } and applied over the cells it covers:
//   gt/lt/eq/between/contains → a fill + font colour when the test passes
//   scale2/scale3             → a colour gradient across the range's min..max
//   databar                   → an in-cell proportional bar
//   top/bottom                → highlight the N largest / smallest
// Rules are view-only (they never change cell values) and later rules win.

const hexToRgb = (h) => {
  const s = String(h || '#ffffff').replace('#', '');
  return [parseInt(s.slice(0, 2), 16) || 0, parseInt(s.slice(2, 4), 16) || 0, parseInt(s.slice(4, 6), 16) || 0];
};
const rgbToHex = ([r, g, b]) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (lo, hi, t) => {
  const A = hexToRgb(lo); const B = hexToRgb(hi);
  return rgbToHex([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]);
};
const lerp3 = (lo, mid, hi, t) => (t <= 0.5 ? lerpColor(lo, mid, t * 2) : lerpColor(mid, hi, (t - 0.5) * 2));

// Precompute per-rule stats (min/max/values) for scale / databar / top rules.
export function buildCond(condFmt, getNum) {
  return (condFmt || []).map((rule) => {
    const stat = {};
    if (/^(scale2|scale3|databar|top|bottom)$/.test(rule.kind)) {
      let min = Infinity; let max = -Infinity; const vals = [];
      for (let r = rule.range.r1; r <= rule.range.r2; r++) {
        for (let c = rule.range.c1; c <= rule.range.c2; c++) {
          const n = getNum(r, c);
          if (n != null) { vals.push(n); if (n < min) min = n; if (n > max) max = n; }
        }
      }
      stat.min = min; stat.max = max; stat.vals = vals;
    }
    return { rule, stat };
  });
}

// Return the derived style for a cell: { bg?, color?, bar?:{pct,color} } or null.
export function condStyle(rules, r, c, value) {
  let style = null;
  const num = typeof value === 'number' ? value : Number(value);
  const isNum = value !== '' && value != null && !Number.isNaN(num);
  const apply = (s) => { style = { ...(style || {}), ...s }; };
  for (const { rule, stat } of rules) {
    const g = rule.range;
    if (r < g.r1 || r > g.r2 || c < g.c1 || c > g.c2) continue;
    switch (rule.kind) {
      case 'gt': if (isNum && num > rule.value) apply({ bg: rule.bg, color: rule.color }); break;
      case 'lt': if (isNum && num < rule.value) apply({ bg: rule.bg, color: rule.color }); break;
      case 'eq': if (String(value) === String(rule.value)) apply({ bg: rule.bg, color: rule.color }); break;
      case 'between': if (isNum && num >= rule.min && num <= rule.max) apply({ bg: rule.bg, color: rule.color }); break;
      case 'contains': if (String(value ?? '').toLowerCase().includes(String(rule.text || '').toLowerCase()) && value !== '' && value != null) apply({ bg: rule.bg, color: rule.color }); break;
      case 'scale2': if (isNum) apply({ bg: lerpColor(rule.lo, rule.hi, (num - stat.min) / ((stat.max - stat.min) || 1)) }); break;
      case 'scale3': if (isNum) { const mid = (stat.min + stat.max) / 2; const t = num <= mid ? (num - stat.min) / ((mid - stat.min) || 1) / 2 : 0.5 + (num - mid) / ((stat.max - mid) || 1) / 2; apply({ bg: lerp3(rule.lo, rule.mid, rule.hi, t) }); } break;
      case 'databar': if (isNum) { const base = Math.min(0, stat.min); const t = (num - base) / ((stat.max - base) || 1); apply({ bar: { pct: Math.max(0, Math.min(1, t)), color: rule.color } }); } break;
      case 'top': if (isNum) { const th = [...stat.vals].sort((a, b) => b - a)[Math.min(rule.n, stat.vals.length) - 1]; if (th != null && num >= th) apply({ bg: rule.bg, color: rule.color }); } break;
      case 'bottom': if (isNum) { const th = [...stat.vals].sort((a, b) => a - b)[Math.min(rule.n, stat.vals.length) - 1]; if (th != null && num <= th) apply({ bg: rule.bg, color: rule.color }); } break;
      default: break;
    }
  }
  return style;
}

export const COND_KINDS = [
  { key: 'gt', label: 'Greater than', needs: ['value'] },
  { key: 'lt', label: 'Less than', needs: ['value'] },
  { key: 'eq', label: 'Equal to', needs: ['value'] },
  { key: 'between', label: 'Between', needs: ['min', 'max'] },
  { key: 'contains', label: 'Text contains', needs: ['text'] },
  { key: 'top', label: 'Top N', needs: ['n'] },
  { key: 'bottom', label: 'Bottom N', needs: ['n'] },
  { key: 'scale2', label: 'Color scale (2)', needs: ['lo', 'hi'] },
  { key: 'scale3', label: 'Color scale (3)', needs: ['lo', 'mid', 'hi'] },
  { key: 'databar', label: 'Data bar', needs: ['color'] },
];
