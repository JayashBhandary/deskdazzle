// Data-validation rules attached to a sheet as sheet.validations = [{ range, kind, ... }].
//   list       → { list: [values] }         cell must be one of the values (dropdown)
//   number     → { min, max }                whole number in range
//   decimal    → { min, max }                any number in range
//   textLength → { min, max }                text length in range
//   date       → { min, max }                a parseable date, optional serial range
// Rules are checked on commit; a failing edit is rejected.

export function validationAt(validations, r, c) {
  for (const v of validations || []) {
    const g = v.range;
    if (r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2) return v;
  }
  return null;
}

const asNum = (v) => { const n = Number(v); return Number.isNaN(n) ? null : n; };

// Returns { ok, msg }. Empty values always pass (use a separate "required" if needed).
export function checkValue(rule, value) {
  if (!rule) return { ok: true };
  const s = value == null ? '' : String(value);
  if (s === '') return { ok: true };
  switch (rule.kind) {
    case 'list':
      return (rule.list || []).includes(s)
        ? { ok: true }
        : { ok: false, msg: `Value must be one of: ${(rule.list || []).join(', ')}` };
    case 'number': {
      const n = asNum(s);
      if (n == null || !Number.isInteger(n)) return { ok: false, msg: 'Must be a whole number' };
      if (rule.min != null && n < rule.min) return { ok: false, msg: `Must be ≥ ${rule.min}` };
      if (rule.max != null && n > rule.max) return { ok: false, msg: `Must be ≤ ${rule.max}` };
      return { ok: true };
    }
    case 'decimal': {
      const n = asNum(s);
      if (n == null) return { ok: false, msg: 'Must be a number' };
      if (rule.min != null && n < rule.min) return { ok: false, msg: `Must be ≥ ${rule.min}` };
      if (rule.max != null && n > rule.max) return { ok: false, msg: `Must be ≤ ${rule.max}` };
      return { ok: true };
    }
    case 'textLength': {
      const len = s.length;
      if (rule.min != null && len < rule.min) return { ok: false, msg: `Min length ${rule.min}` };
      if (rule.max != null && len > rule.max) return { ok: false, msg: `Max length ${rule.max}` };
      return { ok: true };
    }
    case 'date': {
      const t = Date.parse(s);
      if (Number.isNaN(t)) return { ok: false, msg: 'Must be a date' };
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export const VALIDATION_KINDS = [
  { key: 'list', label: 'List (dropdown)', needs: ['list'] },
  { key: 'number', label: 'Whole number', needs: ['min', 'max'] },
  { key: 'decimal', label: 'Decimal', needs: ['min', 'max'] },
  { key: 'textLength', label: 'Text length', needs: ['min', 'max'] },
  { key: 'date', label: 'Date', needs: [] },
];
