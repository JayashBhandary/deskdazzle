import { describe, it, expect, beforeEach } from 'vitest';
import { exportWorkspace, importWorkspace } from './backup';

describe('backup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('exports only deskdazzle.* keys, parsed', () => {
    window.localStorage.setItem('deskdazzle.notes', JSON.stringify([{ id: 1 }]));
    window.localStorage.setItem('unrelated', 'x');
    const dump = exportWorkspace();
    expect(dump.format).toBe('deskdazzle-backup');
    expect(dump.stores['deskdazzle.notes']).toEqual([{ id: 1 }]);
    expect(dump.stores).not.toHaveProperty('unrelated');
  });

  it('round-trips through import (guest, uid=null)', async () => {
    window.localStorage.setItem('deskdazzle.todos', JSON.stringify(['a', 'b']));
    const dump = exportWorkspace();
    window.localStorage.clear();
    await importWorkspace(dump, null);
    expect(JSON.parse(window.localStorage.getItem('deskdazzle.todos'))).toEqual(['a', 'b']);
  });

  it('rejects a file that is not a Desk Dazzle backup', async () => {
    await expect(importWorkspace({ format: 'nope' }, null)).rejects.toThrow(/backup/);
    await expect(importWorkspace(null, null)).rejects.toThrow(/backup/);
  });

  it('ignores non-prefixed keys inside a backup on import', async () => {
    await importWorkspace(
      { format: 'deskdazzle-backup', version: 1, stores: { evil: 1, 'deskdazzle.ok': 2 } },
      null,
    );
    expect(window.localStorage.getItem('evil')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('deskdazzle.ok'))).toBe(2);
  });
});
