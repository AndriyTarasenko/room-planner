import { describe, expect, it } from 'vitest';
import { LiveSearchError } from '../../types';
import { formatIkeaArticleNumber, ikeaSearchUrl } from './config';
import { classifyIkeaProduct, isListedAsRound, normalizeIkeaProduct, normalizeIkeaSearchResponse, parseListedSize } from './normalizeIkeaProduct';
import { IKEA_SEARCH_FIXTURE } from './searchResponse.fixture';

const candidates = normalizeIkeaSearchResponse(IKEA_SEARCH_FIXTURE);
const byName = (name: string) => candidates.find((c) => c.product.productName === name)!;

describe('IKEA search normalization', () => {
  it('keeps valid, unique products in IKEA order', () => {
    expect(candidates.map((c) => c.product.productName)).toEqual(['ALEX', 'BILLY', 'MALM', 'MITTZON', 'ALEFJÄLL', 'EVIL']);
  });

  it('maps identity and provenance fields', () => {
    const alex = byName('ALEX');
    expect(alex.product).toMatchObject({
      id: 'ikea:00473546',
      manufacturer: 'IKEA',
      productName: 'ALEX',
      productFamily: 'ALEX',
      productType: 'Drawer unit',
      variant: 'white',
      articleNumber: '004.735.46',
      category: 'storage',
      kind: 'sideboard',
      origin: 'live',
      productUrl: 'https://www.ikea.com/de/en/p/alex-drawer-unit-white-00473546/',
      source: 'https://www.ikea.com/de/en/p/alex-drawer-unit-white-00473546/',
    });
    expect(alex.product.imageUrl).toMatch(/^https:\/\/www\.ikea\.com\//);
    // Price is kept only as optional metadata.
    expect(alex.product.metadata).toEqual({ listedSize: '36x70 cm', listedPrice: '59.99 EUR' });
  });

  it('never turns a two-number size label into dimensions', () => {
    const alex = byName('ALEX');
    expect(alex.dimensions).toBeNull();
    expect(alex.listedSize).toBe('36x70 cm');
    expect(alex.dimensionsNote).toContain('36x70 cm');
  });

  it('warns that a bed label is the mattress size', () => {
    const malm = byName('MALM');
    expect(malm.dimensions).toBeNull();
    expect(malm.product.category).toBe('bed');
    expect(malm.dimensionsNote).toMatch(/mattress size/);
  });

  it('reads the three-number label as width × depth × height', () => {
    expect(byName('BILLY').dimensions).toEqual({ width: 80, depth: 28, height: 202 });
  });

  it('detects sit/stand desks and falls back to the type name without a class', () => {
    expect(byName('MITTZON').product.kind).toBe('sit-stand-desk');
    expect(byName('ALEFJÄLL').product).toMatchObject({ category: 'chair', kind: 'office-chair' });
    expect(byName('ALEFJÄLL').dimensions).toBeNull();
  });

  it('drops URLs that are not https links to ikea.com', () => {
    const evil = byName('EVIL').product;
    expect(evil.productUrl).toBeUndefined();
    expect(evil.imageUrl).toBeUndefined();
    expect(evil.source).toBe('IKEA online search');
  });

  it('rejects entries without a valid item number or name', () => {
    expect(normalizeIkeaProduct({ name: 'X', itemNo: '123' })).toBeNull();
    expect(normalizeIkeaProduct({ itemNo: '12345678' })).toBeNull();
    expect(normalizeIkeaProduct(null)).toBeNull();
    expect(normalizeIkeaProduct('ALEX')).toBeNull();
  });

  it('treats a page without products as no results, and a changed schema as an error', () => {
    expect(normalizeIkeaSearchResponse({ searchResultPage: { products: {} } })).toEqual([]);
    expect(() => normalizeIkeaSearchResponse({ results: [] })).toThrow(LiveSearchError);
    expect(() => normalizeIkeaSearchResponse(null)).toThrow(LiveSearchError);
  });
});

describe('IKEA size labels', () => {
  it.each([
    ['80x28x202 cm', { width: 80, depth: 28, height: 202 }],
    ['76,5x39x146,5 cm', { width: 76.5, depth: 39, height: 146.5 }],
    [' 180 x 42 x 38 cm ', { width: 180, depth: 42, height: 38 }],
  ])('parses %s', (text, expected) => {
    expect(parseListedSize(text)).toEqual(expected);
  });

  it.each(['36x70 cm', '140x200 cm', '120/170x80 cm', '215/135x28x237 cm', '107 cm', 'Medium', '', undefined, '0x10x10 cm'])(
    'ignores %s',
    (text) => {
      expect(parseListedSize(text)).toBeNull();
    },
  );

  it('takes a table listed with one number as round, but not a stool (that number is its seat height)', () => {
    expect(isListedAsRound('table', '103 cm')).toBe(true);
    expect(isListedAsRound('table', '110/155 cm')).toBe(false);
    expect(isListedAsRound('table', '140x80 cm')).toBe(false);
    expect(isListedAsRound('pouf', '63 cm')).toBe(false);
    const docksta = normalizeIkeaProduct({ itemNo: '19324995', name: 'DOCKSTA', typeName: 'Table', filterClass: 'tables', itemMeasureReferenceText: '103 cm' })!;
    expect(docksta.product).toMatchObject({ kind: 'table', shape: { kind: 'round' } });
    expect(docksta.dimensions).toBeNull();
    expect(docksta.dimensionsNote).toMatch(/diameter of this round table/);
    expect(byName('ALEX').product.shape).toBeUndefined();
  });
});

describe('IKEA classification', () => {
  it.each([
    ['desks', 'Desk', 'desk', 'desk'],
    ['chairs', 'Gaming chair', 'chair', 'office-chair'],
    ['chairs', 'Chair', 'chair', 'chair'],
    ['armchairs', 'Armchair', 'chair', 'armchair'],
    ['sofas', '3-seat sofa', 'sofa', 'sofa'],
    ['sofas', 'Corner sofa, 4-seat', 'sofa', 'sofa'],
    ['sofa beds', 'Sofa-bed', 'sofa', 'sofa'],
    ['bed frames', 'Bed frame', 'bed', 'bed'],
    ['bedside tables', 'Bedside table', 'storage', 'sideboard'],
    ['wardrobes', 'Wardrobe', 'storage', 'wardrobe'],
    ['open storage solutions', 'Shelving unit', 'storage', 'shelf'],
    ['media furniture', 'TV bench', 'storage', 'sideboard'],
    ['side tables', 'Coffee table', 'table', 'table'],
    ['base cabinets', 'Base cabinet', 'kitchen', 'kitchen-cabinet'],
    ['wall cabinets', 'Wall cabinet', 'kitchen', 'kitchen-cabinet'],
    ['sink and wash basins', 'Inset sink, 1 bowl', 'kitchen', 'sink'],
    ['hobs', 'Induction hob', 'kitchen', 'stove'],
    ['fridges and freezers', 'Fridge', 'kitchen', 'appliance'],
    ['dishwashers', 'Integrated dishwasher', 'kitchen', 'appliance'],
    ['microwave ovens', 'Built-in microwave', 'kitchen', 'appliance'],
    ['base cabinets', 'Wash-stand with drawers', 'bathroom', 'washbasin'],
    ['sink and wash basins', 'Wash-basin with water trap', 'bathroom', 'washbasin'],
    ['washing machines and dryers', 'Washing machine', 'bathroom', 'washer'],
    ['footstools', 'Pouffe', 'chair', 'pouf'],
    ['stools', 'Stool', 'chair', 'pouf'],
    ['chairs', 'Bar stool', 'chair', 'pouf'],
    ['chairs', 'Bar stool with backrest', 'chair', 'chair'],
    [undefined, 'Footstool cushion', 'other', 'generic'],
    ['spr table and chair', 'Gaming desk and chair', 'other', 'generic'],
    ['furniture covers', 'Cover', 'other', 'generic'],
    ['desk accessories', 'Container with lid', 'other', 'generic'],
    ['ovenware', 'Oven dish', 'other', 'generic'],
    ['lighting', 'Lamp', 'other', 'generic'],
  ])('%s → %s/%s', (filterClass, typeName, category, kind) => {
    expect(classifyIkeaProduct(filterClass, typeName)).toEqual({ category, kind });
  });
});

describe('IKEA config', () => {
  it('formats article numbers like IKEA', () => {
    expect(formatIkeaArticleNumber('00473546')).toBe('004.735.46');
    expect(formatIkeaArticleNumber('99431982')).toBe('994.319.82');
  });

  it('builds the search URL from the central region setting', () => {
    const url = new URL(ikeaSearchUrl('alex desk & more'));
    expect(url.origin).toBe('https://sik.search.blue.cdtapps.com');
    expect(url.pathname).toBe('/de/en/search-result-page');
    expect(url.searchParams.get('q')).toBe('alex desk & more');
    expect(ikeaSearchUrl('x', { country: 'se', language: 'sv' })).toContain('/se/sv/');
  });
});
