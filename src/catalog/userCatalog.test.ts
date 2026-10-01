import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../testing/memoryStorage';
import { findBuiltInProduct } from './catalog';
import { RECENT_LIMIT, USER_CATALOG_KEY, createUserCatalogStore, parseUserCatalog } from './userCatalog';
import type { FurnitureProduct } from './types';

const saved: FurnitureProduct = {
  id: 'ikea:12345678',
  manufacturer: 'IKEA',
  productName: 'TESTA',
  productType: 'Desk',
  category: 'desk',
  kind: 'desk',
  width: 120,
  depth: 60,
  height: 74,
  articleNumber: '123.456.78',
  productUrl: 'https://www.ikea.com/de/en/p/testa-desk-12345678/',
  origin: 'live',
  source: 'https://www.ikea.com/de/en/p/testa-desk-12345678/',
  metadata: { dimensionsSource: 'user', listedSize: '120x60 cm' },
};

describe('personal catalog persistence', () => {
  it('saves products as user products and restores them after a reload', () => {
    const storage = new MemoryStorage();
    const store = createUserCatalogStore(storage);
    expect(store.getState().saveProduct(saved)).toBe(true);
    expect(store.getState().products[0].origin).toBe('user');

    const reloaded = createUserCatalogStore(storage);
    expect(reloaded.getState().products).toEqual([{ ...saved, origin: 'user' }]);
  });

  it('replaces a product saved twice instead of duplicating it', () => {
    const store = createUserCatalogStore(new MemoryStorage());
    store.getState().saveProduct(saved);
    store.getState().saveProduct({ ...saved, width: 140 });
    expect(store.getState().products).toHaveLength(1);
    expect(store.getState().products[0].width).toBe(140);
  });

  it('toggles favorites and keeps them across reloads', () => {
    const storage = new MemoryStorage();
    const store = createUserCatalogStore(storage);
    store.getState().toggleFavorite('ikea:00473546');
    store.getState().toggleFavorite('generic:bed');
    store.getState().toggleFavorite('generic:bed');
    expect(createUserCatalogStore(storage).getState().favorites).toEqual(['ikea:00473546']);
  });

  it(`keeps the ${RECENT_LIMIT} most recently used products, newest first`, () => {
    const store = createUserCatalogStore(new MemoryStorage());
    for (let i = 1; i <= 10; i++) store.getState().markUsed(`p${i}`);
    store.getState().markUsed('p5');
    const recent = store.getState().recent;
    expect(recent).toHaveLength(RECENT_LIMIT);
    expect(recent.slice(0, 3)).toEqual(['p5', 'p10', 'p9']);
    expect(new Set(recent).size).toBe(recent.length);
  });

  it('removing a product also removes it from favorites and recents', () => {
    const store = createUserCatalogStore(new MemoryStorage());
    store.getState().saveProduct(saved);
    store.getState().toggleFavorite(saved.id);
    store.getState().markUsed(saved.id);
    store.getState().removeProduct(saved.id);
    expect(store.getState()).toMatchObject({ products: [], favorites: [], recent: [] });
  });

  it('starts empty on corrupt data and keeps a copy of it', () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_CATALOG_KEY, '{not json');
    const store = createUserCatalogStore(storage);
    expect(store.getState().products).toEqual([]);
    expect(storage.getItem('room-planner:catalog:unreadable')).toBe('{not json');
  });

  it('reports when storage is full', () => {
    const storage = new MemoryStorage();
    const store = createUserCatalogStore(storage);
    storage.failWrites = true;
    expect(store.getState().saveProduct(saved)).toBe(false);
  });

  it('works without any storage', () => {
    const store = createUserCatalogStore(null);
    store.getState().toggleFavorite('generic:bed');
    expect(store.getState().favorites).toEqual(['generic:bed']);
  });
});

describe('personal catalog validation', () => {
  it('drops products without trustworthy dimensions instead of guessing', () => {
    const data = parseUserCatalog({
      products: [
        saved,
        { ...saved, id: 'no-width', width: undefined },
        { ...saved, id: 'zero-depth', depth: 0 },
        { ...saved, id: 'text-height', height: '74' },
        { ...saved, id: 'no-name', productName: '  ' },
        'garbage',
        { ...saved }, // duplicate id
      ],
      favorites: ['a', 'a', 42, 'b'],
      recent: Array.from({ length: 20 }, (_, i) => `r${i}`),
    });
    expect(data.products.map((p) => p.id)).toEqual([saved.id]);
    expect(data.favorites).toEqual(['a', 'b']);
    expect(data.recent).toHaveLength(RECENT_LIMIT);
  });

  it('strips unsafe links and unknown values', () => {
    const [product] = parseUserCatalog({
      products: [{ ...saved, productUrl: 'javascript:alert(1)', imageUrl: 'data:image/png;base64,xx', category: 'spaceship', kind: 'ufo', metadata: { ok: 'yes', nested: { a: 1 } } }],
    }).products;
    expect(product.productUrl).toBeUndefined();
    expect(product.imageUrl).toBeUndefined();
    expect(product.category).toBe('other');
    expect(product.kind).toBe('generic');
    expect(product.metadata).toEqual({ ok: 'yes' });
  });

  it('accepts built-in products unchanged', () => {
    const builtIn = findBuiltInProduct('ikea:59529966')!;
    const [parsed] = parseUserCatalog({ products: [builtIn] }).products;
    expect(parsed).toEqual({ ...builtIn, origin: 'user' });
  });
});
