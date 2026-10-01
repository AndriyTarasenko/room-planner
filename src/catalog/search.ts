import { TYPE_LABELS } from '../furniture/presets';
import { formatNumber } from '../utils/format';
import { CATALOG_CATEGORIES, CATALOG_CATEGORY_ORDER } from './categories';
import type { CatalogCategory, CatalogOrigin, FurnitureProduct } from './types';

export interface CatalogFilter {
  query: string;
  /** Manufacturer name, or null for all. */
  manufacturer: string | null;
  category: CatalogCategory | null;
  /** Restrict to one catalog layer, e.g. "user" for My furniture. */
  origin: CatalogOrigin | null;
  favoritesOnly: boolean;
}

export const NO_FILTER: CatalogFilter = { query: '', manufacturer: null, category: null, origin: null, favoritesOnly: false };

export const isFiltering = (f: CatalogFilter) =>
  f.query.trim() !== '' || f.manufacturer !== null || f.category !== null || f.origin !== null || f.favoritesOnly;

/** Lowercase without accents, so "idasen" finds IDÅSEN and "kallax" finds KALLAX. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae');
}

const haystacks = new WeakMap<FurnitureProduct, string>();

/** Everything a product can be found by, normalized once per product object. */
function haystackOf(p: FurnitureProduct): string {
  let text = haystacks.get(p);
  if (text === undefined) {
    const w = formatNumber(p.width);
    const d = formatNumber(p.depth);
    const h = formatNumber(p.height);
    text = normalizeSearchText(
      [
        p.manufacturer,
        p.productName,
        p.productFamily,
        p.productType,
        p.variant,
        CATALOG_CATEGORIES[p.category].label,
        TYPE_LABELS[p.kind],
        typeof p.metadata?.listedSize === 'string' ? p.metadata.listedSize : undefined,
        `${w}x${d}`,
        `${w}x${d}x${h}`,
      ]
        .filter(Boolean)
        .join(' \u0001 '),
    );
    haystacks.set(p, text);
  }
  return text;
}

/**
 * Article numbers only match terms that look like one (5+ digits, dots allowed: "00473546",
 * "735.46"), so a size such as "160" doesn't hit the digits of "299.316.00".
 */
function matchesArticle(article: string | undefined, term: string): boolean {
  const digits = term.replace(/\./g, '');
  if (!article || !/^\d{5,}$/.test(digits)) return false;
  return article.includes(term) || article.replace(/\D/g, '').includes(digits);
}

/** Case- and accent-insensitive; every whitespace-separated term must match somewhere. */
export function matchesQuery(product: FurnitureProduct, query: string): boolean {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = haystackOf(product);
  return terms.every((term) => haystack.includes(term) || matchesArticle(product.articleNumber, term));
}

export function filterProducts(
  products: readonly FurnitureProduct[],
  filter: CatalogFilter,
  favorites: ReadonlySet<string> = new Set(),
): FurnitureProduct[] {
  return products.filter(
    (p) =>
      (filter.manufacturer === null || p.manufacturer === filter.manufacturer) &&
      (filter.category === null || p.category === filter.category) &&
      (filter.origin === null || p.origin === filter.origin) &&
      (!filter.favoritesOnly || favorites.has(p.id)) &&
      matchesQuery(p, filter.query),
  );
}

/** Groups products by category in display order, keeping their order inside each group. */
export function groupByCategory(products: readonly FurnitureProduct[]): { category: CatalogCategory; products: FurnitureProduct[] }[] {
  return CATALOG_CATEGORY_ORDER.map((category) => ({ category, products: products.filter((p) => p.category === category) })).filter(
    (g) => g.products.length > 0,
  );
}
