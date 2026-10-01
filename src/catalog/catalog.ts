import { GENERIC_PRODUCTS } from '../data/furniture/generic';
import { IKEA_PRODUCTS } from '../data/furniture/ikea';
import { type FurnitureProduct, GENERIC_MANUFACTURER } from './types';

/** Version of the built-in catalog data, shown in the About dialog. Bump when entries change. */
export const CATALOG_METADATA = {
  version: '1.2',
  lastUpdated: '2026-10-01',
} as const;

/** Everything that ships with the app: generic furniture first, then curated manufacturer products. */
export const BUILT_IN_PRODUCTS: readonly FurnitureProduct[] = [...GENERIC_PRODUCTS, ...IKEA_PRODUCTS];

const builtInById = new Map(BUILT_IN_PRODUCTS.map((p) => [p.id, p]));

export const findBuiltInProduct = (id: string): FurnitureProduct | undefined => builtInById.get(id);

/** Looks a product up in the built-in catalog first (verified data wins), then in saved products. */
export function findProduct(id: string, saved: readonly FurnitureProduct[]): FurnitureProduct | undefined {
  return builtInById.get(id) ?? saved.find((p) => p.id === id);
}

/** Manufacturer filter options: Generic first, the rest alphabetically. */
export function manufacturersOf(products: readonly FurnitureProduct[]): string[] {
  const names = [...new Set(products.map((p) => p.manufacturer))];
  return names.sort((a, b) =>
    a === GENERIC_MANUFACTURER ? -1 : b === GENERIC_MANUFACTURER ? 1 : a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}
