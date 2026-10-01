import { catalogCategoryForType } from '../../catalog/categories';
import { type FurnitureProduct, GENERIC_MANUFACTURER } from '../../catalog/types';
import { PRESETS } from '../../furniture/presets';

/** Catalog id of a generic preset, e.g. `generic:desk-180`. */
export const genericProductId = (presetId: string) => `generic:${presetId}`;

/**
 * Generic furniture in typical sizes (not real products). It is built from the planner's
 * presets, which stay the single source for these sizes and per-kind defaults.
 */
export const GENERIC_PRODUCTS: readonly FurnitureProduct[] = PRESETS.map((preset) => ({
  id: genericProductId(preset.id),
  manufacturer: GENERIC_MANUFACTURER,
  productName: preset.label,
  category: catalogCategoryForType(preset.type),
  kind: preset.type,
  width: preset.width,
  depth: preset.depth,
  height: preset.height,
  placement: preset.placement,
  ...(preset.rotation !== undefined && { rotation: preset.rotation }),
  ...(preset.clearance && { clearance: preset.clearance }),
  ...(preset.shape && { shape: preset.shape }),
  ...(preset.color && { defaultColor: preset.color }),
  origin: 'built-in',
}));
