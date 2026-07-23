import { describe, it, expect } from 'vitest';
import { evaluateFormula, colToIndex, indexToCol, toNumber, numToStr, toBool } from './formula';

// Build a resolver over a 2-D array of raw cell strings (0-based [row][col]).
function gridResolver(grid) {
  const resolver = (_sheet, r, c) => grid[r]?.[c] ?? null;
  resolver.bounds = () => ({ rows: grid.length, cols: Math.max(...grid.map((r) => r.length), 0) });
  return resolver;
}
// engine.js strips the leading '=' before calling evaluateFormula; do the same
// so the test formulas read naturally.
const evalF = (text, grid = [[]]) => evaluateFormula(text.replace(/^=/, ''), gridResolver(grid), 'Sheet1');
const code = (v) => (v && v.isFormulaError ? v.code : v);

describe('colToIndex / indexToCol', () => {
  it('maps columns 0-based and round-trips', () => {
    expect(colToIndex('A')).toBe(0);
    expect(colToIndex('B')).toBe(1);
    expect(colToIndex('Z')).toBe(25);
    expect(colToIndex('AA')).toBe(26);
    for (const n of [0, 1, 25, 26, 27, 701, 702]) expect(colToIndex(indexToCol(n))).toBe(n);
  });
});

describe('coercion helpers', () => {
  it('toNumber parses numeric strings, blanks → 0', () => {
    expect(toNumber('5')).toBe(5);
    expect(toNumber(3)).toBe(3);
    expect(toNumber('')).toBe(0);
    expect(toNumber(true)).toBe(1);
  });
  it('toBool and numToStr', () => {
    expect(toBool('TRUE')).toBe(true);
    expect(toBool(0)).toBe(false);
    expect(numToStr(1.5)).toBe('1.5');
  });
});

describe('evaluateFormula — arithmetic & precedence', () => {
  it('respects operator precedence', () => {
    expect(evalF('=1+2*3')).toBe(7);
    expect(evalF('=(1+2)*3')).toBe(9);
    expect(evalF('=2^3')).toBe(8);
    expect(evalF('=10%')).toBeCloseTo(0.1);
  });
  it('string concatenation with &', () => {
    expect(evalF('="a"&"b"')).toBe('ab');
  });
});

describe('evaluateFormula — cell refs & ranges', () => {
  const grid = [
    ['5', '10', '15'],
    ['2', '4', '6'],
    ['1', '3', '9'],
  ];
  it('reads single refs', () => {
    expect(evalF('=A1+B1', grid)).toBe(15);
    expect(evalF('=C1', grid)).toBe(15);
  });
  it('SUM / AVERAGE / MAX / MIN / COUNT over a range', () => {
    expect(evalF('=SUM(A1:A3)', grid)).toBe(8);
    expect(evalF('=SUM(A1:C1)', grid)).toBe(30);
    expect(evalF('=AVERAGE(A1:C1)', grid)).toBe(10);
    expect(evalF('=MAX(A1:C3)', grid)).toBe(15);
    expect(evalF('=MIN(A1:C3)', grid)).toBe(1);
    expect(evalF('=COUNT(A1:C3)', grid)).toBe(9);
  });
});

describe('evaluateFormula — logic & lookup', () => {
  it('IF returns the correct branch', () => {
    expect(evalF('=IF(1>0,"big","small")')).toBe('big');
    expect(evalF('=IF(1<0,"big","small")')).toBe('small');
  });
  it('VLOOKUP finds a row', () => {
    const g = [['apple', '1'], ['banana', '2'], ['cherry', '3']];
    expect(evalF('=VLOOKUP("banana",A1:B3,2,FALSE)', g)).toBe(2);
  });
});

describe('evaluateFormula — errors', () => {
  it('returns #DIV/0! for divide by zero', () => {
    expect(code(evalF('=1/0'))).toBe('#DIV/0!');
  });
  it('IFERROR traps an error', () => {
    expect(evalF('=IFERROR(1/0,"safe")')).toBe('safe');
  });
  it('unknown name → #NAME?', () => {
    expect(code(evalF('=NOTAFUNC()'))).toBe('#NAME?');
  });
});
