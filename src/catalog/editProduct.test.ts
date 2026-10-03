import { describe, expect, it } from 'vitest';
import { type ProductEdit, applyProductEdit, editProduct, productStandsOn } from './editProduct';
import { productToItem } from './productToItem';
import type { FurnitureProduct } from './types';

const custom: FurnitureProduct = {
  id: 'custom_1',
  manufacturer: 'Custom',
  productName: 'Box',
  category: 'other',
  kind: 'generic',
  width: 60,
  depth: 40,
  height: 50,
  placement: 'floor',
  origin: 'user',
  source: 'Entered by you',
  metadata: { dimensionsSource: 'user', importedOn: '2026-10-01' },
};

const imported: FurnitureProduct = {
  id: 'ikea:12345678',
  manufacturer: 'IKEA',
  productName: 'TESTA',
  productType: 'Drawer unit',
  category: 'storage',
  kind: 'sideboard',
  width: 36,
  depth: 58,
  height: 70,
  articleNumber: '123.456.78',
  origin: 'user',
  metadata: { dimensionsSource: 'listing', listedSize: '36x58 cm', importedOn: '2026-10-01' },
};

const unchanged = (p: FurnitureProduct): ProductEdit => ({
  name: p.productType ? `${p.productName} ${p.productType}` : p.productName,
  width: p.width,
  depth: p.depth,
  height: p.height,
  shape: p.shape?.kind === 'l' ? null : p.shape?.kind === 'round' ? 'round' : 'rect',
  category: p.category,
  standsOn: productStandsOn(p),
});

describe('editing a saved product', () => {
  it('changes nothing when nothing is edited', () => {
    expect(editProduct(custom, unchanged(custom))).toEqual(custom);
    expect(editProduct(imported, unchanged(imported))).toEqual({ ...imported, placement: 'floor' });
  });

  it('replaces the whole title with a new name', () => {
    const renamed = editProduct(imported, { ...unchanged(imported), name: '  Bedside drawers ' });
    expect(renamed.productName).toBe('Bedside drawers');
    expect(renamed).not.toHaveProperty('productType');
    expect(renamed.articleNumber).toBe('123.456.78');
    // An empty name keeps the old one.
    expect(editProduct(imported, { ...unchanged(imported), name: ' ' })).toMatchObject({ productName: 'TESTA', productType: 'Drawer unit' });
  });

  it('counts changed dimensions as entered by the user', () => {
    const resized = editProduct(imported, { ...unchanged(imported), height: 72 });
    expect(resized.height).toBe(72);
    expect(resized.metadata).toEqual({ ...imported.metadata, dimensionsSource: 'user' });
    expect(editProduct(imported, { ...unchanged(imported), name: 'Drawers' }).metadata).toEqual(imported.metadata);
  });

  it('makes a circle from the diameter and keeps an L-shape within the new size', () => {
    const round = editProduct(custom, { ...unchanged(custom), shape: 'round', width: 45 });
    expect(round).toMatchObject({ width: 45, depth: 45, shape: { kind: 'round' } });
    expect(editProduct(round, { ...unchanged(round), shape: 'rect' })).not.toHaveProperty('shape');

    const sofa: FurnitureProduct = { ...custom, kind: 'sofa', width: 250, depth: 160, shape: { kind: 'l', segment: 90, returnWidth: 90, returnSide: 'left' } };
    const smaller = editProduct(sofa, { ...unchanged(sofa), width: 80 });
    expect(smaller.shape).toEqual({ kind: 'l', segment: 90, returnWidth: 79, returnSide: 'left' });
  });

  it('keeps custom objects plain objects in any category; other products take the new category’s kind', () => {
    expect(editProduct(custom, { ...unchanged(custom), category: 'chair' })).toMatchObject({ category: 'chair', kind: 'generic' });
    expect(editProduct(imported, { ...unchanged(imported), category: 'desk' })).toMatchObject({ category: 'desk', kind: 'desk' });
  });

  it('stores floor-or-furniture objects with where they go by default', () => {
    const both = editProduct(custom, { ...unchanged(custom), standsOn: 'both' });
    expect(both).toMatchObject({ placement: 'floor', flexiblePlacement: true });
    expect(productStandsOn(both)).toBe('both');
    expect(editProduct(both, { ...unchanged(both), standsOn: 'surface' })).toMatchObject({ placement: 'surface' });
    expect(editProduct(both, { ...unchanged(both), standsOn: 'surface' })).not.toHaveProperty('flexiblePlacement');
  });

  it('drops a maximum height that is no longer above the height', () => {
    const desk: FurnitureProduct = { ...imported, kind: 'sit-stand-desk', height: 70, heightMax: 120 };
    expect(editProduct(desk, { ...unchanged(desk), height: 72 }).heightMax).toBe(120);
    expect(editProduct(desk, { ...unchanged(desk), height: 125 })).not.toHaveProperty('heightMax');
  });
});

describe('carrying an edit over to placed copies', () => {
  const placed = productToItem(custom, { x: 100, y: 100 });

  it('applies only what changed, keeping a copy’s own changes', () => {
    const next = editProduct(custom, { ...unchanged(custom), width: 80 });
    const ownHeight = { ...placed, height: 30, name: 'Toy box' };
    const updated = applyProductEdit(ownHeight, custom, next);
    expect(updated).toMatchObject({ width: 80, depth: 40, height: 30, name: 'Toy box', x: 100, y: 100 });
  });

  it('renames copies that still carry the product’s name', () => {
    const next = editProduct(custom, { ...unchanged(custom), name: 'Crate' });
    expect(applyProductEdit(placed, custom, next)).toMatchObject({ name: 'Crate', product: { productName: 'Crate' } });
    expect(applyProductEdit({ ...placed, name: 'Toy box' }, custom, next).name).toBe('Toy box');
  });

  it('follows a new category with the color, unless the copy has its own', () => {
    const next = editProduct(custom, { ...unchanged(custom), category: 'storage' });
    expect(applyProductEdit(placed, custom, next)).toMatchObject({ category: 'storage', color: productToItem(next, placed).color });
    expect(applyProductEdit({ ...placed, color: '#123456' }, custom, next).color).toBe('#123456');
  });

  it('changes where copies stand: off a desk onto the floor, or free to go on either', () => {
    const onDesk = { ...placed, placement: 'surface' as const, attachedTo: 'desk' };
    const asSurface = { ...custom, placement: 'surface' as const };
    expect(applyProductEdit(onDesk, asSurface, custom)).toMatchObject({ placement: 'floor', attachedTo: null, flexiblePlacement: false });
    const both = editProduct(asSurface, { ...unchanged(asSurface), standsOn: 'both' });
    expect(applyProductEdit(onDesk, asSurface, both)).toMatchObject({ placement: 'surface', attachedTo: 'desk', flexiblePlacement: true });
  });

  it('returns the copy itself when the edit changes nothing for it', () => {
    expect(applyProductEdit(placed, custom, editProduct(custom, unchanged(custom)))).toBe(placed);
  });
});
