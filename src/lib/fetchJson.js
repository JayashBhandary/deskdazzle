// Small wrapper around fetch for the app's third-party API calls. Adds a hard
// timeout (via AbortController) so a hung provider can't leave the UI spinning
// forever, and throws a typed Error the caller can distinguish from offline.

export class FetchError extends Error {
  constructor(message, { status = null, timeout = false } = {}) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.timeout = timeout;
  }
}

// GET `url` and parse JSON. Rejects with FetchError on timeout, network failure,
// or non-2xx status. `timeoutMs` defaults to 10s.
export async function fetchJson(url, { timeoutMs = 10_000, signal } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  // Chain an externally-supplied signal (e.g. React cleanup) if given.
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new FetchError(`Request failed (HTTP ${res.status})`, { status: res.status });
    return await res.json();
  } catch (err) {
    if (err?.name === 'AbortError') throw new FetchError('Request timed out', { timeout: true });
    if (err instanceof FetchError) throw err;
    throw new FetchError(err?.message || 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}
