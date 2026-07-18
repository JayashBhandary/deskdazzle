// Shared helpers for the Tasks tool (list + board + detail).
//
// Data-model notes (critical):
// - Todos are the legacy Desk Dazzle array from ThemeContext, persisted to
//   localStorage + Firebase RTDB. RTDB strips null/undefined/empty-array
//   fields, and the desktop TodoWidget still appends bare
//   {text, isDone, createdMs} items, so EVERY field must be defaulted here.
// - `isDone` stays authoritative. `status` ('todo'|'doing'|'done') is only an
//   extension for the board: isDone=true always reads as 'done'.

export const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const PRIORITY_STYLE = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-chart-1/10 text-chart-1 border-chart-1/30',
  low: 'bg-chart-2/10 text-chart-2 border-chart-2/30',
};

export const BOARD_COLUMNS = [
  { key: 'todo', label: 'To do', dot: 'bg-muted-foreground/50' },
  { key: 'doing', label: 'In progress', dot: 'bg-chart-1' },
  { key: 'done', label: 'Done', dot: 'bg-chart-2' },
];

/** Stable unique id for todos/projects. */
export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** isDone is authoritative; `status` only distinguishes todo/doing. */
export function statusOf(todo) {
  if (todo?.isDone) return 'done';
  return todo?.status === 'doing' ? 'doing' : 'todo';
}

/**
 * Map a Desk Dazzle todo (+ its normalized item) onto the Rust core's Task
 * wire format. Firebase strips null/empty fields, so everything defaults.
 */
export function toTask(todo, item) {
  return {
    id: item.id,
    projectId: item.projectId || 'inbox',
    title: todo.text || '',
    notes: '',
    done: !!todo.isDone,
    priority: todo.priority || 'none',
    due: typeof todo.due === 'number' ? todo.due : null,
    tags: todo.tags || [],
    parentId: null,
    order: item.order,
    createdMs: todo.createdMs || 0,
    completedMs: todo.isDone ? todo.completedMs || 0 : null,
    recurrence: todo.recurrence || null,
  };
}

export function dueLabel(ms) {
  const d = new Date(ms);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** epoch ms → yyyy-mm-dd for <input type="date"> (local time). */
export function msToDateInput(ms) {
  if (typeof ms !== 'number') return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** yyyy-mm-dd → epoch ms at local midnight, or null. */
export function dateInputToMs(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

export function recurrenceLabel(recurrence) {
  const n = recurrence.interval > 1 ? `${recurrence.interval} ` : '';
  const unit = recurrence.freq.replace('ly', '').replace('dai', 'day');
  return `every ${n}${unit}`;
}
