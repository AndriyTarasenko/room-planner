import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSearchText } from '../../catalog/search';
import { type LiveCatalogProvider, LiveSearchError, type LiveProductCandidate } from '../../catalog/types';

export type LiveSearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; results: LiveProductCandidate[] }
  | { status: 'error'; query: string };

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; results: LiveProductCandidate[] }>();

/**
 * Runs a provider search on explicit request (never per keystroke). Repeated searches are
 * answered from a short-lived memory cache, and a new search cancels the previous one.
 */
export function useLiveSearch(provider: LiveCatalogProvider) {
  const [state, setState] = useState<LiveSearchState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      const key = `${provider.id}:${normalizeSearchText(q)}`;
      const cached = cache.get(key);
      controllerRef.current?.abort();
      if (cached && Date.now() - cached.at < CACHE_MS) {
        controllerRef.current = null;
        setState({ status: 'done', query: q, results: cached.results });
        return;
      }
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ status: 'loading', query: q });
      try {
        const results = await provider.search(q, { signal: controller.signal });
        cache.set(key, { at: Date.now(), results });
        if (controllerRef.current === controller) setState({ status: 'done', query: q, results });
      } catch (error) {
        if (error instanceof LiveSearchError && error.reason === 'aborted') return;
        // Details go to the console for debugging; the UI shows one plain sentence.
        console.warn(`${provider.label} online search failed:`, error);
        if (controllerRef.current === controller) setState({ status: 'error', query: q });
      }
    },
    [provider],
  );

  const clear = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, search, clear };
}
