import { describe, it, expect } from 'vitest';
import { sanitizeNoteHtml } from './notesSanitize';

describe('sanitizeNoteHtml', () => {
  it('strips <script> tags', () => {
    const out = sanitizeNoteHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('hi');
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeNoteHtml('<img src=x onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it('strips javascript: URLs', () => {
    const out = sanitizeNoteHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it('forbids inline style attributes and <style> tags', () => {
    expect(sanitizeNoteHtml('<p style="background:url(x)">y</p>')).not.toMatch(/style=/i);
    expect(sanitizeNoteHtml('<style>body{display:none}</style><p>z</p>')).not.toMatch(/<style/i);
  });

  it('adds rel="noopener noreferrer" to links opening a new tab', () => {
    const out = sanitizeNoteHtml('<a href="https://example.com" target="_blank">x</a>');
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });

  it('keeps the internal wiki-link data-* attributes', () => {
    const out = sanitizeNoteHtml('<a data-entity-id="note:1" data-entity-type="note">link</a>');
    expect(out).toContain('data-entity-id="note:1"');
    expect(out).toContain('data-entity-type="note"');
  });
});
