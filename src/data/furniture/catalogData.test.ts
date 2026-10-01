import { describe, expect, it } from 'vitest';
import { BUILT_IN_PRODUCTS, CATALOG_METADATA } from '../../catalog/catalog';
import { parseProduct } from '../../catalog/validation';
import { PRESETS, presetForType } from '../../furniture/presets';
import { FURNITURE_TYPES } from '../../types';
import { GENERIC_PRODUCTS } from './generic';
import { IKEA_CATALOG_VERIFIED_ON, IKEA_PRODUCTS } from './ikea';

describe('built-in catalog data', () => {
  it('has unique ids', () => {
    const ids = BUILT_IN_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only contains products that pass the same validation as saved products', () => {
    for (const product of BUILT_IN_PRODUCTS) {
      expect(parseProduct(product, 'built-in'), product.id).toEqual(product);
    }
  });

  it('has a dated catalog version', () => {
    expect(CATALOG_METADATA.version).toMatch(/^\d+\.\d+$/);
    expect(CATALOG_METADATA.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('offers every generic preset', () => {
    expect(GENERIC_PRODUCTS).toHaveLength(PRESETS.length);
    expect(GENERIC_PRODUCTS.every((p) => p.manufacturer === 'Generic' && !p.articleNumber)).toBe(true);
  });

  it('has a generic product for every kind', () => {
    for (const kind of FURNITURE_TYPES) expect(GENERIC_PRODUCTS.some((p) => p.kind === kind), kind).toBe(true);
  });

  it('covers kitchens and bathrooms', () => {
    const names = (category: string) => GENERIC_PRODUCTS.filter((p) => p.category === category).map((p) => p.productName);
    expect(names('kitchen')).toEqual(expect.arrayContaining(['Kitchen counter', 'Sink cabinet', 'Stove', 'Fridge-freezer', 'Dishwasher']));
    expect(names('bathroom')).toEqual(expect.arrayContaining(['Toilet', 'Washbasin', 'Shower', 'Bathtub', 'Washing machine']));
  });

  it('takes kind defaults from a preset placed where that kind usually goes', () => {
    // presetForType supplies placement and clearance to catalog products of the kind.
    expect(presetForType('kitchen-cabinet').placement).toBe('floor');
    expect(presetForType('appliance').placement).toBe('floor');
    expect(presetForType('tv').placement).toBe('surface');
  });

  it('gives L-shaped products a segment that still forms an L', () => {
    const lShaped = GENERIC_PRODUCTS.filter((p) => p.shape?.kind === 'l');
    expect(lShaped.map((p) => p.id)).toEqual(['generic:l-desk', 'generic:sofa-chaise', 'generic:corner-sofa', 'generic:kitchen-counter-l']);
    for (const p of lShaped) {
      if (p.shape?.kind !== 'l') continue;
      expect(p.shape.segment).toBeLessThan(Math.min(p.width, p.depth));
    }
  });
});

describe('curated IKEA products', () => {
  it.each(IKEA_PRODUCTS.map((p) => [p.id, p] as const))('%s has verified provenance', (_id, p) => {
    expect(p.manufacturer).toBe('IKEA');
    expect(p.articleNumber).toMatch(/^\d{3}\.\d{3}\.\d{2}$/);
    // The id is derived from the article number, so live results can be matched to it.
    expect(p.id).toBe(`ikea:${p.articleNumber!.replace(/\./g, '')}`);
    expect(p.productUrl).toMatch(/^https:\/\/www\.ikea\.com\/de\/de\/p\/[a-z0-9-]+-s?\d{8}\/$/);
    expect(p.productUrl!.endsWith(`${p.id.slice(5)}/`)).toBe(true);
    expect(p.source).toBe(p.productUrl);
    expect(p.sourceLastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.sourceLastVerified! <= CATALOG_METADATA.lastUpdated).toBe(true);
    expect(typeof p.metadata?.sourceMeasurements).toBe('string');
    expect(p.productType && p.variant).toBeTruthy();
  });

  it.each(IKEA_PRODUCTS.map((p) => [p.id, p] as const))('%s has plausible dimensions', (_id, p) => {
    for (const v of [p.width, p.depth, p.height]) {
      expect(v).toBeGreaterThan(20);
      expect(v).toBeLessThan(300);
    }
    if (p.heightMax !== undefined) expect(p.heightMax).toBeGreaterThan(p.height);
    // Every dimension appears in the recorded page measurements.
    const measured = String(p.metadata!.sourceMeasurements);
    for (const v of [p.width, p.depth, p.height, p.heightMax].filter((x) => x !== undefined)) {
      expect(measured).toMatch(new RegExp(`\\b${String(v).replace('.', '\\.')}(\\.0)? cm`));
    }
  });

  it('has one entry per geometry within a product family', () => {
    const keys = IKEA_PRODUCTS.map((p) => `${p.productName}|${p.productType}|${p.width}x${p.depth}x${p.height}-${p.heightMax ?? ''}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('records bed frames with their frame size, not the mattress size', () => {
    const malm = IKEA_PRODUCTS.filter((p) => p.productName === 'MALM' && p.category === 'bed');
    expect(malm.map((p) => [p.width, p.depth])).toEqual([
      [105, 209],
      [156, 209],
      [176, 209],
      [196, 209],
    ]);
  });

  it('was verified on the documented date', () => {
    expect(IKEA_PRODUCTS.every((p) => p.sourceLastVerified === IKEA_CATALOG_VERIFIED_ON)).toBe(true);
  });
});
