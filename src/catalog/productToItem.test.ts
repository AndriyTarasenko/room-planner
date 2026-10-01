import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../furniture/categories';
import { createItemFromPreset } from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import { createEmptyProject } from '../store/sampleProject';
import { parseProjectJson, serializeProject } from '../store/serialization';
import { findBuiltInProduct } from './catalog';
import { productToItem } from './productToItem';
import type { FurnitureProduct } from './types';

const product = (id: string) => {
  const p = findBuiltInProduct(id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
};

describe('catalog product → room item', () => {
  it('copies geometry, name and manufacturer details into the item', () => {
    const item = productToItem(product('ikea:00473546'), { x: 100, y: 50 });
    expect(item).toMatchObject({
      type: 'sideboard',
      name: 'ALEX Drawer unit',
      x: 100,
      y: 50,
      width: 36,
      depth: 58,
      height: 70,
      category: 'storage',
      color: CATEGORIES.storage.color,
      placement: 'floor',
      attachedTo: null,
    });
    expect(item.product).toEqual({
      catalogId: 'ikea:00473546',
      manufacturer: 'IKEA',
      productName: 'ALEX',
      productFamily: 'ALEX',
      productType: 'Drawer unit',
      variant: 'white',
      articleNumber: '004.735.46',
      productUrl: 'https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/',
      source: 'https://www.ikea.com/de/de/p/alex-schubladenelement-weiss-00473546/',
      sourceLastVerified: '2026-09-30',
    });
  });

  it('uses the lowest height of adjustable products and planner defaults of the kind', () => {
    const desk = productToItem(product('ikea:59529966'), { x: 0, y: 0 });
    expect(desk).toMatchObject({ type: 'sit-stand-desk', width: 160, depth: 80, height: 62, category: 'desk' });
    const chair = productToItem(product('ikea:70261150'), { x: 0, y: 0 });
    // Chairs face a desk against the top wall and reserve roll-back space, like the generic chair.
    expect(chair).toMatchObject({ type: 'office-chair', category: 'seating', rotation: 180 });
    expect(chair.clearance).toMatchObject({ enabled: true, back: 40 });
  });

  it('maps beds by frame size, not mattress size', () => {
    const bed = productToItem(product('ikea:29931596'), { x: 0, y: 0 });
    expect(bed).toMatchObject({ type: 'bed', width: 156, depth: 209, height: 100 });
  });

  it('creates generic items exactly like the preset, without a product reference', () => {
    const item = productToItem(product('generic:l-desk'), { x: 10, y: 20 });
    const fromPreset = createItemFromPreset(findPreset('l-desk')!, { x: 10, y: 20 });
    expect({ ...item, id: '' }).toEqual({ ...fromPreset, id: '' });
    expect(item.product).toBeUndefined();
  });

  it('does not share objects with the catalog entry', () => {
    const source: FurnitureProduct = { ...product('ikea:00263850'), clearance: { enabled: true, front: 50 } };
    const item = productToItem(source, { x: 0, y: 0 });
    source.width = 999;
    source.clearance!.front = 1;
    expect(item.width).toBe(80);
    expect(item.clearance.front).toBe(50);
  });

  it('survives export and import without the catalog entry', () => {
    const vanished: FurnitureProduct = { ...product('ikea:80483438'), id: 'ikea:discontinued-99999999' };
    const item = productToItem(vanished, { x: 120, y: 60 });
    const project = createEmptyProject(400, 300);
    project.layouts[0].furniture.push(item);

    const restored = parseProjectJson(serializeProject(project)).layouts[0].furniture[0];
    expect(findBuiltInProduct(restored.product!.catalogId)).toBeUndefined();
    expect(restored).toEqual(item);
  });
});
