/**
 * Editing a product saved in My furniture, and carrying the edit over to the copies already
 * placed in the project. Placed items keep their own copy of the product data, so they only
 * change when the user asks for it, and then only in what the edit changed.
 */
import { CATEGORIES } from '../furniture/categories';
import { presetForType } from '../furniture/presets';
import { type ShapeChoice } from '../furniture/shapeChoice';
import { type StandsOn, applyStandsOn, standsOnOf } from '../furniture/standsOn';
import type { FurnitureItem, Placement, Shape } from '../types';
import { DEFAULT_KIND, itemCategoryFor } from './categories';
import { productTitle } from './format';
import { toProductRef } from './productToItem';
import { type CatalogCategory, CUSTOM_MANUFACTURER, type FurnitureProduct } from './types';

/** What the edit form changes. */
export interface ProductEdit {
  name: string;
  width: number;
  /** Ignored for a circle, whose depth is its width (the diameter). */
  depth: number;
  height: number;
  /** Null keeps a shape the form doesn't offer (an L-shape), fitted to the new size. */
  shape: ShapeChoice | null;
  category: CatalogCategory;
  standsOn: StandsOn;
}

/** Where a product's items stand by default: its own placement, else its kind's usual one. */
export const productPlacement = (p: Pick<FurnitureProduct, 'placement' | 'kind'>): Placement => p.placement ?? presetForType(p.kind).placement;

export const productStandsOn = (p: FurnitureProduct): StandsOn =>
  standsOnOf({ placement: productPlacement(p), flexiblePlacement: p.flexiblePlacement });

/** Keeps both arms of an L-shape shorter than the footprint they are part of. */
function fitShape(shape: Shape | undefined, width: number, depth: number): Shape | undefined {
  if (shape?.kind !== 'l') return shape;
  return {
    ...shape,
    segment: Math.max(1, Math.min(shape.segment, depth - 1)),
    returnWidth: Math.max(1, Math.min(shape.returnWidth, width - 1)),
  };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * The product after an edit. A new name replaces the whole title (name and product type);
 * changed dimensions count as entered by the user. Custom objects stay plain objects in any
 * category; other products take the usual kind of a new category, as on import.
 */
export function editProduct(product: FurnitureProduct, edit: ProductEdit): FurnitureProduct {
  const width = edit.width;
  const depth = edit.shape === 'round' ? edit.width : edit.depth;
  const name = edit.name.trim();
  const renamed = name !== '' && name !== productTitle(product);
  const resized = width !== product.width || depth !== product.depth || edit.height !== product.height;
  const { placement, flexiblePlacement } = applyStandsOn(edit.standsOn, productPlacement(product));
  const keepsKind = product.manufacturer === CUSTOM_MANUFACTURER || edit.category === product.category;
  return withoutUndefined<FurnitureProduct>({
    ...product,
    ...(renamed && { productName: name, productType: undefined }),
    category: edit.category,
    kind: keepsKind ? product.kind : DEFAULT_KIND[edit.category],
    width,
    depth,
    height: edit.height,
    heightMax: product.heightMax !== undefined && product.heightMax > edit.height ? product.heightMax : undefined,
    placement,
    flexiblePlacement: flexiblePlacement || undefined,
    shape: edit.shape === null ? fitShape(product.shape, width, depth) : edit.shape === 'rect' ? undefined : { kind: 'round' },
    metadata: resized ? { ...product.metadata, dimensionsSource: 'user' } : product.metadata,
  });
}

const sameShape = (a: Shape | undefined, b: Shape | undefined) => JSON.stringify(a ?? { kind: 'rect' }) === JSON.stringify(b ?? { kind: 'rect' });

/**
 * A placed copy of `previous` after the product was edited into `next`. Only what changed
 * between the two is applied, so a copy's own changes elsewhere (a different height, its own
 * name, a color) are kept. Returns the item itself when nothing changes.
 */
export function applyProductEdit(item: FurnitureItem, previous: FurnitureProduct, next: FurnitureProduct): FurnitureItem {
  const out: FurnitureItem = { ...item, product: toProductRef(next) };
  if (productTitle(next) !== productTitle(previous) && item.name === productTitle(previous)) out.name = productTitle(next);
  if (next.width !== previous.width || next.depth !== previous.depth || !sameShape(next.shape, previous.shape)) {
    out.width = next.width;
    out.depth = next.depth;
    out.shape = fitShape(next.shape, next.width, next.depth) ?? { kind: 'rect' };
  }
  if (next.height !== previous.height) out.height = next.height;
  if (next.category !== previous.category) {
    out.category = itemCategoryFor(next.category);
    // Like a category change in the inspector: an item in its category's color follows it.
    if (item.color === CATEGORIES[item.category].color) out.color = next.defaultColor ?? CATEGORIES[out.category].color;
  }
  if (next.kind !== previous.kind) out.type = next.kind;
  const standsOn = productStandsOn(next);
  if (standsOn !== productStandsOn(previous)) {
    Object.assign(out, applyStandsOn(standsOn, item.placement));
    if (out.placement === 'floor') out.attachedTo = null;
  }
  return JSON.stringify(out) === JSON.stringify(item) ? item : out;
}
