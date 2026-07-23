import { describe, it, expect } from 'vitest';
import { buildThemeCSS, normalizeSettings } from './theme';

describe('buildThemeCSS — CSS injection guard', () => {
  it('emits only valid oklch values for known tokens', () => {
    const css = buildThemeCSS({ light: { background: 'oklch(0.5 0.1 200)' } });
    expect(css).toContain('--background:');
    expect(css).toContain('oklch(');
  });

  it('drops unknown token ids', () => {
    const css = buildThemeCSS({ light: { 'evil-token': 'oklch(0.5 0.1 200)' } });
    expect(css).not.toContain('evil-token');
  });

  it('rejects a malicious value that tries to break out of the declaration', () => {
    const css = buildThemeCSS({
      light: { background: 'red; } body { background: url(javascript:alert(1)) }' },
    });
    expect(css).not.toContain('javascript:');
    expect(css).not.toContain('url(');
    // The invalid value is dropped entirely rather than injected raw.
    expect(css).not.toContain('--background: red');
  });

  it('normalizeSettings strips non-oklch colors before they reach CSS', () => {
    const s = normalizeSettings({ colors: { light: { background: 'nope; evil', foreground: 'oklch(0.2 0 0)' } } });
    expect(s.colors.light.background).toBeUndefined();
    expect(s.colors.light.foreground).toBe('oklch(0.2 0 0)');
  });
});
