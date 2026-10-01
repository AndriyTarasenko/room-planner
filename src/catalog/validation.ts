/**
 * Validation for catalog data that comes from outside the code: the personal catalog in
 * localStorage and product references inside imported project files. Invalid products are
 * rejected rather than repaired, because a guessed dimension is worse than no product.
 */
import { normalizeAngle } from '../geometry/rect';
import { ITEM_LIMITS } from '../store/defaults';
import { isHexColor } from '../utils/color';
import { type Clearance, FURNITURE_TYPES, type ProductRef, type Shape } from '../types';
import { type Json, isObject, isoDate, num, oneOf, optionalStr, safeHttpUrl } from '../utils/validate';
import { CATALOG_CATEGORY_ORDER, DEFAULT_KIND } from './categories';
import type { CatalogOrigin, FurnitureProduct, ProductMetadata } from './types';

function dimension(v: unknown, min: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= ITEM_LIMITS.max ? v : null;
}

function parseMetadata(raw: unknown): ProductMetadata | undefined {
  if (!isObject(raw)) return undefined;
  const out: ProductMetadata = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= 30 || key.length > 60) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 500);
    else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) out[key] = value;
    else continue;
    count++;
  }
  return count > 0 ? out : undefined;
}

function parseClearance(raw: unknown): Partial<Clearance> | undefined {
  if (!isObject(raw)) return undefined;
  const out: Partial<Clearance> = {};
  if (typeof raw.enabled === 'boolean') out.enabled = raw.enabled;
  for (const side of ['front', 'back', 'left', 'right'] as const) {
    if (typeof raw[side] === 'number' && Number.isFinite(raw[side])) out[side] = num(raw[side], 0, 0, 1000);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseShape(raw: unknown, width: number, depth: number): Shape | undefined {
  if (!isObject(raw)) return undefined;
  if (raw.kind === 'rect') return { kind: 'rect' };
  if (raw.kind === 'round') return { kind: 'round' };
  if (raw.kind !== 'l') return undefined;
  // Files from before the arms were sized separately have one `segment` for both.
  const segment = num(raw.segment, Math.min(60, depth / 2), 1, Math.max(1, depth - 1));
  return {
    kind: 'l',
    segment,
    returnWidth: num(raw.returnWidth, Math.min(segment, width - 1), 1, Math.max(1, width - 1)),
    returnSide: oneOf(raw.returnSide, ['left', 'right'] as const, 'right'),
  };
}

/** Reads a stored product; returns null when anything essential (id, name, dimensions) is missing. */
export function parseProduct(raw: unknown, origin: CatalogOrigin): FurnitureProduct | null {
  if (!isObject(raw)) return null;
  const id = optionalStr(raw.id, 120);
  const manufacturer = optionalStr(raw.manufacturer, 60);
  const productName = optionalStr(raw.productName, 120);
  const width = dimension(raw.width, ITEM_LIMITS.min);
  const depth = dimension(raw.depth, ITEM_LIMITS.min);
  const height = dimension(raw.height, 0);
  if (!id || !manufacturer || !productName || width === null || depth === null || height === null) return null;

  const category = oneOf(raw.category, CATALOG_CATEGORY_ORDER, 'other');
  const heightMax = dimension(raw.heightMax, 0);
  const product: FurnitureProduct = {
    id,
    manufacturer,
    productName,
    category,
    kind: oneOf(raw.kind, FURNITURE_TYPES, DEFAULT_KIND[category]),
    width,
    depth,
    height,
    origin,
  };
  const optional: Partial<FurnitureProduct> = {
    productFamily: optionalStr(raw.productFamily, 120),
    productType: optionalStr(raw.productType, 120),
    variant: optionalStr(raw.variant, 120),
    heightMax: heightMax !== null && heightMax > height ? heightMax : undefined,
    placement: raw.placement === 'floor' || raw.placement === 'surface' ? raw.placement : undefined,
    rotation: typeof raw.rotation === 'number' && Number.isFinite(raw.rotation) ? normalizeAngle(raw.rotation) : undefined,
    clearance: parseClearance(raw.clearance),
    shape: parseShape(raw.shape, width, depth),
    defaultColor: isHexColor(raw.defaultColor) ? raw.defaultColor : undefined,
    articleNumber: optionalStr(raw.articleNumber, 40),
    productUrl: safeHttpUrl(raw.productUrl),
    imageUrl: safeHttpUrl(raw.imageUrl),
    source: optionalStr(raw.source, 500),
    sourceLastVerified: isoDate(raw.sourceLastVerified),
    metadata: parseMetadata(raw.metadata),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) (product as unknown as Json)[key] = value;
  }
  return product;
}

/** Reads the `product` field of a placed item; undefined when absent or unusable. */
export function parseProductRef(raw: unknown): ProductRef | undefined {
  if (!isObject(raw)) return undefined;
  const catalogId = optionalStr(raw.catalogId, 120);
  const manufacturer = optionalStr(raw.manufacturer, 60);
  const productName = optionalStr(raw.productName, 120);
  if (!catalogId || !manufacturer || !productName) return undefined;
  const ref: ProductRef = { catalogId, manufacturer, productName };
  const optional: Partial<ProductRef> = {
    productFamily: optionalStr(raw.productFamily, 120),
    productType: optionalStr(raw.productType, 120),
    variant: optionalStr(raw.variant, 120),
    articleNumber: optionalStr(raw.articleNumber, 40),
    productUrl: safeHttpUrl(raw.productUrl),
    source: optionalStr(raw.source, 500),
    sourceLastVerified: isoDate(raw.sourceLastVerified),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) (ref as unknown as Json)[key] = value;
  }
  return ref;
}
