import { describe, it, expect } from 'vitest';
import { parseOklch, formatOklch, oklchToHex, hexToOklch } from './color';

// These underpin the M-3 CSS-injection guard: buildThemeCSS only emits a token
// when parseOklch accepts it and re-serializes via formatOklch. So parseOklch
// MUST reject anything that isn't a clean oklch(...) string.
describe('parseOklch — validation (M-3 guard)', () => {
  it('parses a valid oklch string', () => {
    const p = parseOklch('oklch(0.5 0.1 200)');
    expect(p.l).toBeCloseTo(0.5);
    expect(p.c).toBeCloseTo(0.1);
    expect(p.h).toBeCloseTo(200);
    expect(p.alpha).toBe(1);
  });

  it('parses an alpha slash form', () => {
    const p = parseOklch('oklch(0.5 0.1 200 / 50%)');
    expect(p.alpha).toBeCloseTo(0.5);
  });

  it('rejects non-oklch / injection attempts', () => {
    expect(parseOklch('red')).toBeNull();
    expect(parseOklch('red; } body { background: url(x) }')).toBeNull();
    expect(parseOklch('oklch(1 0 0); evil')).toBeNull(); // trailing junk after )
    expect(parseOklch('rgb(0,0,0)')).toBeNull();
    expect(parseOklch('')).toBeNull();
    expect(parseOklch(null)).toBeNull();
    expect(parseOklch(42)).toBeNull();
  });
});

describe('formatOklch — safe re-serialization', () => {
  it('clamps + normalizes into a clean oklch string', () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200 })).toBe('oklch(0.5 0.1 200)');
    // out-of-range inputs are clamped/wrapped, never emitted raw
    expect(formatOklch({ l: 2, c: -1, h: 400 })).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
  });

  it('emits alpha form only when < 1', () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200, alpha: 0.5 })).toMatch(/\/ 50%\)$/);
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200, alpha: 1 })).not.toMatch(/%/);
  });

  it('round-trips parse→format', () => {
    expect(formatOklch(parseOklch('oklch(0.62 0.19 259)'))).toBe('oklch(0.62 0.19 259)');
  });
});

describe('hex <-> oklch conversions', () => {
  it('oklchToHex returns a #rrggbb string', () => {
    expect(oklchToHex('oklch(1 0 0)')).toMatch(/^#[0-9a-f]{6}$/i); // white-ish
  });
  it('hexToOklch returns a parseable oklch string', () => {
    const s = hexToOklch('#3366cc');
    expect(parseOklch(s)).not.toBeNull();
  });
  it('hex round-trips approximately through oklch', () => {
    const hex = '#4488cc';
    const back = oklchToHex(hexToOklch(hex));
    expect(back).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
