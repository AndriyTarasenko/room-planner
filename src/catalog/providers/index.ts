import type { LiveCatalogProvider } from '../types';
import { ikeaProvider } from './ikea';

/**
 * Optional online product sources, offered in the furniture browser as "Search … online".
 * The UI only talks to the LiveCatalogProvider interface; to add a manufacturer, implement
 * it in its own folder next to ikea/ and list it here.
 */
export const LIVE_PROVIDERS: readonly LiveCatalogProvider[] = [ikeaProvider];
