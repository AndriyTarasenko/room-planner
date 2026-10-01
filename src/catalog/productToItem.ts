import { CATEGORIES } from '../furniture/categories';
import { EMPTY_CLEARANCE } from '../furniture/factory';
import { presetForType } from '../furniture/presets';
import type { Point } from '../geometry/rect';
import type { FurnitureItem, ProductRef } from '../types';
import { isHexColor } from '../utils/color';
import { createId } from '../utils/id';
import { itemCategoryFor } from './categories';
import { productTitle } from './format';
import { type FurnitureProduct, GENERIC_MANUFACTURER } from './types';

/** The product details a placed item keeps (a copy, not a live link to the catalog). */
export function toProductRef(product: FurnitureProduct): ProductRef {
  const ref: ProductRef = { catalogId: product.id, manufacturer: product.manufacturer, productName: product.productName };
  if (product.productFamily) ref.productFamily = product.productFamily;
  if (product.productType) ref.productType = product.productType;
  if (product.variant) ref.variant = product.variant;
  if (product.articleNumber) ref.articleNumber = product.articleNumber;
  if (product.productUrl) ref.productUrl = product.productUrl;
  if (product.source) ref.source = product.source;
  if (product.sourceLastVerified) ref.sourceLastVerified = product.sourceLastVerified;
  return ref;
}

/**
 * Creates a room item from a catalog product. Everything the planner needs (geometry, name,
 * behavior, manufacturer details) is copied, so the item stays intact when the catalog entry
 * changes or disappears. Planner defaults the product doesn't specify (chair rotation,
 * wardrobe door clearance…) come from the generic preset of the same kind.
 */
export function productToItem(product: FurnitureProduct, position: Point): FurnitureItem {
  const defaults = presetForType(product.kind);
  const category = itemCategoryFor(product.category);
  const item: FurnitureItem = {
    id: createId('item'),
    type: product.kind,
    name: productTitle(product),
    x: position.x,
    y: position.y,
    width: product.width,
    depth: product.depth,
    height: product.height,
    rotation: product.rotation ?? defaults.rotation ?? 0,
    category,
    color: isHexColor(product.defaultColor) ? product.defaultColor : CATEGORIES[category].color,
    notes: '',
    placement: product.placement ?? defaults.placement,
    ignoreCollisions: false,
    clearance: { ...EMPTY_CLEARANCE, ...(product.clearance ?? defaults.clearance) },
    shape: product.shape ?? { kind: 'rect' },
    attachedTo: null,
    showDeskGuides: false,
  };
  // Generic furniture is fully described by its kind; only real products carry a reference.
  if (product.manufacturer !== GENERIC_MANUFACTURER) item.product = toProductRef(product);
  return item;
}
