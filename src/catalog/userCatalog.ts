/**
 * The personal catalog: products the user saved (imported from a live provider or created
 * as custom objects), favorites and recently used products. Kept in this browser's
 * localStorage, separate from the project: it is not part of undo history or project files.
 */
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { isObject } from '../utils/validate';
import type { FurnitureProduct } from './types';
import { parseProduct } from './validation';

export const USER_CATALOG_KEY = 'room-planner:catalog';
const BACKUP_KEY = 'room-planner:catalog:unreadable';
const USER_CATALOG_FORMAT = 'room-planner-catalog';
export const USER_CATALOG_SCHEMA_VERSION = 1;
export const RECENT_LIMIT = 8;
const SAVED_LIMIT = 1000;
const ID_LIST_LIMIT = 1000;

export interface UserCatalogData {
  /** Saved products (origin "user"), newest first. */
  products: FurnitureProduct[];
  favorites: string[];
  /** Recently used product ids, most recent first. */
  recent: string[];
}

export const EMPTY_USER_CATALOG: UserCatalogData = { products: [], favorites: [], recent: [] };

function idList(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 120);
  return [...new Set(ids)].slice(0, limit);
}

/** Reads stored data defensively: invalid products are dropped, never guessed. */
export function parseUserCatalog(raw: unknown): UserCatalogData {
  if (!isObject(raw)) return { ...EMPTY_USER_CATALOG };
  const products: FurnitureProduct[] = [];
  const seen = new Set<string>();
  for (const entry of Array.isArray(raw.products) ? raw.products : []) {
    const product = parseProduct(entry, 'user');
    if (product && !seen.has(product.id) && products.length < SAVED_LIMIT) {
      seen.add(product.id);
      products.push(product);
    }
  }
  return { products, favorites: idList(raw.favorites, ID_LIST_LIMIT), recent: idList(raw.recent, RECENT_LIMIT) };
}

export function serializeUserCatalog(data: UserCatalogData): string {
  return JSON.stringify({
    format: USER_CATALOG_FORMAT,
    schemaVersion: USER_CATALOG_SCHEMA_VERSION,
    products: data.products,
    favorites: data.favorites,
    recent: data.recent,
  });
}

function loadUserCatalog(storage: Storage | null): UserCatalogData {
  const text = storage?.getItem(USER_CATALOG_KEY);
  if (!storage || !text) return { ...EMPTY_USER_CATALOG };
  try {
    return parseUserCatalog(JSON.parse(text));
  } catch (error) {
    console.warn('Saved furniture could not be read; a copy was kept under', BACKUP_KEY, error);
    try {
      storage.setItem(BACKUP_KEY, text);
    } catch {
      // Storage full; nothing more to do.
    }
    return { ...EMPTY_USER_CATALOG };
  }
}

export interface UserCatalogState extends UserCatalogData {
  /** Adds or replaces a product (matched by id). Returns false when it could not be stored. */
  saveProduct(product: FurnitureProduct): boolean;
  /** Replaces a saved product in place (matched by id). Returns false when it could not be stored. */
  updateProduct(product: FurnitureProduct): boolean;
  removeProduct(id: string): void;
  toggleFavorite(id: string): void;
  markUsed(id: string): void;
  /** Re-reads storage, e.g. after another tab changed it. */
  reload(): void;
}

export function createUserCatalogStore(storage: Storage | null) {
  return createStore<UserCatalogState>()((set, get) => {
    const persist = (): boolean => {
      if (!storage) return false;
      try {
        storage.setItem(USER_CATALOG_KEY, serializeUserCatalog(get()));
        return true;
      } catch (error) {
        console.error('Saving furniture to localStorage failed', error);
        return false;
      }
    };

    return {
      ...loadUserCatalog(storage),

      saveProduct: (product) => {
        const saved: FurnitureProduct = { ...product, origin: 'user' };
        set({ products: [saved, ...get().products.filter((p) => p.id !== saved.id)].slice(0, SAVED_LIMIT) });
        return persist();
      },

      updateProduct: (product) => {
        const products = get().products;
        if (!products.some((p) => p.id === product.id)) return get().saveProduct(product);
        const saved: FurnitureProduct = { ...product, origin: 'user' };
        set({ products: products.map((p) => (p.id === saved.id ? saved : p)) });
        return persist();
      },

      removeProduct: (id) => {
        const s = get();
        set({
          products: s.products.filter((p) => p.id !== id),
          favorites: s.favorites.filter((f) => f !== id),
          recent: s.recent.filter((r) => r !== id),
        });
        persist();
      },

      toggleFavorite: (id) => {
        const favorites = get().favorites;
        set({ favorites: favorites.includes(id) ? favorites.filter((f) => f !== id) : [id, ...favorites].slice(0, ID_LIST_LIMIT) });
        persist();
      },

      markUsed: (id) => {
        const recent = [id, ...get().recent.filter((r) => r !== id)].slice(0, RECENT_LIMIT);
        set({ recent });
        persist();
      },

      reload: () => set(loadUserCatalog(storage)),
    };
  });
}

export type UserCatalogStore = ReturnType<typeof createUserCatalogStore>;

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The app's personal catalog. */
export const userCatalogStore = createUserCatalogStore(browserStorage());

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === USER_CATALOG_KEY) userCatalogStore.getState().reload();
  });
}

export function useUserCatalog<T>(selector: (state: UserCatalogState) => T): T {
  return useStore(userCatalogStore, selector);
}
