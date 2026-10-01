/**
 * Optional live search against IKEA's public storefront search, called directly from the
 * browser. It is unofficial: no API key, no contract, and it can change or disappear at any
 * time. Every failure becomes a LiveSearchError; nothing else in the app depends on it.
 */
import { type LiveCatalogProvider, LiveSearchError, type LiveProductCandidate } from '../../types';
import { DEFAULT_IKEA_REGION, IKEA_MANUFACTURER, type IkeaRegion, ikeaSearchUrl } from './config';
import { normalizeIkeaSearchResponse } from './normalizeIkeaProduct';

export interface IkeaProviderOptions {
  region?: IkeaRegion;
  /** Injectable for tests. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const MAX_QUERY_LENGTH = 100;

export function createIkeaProvider(options: IkeaProviderOptions = {}): LiveCatalogProvider {
  const region = options.region ?? DEFAULT_IKEA_REGION;
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function search(query: string, { signal }: { signal?: AbortSignal } = {}): Promise<LiveProductCandidate[]> {
    const q = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (!q) return [];
    if (signal?.aborted) throw new LiveSearchError('aborted', 'Search cancelled.');

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const forwardAbort = () => controller.abort();
    signal?.addEventListener('abort', forwardAbort);

    const failure = (fallback: LiveSearchError) =>
      signal?.aborted
        ? new LiveSearchError('aborted', 'Search cancelled.')
        : timedOut
          ? new LiveSearchError('timeout', 'IKEA search did not answer in time.')
          : fallback;

    try {
      let response: Response;
      try {
        // A plain GET without custom headers or cookies: a "simple" CORS request that works
        // from any static site as long as IKEA answers with Access-Control-Allow-Origin.
        response = await doFetch(ikeaSearchUrl(q, region), {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
      } catch {
        // Network errors and CORS rejections look the same to the page.
        throw failure(new LiveSearchError('unavailable', 'IKEA search could not be reached.'));
      }
      if (!response.ok) throw new LiveSearchError('unavailable', `IKEA search answered with HTTP ${response.status}.`);
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw failure(new LiveSearchError('bad-response', 'IKEA search returned something other than JSON.'));
      }
      return normalizeIkeaSearchResponse(json);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
    }
  }

  return { id: 'ikea', manufacturer: IKEA_MANUFACTURER, label: 'IKEA', search };
}
