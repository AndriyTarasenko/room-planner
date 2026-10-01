import { describe, expect, it } from 'vitest';
import { BUILT_IN_PRODUCTS, findBuiltInProduct, manufacturersOf } from './catalog';
import { CATALOG_CATEGORY_ORDER } from './categories';
import { NO_FILTER, filterProducts, groupByCategory, isFiltering, matchesQuery, normalizeSearchText } from './search';
import type { FurnitureProduct } from './types';

const ids = (products: FurnitureProduct[]) => products.map((p) => p.id);
const search = (query: string) => filterProducts(BUILT_IN_PRODUCTS, { ...NO_FILTER, query });

describe('catalog search', () => {
  it('finds products by name, case-insensitively', () => {
    const results = search('alex');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => /alex/i.test(`${p.productName} ${p.productFamily}`))).toBe(true);
    expect(ids(search('ALEX'))).toEqual(ids(results));
  });

  it('ignores accents, so "idasen" finds IDÅSEN', () => {
    expect(normalizeSearchText('IDÅSEN Sitz/Steh')).toBe('idasen sitz/steh');
    expect(search('idasen').map((p) => p.productName)).toEqual(['IDÅSEN', 'IDÅSEN']);
  });

  it('requires every term to match', () => {
    const results = search('alex drawer');
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((p) => p.productName === 'ALEX' && /drawer/i.test(p.productType ?? ''))).toBe(true);
  });

  it('finds products by manufacturer, category and product type', () => {
    expect(search('ikea').every((p) => p.manufacturer === 'IKEA')).toBe(true);
    expect(search('generic').every((p) => p.manufacturer === 'Generic')).toBe(true);
    expect(search('sofa').every((p) => p.category === 'sofa' || /sofa|day-bed/i.test(`${p.productName} ${p.productType}`))).toBe(true);
    expect(ids(search('wardrobe frame'))).toEqual(['ikea:90458221', 'ikea:80458207', 'ikea:29494751']);
  });

  it('finds products by article number, with or without dots', () => {
    expect(ids(search('004.735.46'))).toEqual(['ikea:00473546']);
    expect(ids(search('00473546'))).toEqual(['ikea:00473546']);
  });

  it('finds products by size', () => {
    expect(search('160x80').length).toBeGreaterThan(3);
    expect(ids(search('36x58x70'))).toEqual(['ikea:00473546']);
  });

  it('finds beds by the mattress size they are sold as', () => {
    // The frame is 176 × 209 cm, but people shop for a "160x200" bed.
    expect(ids(search('malm bed 160'))).toEqual(['ikea:09929373']);
    expect(ids(search('malm 140x200'))).toEqual(['ikea:29931596']);
  });

  it('does not match short numbers inside article numbers', () => {
    // 299.316.00 contains "316" and "160" as digits, but those are sizes, not article numbers.
    expect(ids(search('malm bed 180'))).toEqual(['ikea:29931600']);
    expect(search('316')).toEqual([]);
    expect(ids(search('735.46'))).toEqual(['ikea:00473546']);
    expect(ids(search('29931600'))).toEqual(['ikea:29931600']);
  });

  it('returns everything for an empty query', () => {
    expect(search('   ')).toHaveLength(BUILT_IN_PRODUCTS.length);
    expect(matchesQuery(BUILT_IN_PRODUCTS[0], '')).toBe(true);
  });
});

describe('catalog filters', () => {
  it('filters by manufacturer and category', () => {
    const ikeaDesks = filterProducts(BUILT_IN_PRODUCTS, { ...NO_FILTER, manufacturer: 'IKEA', category: 'desk' });
    expect(ikeaDesks.length).toBeGreaterThan(10);
    expect(ikeaDesks.every((p) => p.manufacturer === 'IKEA' && p.category === 'desk')).toBe(true);
    const genericChairs = filterProducts(BUILT_IN_PRODUCTS, { ...NO_FILTER, manufacturer: 'Generic', category: 'chair' });
    expect(ids(genericChairs)).toEqual(['generic:office-chair', 'generic:dining-chair', 'generic:armchair', 'generic:pouf', 'generic:stool', 'generic:bar-stool']);
  });

  it('filters favorites and catalog layers', () => {
    const favorites = new Set(['ikea:00473546', 'generic:bed']);
    expect(ids(filterProducts(BUILT_IN_PRODUCTS, { ...NO_FILTER, favoritesOnly: true }, favorites))).toEqual(['generic:bed', 'ikea:00473546']);
    const saved: FurnitureProduct = { ...findBuiltInProduct('generic:shelf')!, id: 'user:shelf', origin: 'user' };
    const all = [...BUILT_IN_PRODUCTS, saved];
    expect(ids(filterProducts(all, { ...NO_FILTER, origin: 'user' }))).toEqual(['user:shelf']);
  });

  it('combines query and filters', () => {
    const results = filterProducts(BUILT_IN_PRODUCTS, { ...NO_FILTER, query: 'malm', category: 'bed' });
    expect(results.map((p) => p.width)).toEqual([105, 156, 176, 196]);
  });

  it('knows when a filter is active', () => {
    expect(isFiltering(NO_FILTER)).toBe(false);
    expect(isFiltering({ ...NO_FILTER, query: ' ' })).toBe(false);
    expect(isFiltering({ ...NO_FILTER, category: 'bed' })).toBe(true);
  });

  it('groups results by category in display order', () => {
    const groups = groupByCategory(BUILT_IN_PRODUCTS);
    expect(groups.map((g) => g.category)).toEqual(CATALOG_CATEGORY_ORDER);
    expect(groups.every((g) => g.products.every((p) => p.category === g.category))).toBe(true);
    expect(groups.reduce((n, g) => n + g.products.length, 0)).toBe(BUILT_IN_PRODUCTS.length);
  });

  it('lists manufacturers with Generic first', () => {
    expect(manufacturersOf(BUILT_IN_PRODUCTS)).toEqual(['Generic', 'IKEA']);
    const extra = { ...BUILT_IN_PRODUCTS[0], id: 'x', manufacturer: 'Custom' };
    expect(manufacturersOf([...BUILT_IN_PRODUCTS, extra])).toEqual(['Generic', 'Custom', 'IKEA']);
  });
});
