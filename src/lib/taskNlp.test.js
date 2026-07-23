import { describe, it, expect } from 'vitest';
import { parseTask } from './taskNlp';

// Fixed reference time so date parsing is deterministic (2026-07-23, a Thursday).
const NOW = new Date(2026, 6, 23, 9, 0, 0).getTime();

describe('parseTask', () => {
  it('returns plain text as the title with sane defaults', () => {
    const r = parseTask('Buy milk', NOW);
    expect(r.title).toBe('Buy milk');
    expect(r.priority).toBe('none');
    expect(r.tags).toEqual([]);
  });

  it('extracts #tags out of the title', () => {
    const r = parseTask('Email boss #work #urgent', NOW);
    expect(r.tags).toContain('work');
    expect(r.tags).toContain('urgent');
    expect(r.title).toBe('Email boss');
  });

  it('parses priority markers', () => {
    expect(parseTask('!high Ship it', NOW).priority).toBe('high');
    expect(parseTask('p2 Review PR', NOW).priority).toBe('medium');
    expect(parseTask('p3 Tidy desk', NOW).priority).toBe('low');
  });

  it('is deterministic for a fixed now', () => {
    expect(parseTask('Call dentist tomorrow', NOW)).toEqual(parseTask('Call dentist tomorrow', NOW));
  });

  it('does not throw on empty/garbage input', () => {
    expect(() => parseTask('', NOW)).not.toThrow();
    expect(() => parseTask(null, NOW)).not.toThrow();
    expect(parseTask('', NOW).title).toBe('');
  });
});
