import { useSyncExternalStore } from 'react';

/**
 * Phones, tablets in portrait and narrow windows get the mobile layout: the canvas fills the
 * screen and the side panels open as sheets from a bottom bar. A phone held sideways is wide
 * but short, so a short touch screen counts too. The stylesheet follows the `data-mobile`
 * attribute that App sets from this query, so the two never disagree.
 */
export const MOBILE_QUERY = '(max-width: 899px), (pointer: coarse) and (max-height: 599px)';

/** A finger is the main pointer: canvas handles get bigger and easier to hit. */
export const TOUCH_QUERY = '(pointer: coarse)';

const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matches(query),
    () => false,
  );
}

export const useMobileLayout = () => useMediaQuery(MOBILE_QUERY);
export const useTouchScreen = () => useMediaQuery(TOUCH_QUERY);

/** How to undo, for messages: there is no Ctrl+Z on a phone. */
export const undoHint = () => (matches(TOUCH_QUERY) ? 'Tap Undo' : 'Press Ctrl+Z');
