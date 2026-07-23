import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchJson, FetchError } from './fetchJson';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) })));
    await expect(fetchJson('https://x.test')).resolves.toEqual({ hello: 'world' });
  });

  it('throws FetchError with status on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    await expect(fetchJson('https://x.test')).rejects.toMatchObject({ name: 'FetchError', status: 503 });
  });

  it('maps AbortError to a timeout FetchError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }));
    const err = await fetchJson('https://x.test').catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.timeout).toBe(true);
  });

  it('wraps network failures as FetchError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(fetchJson('https://x.test')).rejects.toBeInstanceOf(FetchError);
  });
});
