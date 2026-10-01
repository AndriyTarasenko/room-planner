import { describe, expect, it, vi } from 'vitest';
import { LiveSearchError } from '../../types';
import { createIkeaProvider } from './IkeaProvider';
import { IKEA_SEARCH_FIXTURE } from './searchResponse.fixture';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function reason(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LiveSearchError);
    return (error as LiveSearchError).reason;
  }
  throw new Error('expected the search to fail');
}

describe('IKEA provider (mocked network)', () => {
  it('sends one plain GET without credentials and normalizes the result', async () => {
    const fetch = vi.fn(async () => jsonResponse(IKEA_SEARCH_FIXTURE));
    const provider = createIkeaProvider({ fetch });
    const results = await provider.search('  alex  ');
    expect(results.map((r) => r.product.id)).toContain('ikea:00473546');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get('q')).toBe('alex');
    // No custom headers: stays a CORS "simple request" and sends no secrets.
    expect(init.headers).toBeUndefined();
    expect(init.credentials).toBe('omit');
    expect(init.method ?? 'GET').toBe('GET');
  });

  it('does not call IKEA for an empty query', async () => {
    const fetch = vi.fn();
    expect(await createIkeaProvider({ fetch }).search('   ')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports network and CORS failures as unavailable', async () => {
    const provider = createIkeaProvider({
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(await reason(provider.search('alex'))).toBe('unavailable');
  });

  it('reports HTTP errors as unavailable', async () => {
    const provider = createIkeaProvider({ fetch: async () => jsonResponse({ error: 'nope' }, 503) });
    expect(await reason(provider.search('alex'))).toBe('unavailable');
  });

  it('reports non-JSON and changed schemas as bad responses', async () => {
    const html = createIkeaProvider({ fetch: async () => new Response('<html>blocked</html>', { status: 200 }) });
    expect(await reason(html.search('alex'))).toBe('bad-response');
    const changed = createIkeaProvider({ fetch: async () => jsonResponse({ data: { hits: [] } }) });
    expect(await reason(changed.search('alex'))).toBe('bad-response');
  });

  it('times out slow responses', async () => {
    const provider = createIkeaProvider({
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    });
    expect(await reason(provider.search('alex'))).toBe('timeout');
  });

  it('can be cancelled by the caller', async () => {
    const controller = new AbortController();
    const provider = createIkeaProvider({
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    });
    const pending = provider.search('alex', { signal: controller.signal });
    controller.abort();
    expect(await reason(pending)).toBe('aborted');
  });
});
