import { describe, it, expect } from 'vitest';
import { generatePassword, secureInt, CHAR_CLASSES } from './password';

describe('secureInt', () => {
  it('stays within [0, max) and returns 0 for degenerate bounds', () => {
    expect(secureInt(1)).toBe(0);
    expect(secureInt(0)).toBe(0);
    for (let i = 0; i < 1000; i++) {
      const n = secureInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });
});

describe('generatePassword', () => {
  it('honors the requested length', () => {
    const { password } = generatePassword({ length: 20, lowercase: true, uppercase: true, numbers: true, symbols: true });
    expect(password).toHaveLength(20);
  });

  it('only uses characters from the selected classes', () => {
    const { password } = generatePassword({ length: 40, lowercase: true, uppercase: false, numbers: true, symbols: false });
    const allowed = CHAR_CLASSES.lowercase + CHAR_CLASSES.numbers;
    for (const ch of password) expect(allowed).toContain(ch);
  });

  it('guarantees at least one char from every selected class', () => {
    for (let i = 0; i < 50; i++) {
      const { password } = generatePassword({ length: 4, lowercase: true, uppercase: true, numbers: true, symbols: true });
      expect([...password].some((c) => CHAR_CLASSES.lowercase.includes(c))).toBe(true);
      expect([...password].some((c) => CHAR_CLASSES.uppercase.includes(c))).toBe(true);
      expect([...password].some((c) => CHAR_CLASSES.numbers.includes(c))).toBe(true);
      expect([...password].some((c) => CHAR_CLASSES.symbols.includes(c))).toBe(true);
    }
  });

  it('rejects no-class, bad length, over-max, and too-short-for-classes', () => {
    expect(generatePassword({ length: 10 }).error).toMatch(/character type/);
    expect(generatePassword({ length: 0, lowercase: true }).error).toMatch(/length/);
    expect(generatePassword({ length: '', lowercase: true }).error).toMatch(/length/);
    expect(generatePassword({ length: 999, lowercase: true }).error).toMatch(/exceed/);
    expect(generatePassword({ length: 2, lowercase: true, uppercase: true, numbers: true }).error).toMatch(/at least 3/);
  });

  it('produces different passwords across calls', () => {
    const a = generatePassword({ length: 24, lowercase: true, uppercase: true, numbers: true, symbols: true }).password;
    const b = generatePassword({ length: 24, lowercase: true, uppercase: true, numbers: true, symbols: true }).password;
    expect(a).not.toBe(b);
  });
});
