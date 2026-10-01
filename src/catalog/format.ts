import type { Shape } from '../types';
import { formatNumber } from '../utils/format';
import { type FurnitureProduct, GENERIC_MANUFACTURER, type ProductDimensions } from './types';

/** "ALEX Drawer unit" for manufacturer products, "Desk" for generic ones. */
export function productTitle(p: Pick<FurnitureProduct, 'productName' | 'productType'>): string {
  return p.productType ? `${p.productName} ${p.productType}` : p.productName;
}

/**
 * "36 × 58 × 70 cm" (W × D × H); adjustable heights as "160 × 80 × 62–126 cm"; round tables
 * as "Ø 90 × 75 cm" (diameter × height).
 */
export function formatDimensions(p: ProductDimensions & { heightMax?: number; shape?: Shape }): string {
  const height =
    p.heightMax !== undefined && p.heightMax > p.height ? `${formatNumber(p.height)}–${formatNumber(p.heightMax)}` : formatNumber(p.height);
  const footprint = p.shape?.kind === 'round' && p.width === p.depth ? `Ø ${formatNumber(p.width)}` : `${formatNumber(p.width)} × ${formatNumber(p.depth)}`;
  return `${footprint} × ${height} cm`;
}

/** Second line of a catalog row: "IKEA · 36 × 58 × 70 cm"; generic furniture shows only its size. */
export function productMeta(product: FurnitureProduct): string {
  const size = formatDimensions(product);
  return product.manufacturer === GENERIC_MANUFACTURER ? size : `${product.manufacturer} · ${size}`;
}
