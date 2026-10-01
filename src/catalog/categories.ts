import type { Category, FurnitureType } from '../types';
import type { CatalogCategory } from './types';

export const CATALOG_CATEGORIES: Record<CatalogCategory, { label: string; plural: string }> = {
  desk: { label: 'Desk', plural: 'Desks' },
  chair: { label: 'Chair', plural: 'Chairs' },
  storage: { label: 'Storage', plural: 'Storage' },
  bed: { label: 'Bed', plural: 'Beds' },
  sofa: { label: 'Sofa', plural: 'Sofas' },
  table: { label: 'Table', plural: 'Tables' },
  kitchen: { label: 'Kitchen', plural: 'Kitchen' },
  bathroom: { label: 'Bathroom', plural: 'Bathroom' },
  electronics: { label: 'Electronics', plural: 'Electronics' },
  other: { label: 'Other', plural: 'Other' },
};

export const CATALOG_CATEGORY_ORDER: readonly CatalogCategory[] = [
  'desk',
  'chair',
  'storage',
  'bed',
  'sofa',
  'table',
  'kitchen',
  'bathroom',
  'electronics',
  'other',
];

/** Color category of placed items (the planner's own, coarser grouping). */
const ITEM_CATEGORY: Record<CatalogCategory, Category> = {
  desk: 'desk',
  chair: 'seating',
  storage: 'storage',
  bed: 'bed',
  sofa: 'bed',
  table: 'desk',
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  electronics: 'electronics',
  other: 'other',
};

export const itemCategoryFor = (category: CatalogCategory): Category => ITEM_CATEGORY[category];

const FROM_ITEM_CATEGORY: Record<Category, CatalogCategory> = {
  desk: 'desk',
  seating: 'chair',
  storage: 'storage',
  bed: 'bed',
  kitchen: 'kitchen',
  bathroom: 'bathroom',
  electronics: 'electronics',
  other: 'other',
};

export const catalogCategoryForItemCategory = (category: Category): CatalogCategory => FROM_ITEM_CATEGORY[category];

const FROM_TYPE: Record<FurnitureType, CatalogCategory> = {
  desk: 'desk',
  'sit-stand-desk': 'desk',
  'l-desk': 'desk',
  'office-chair': 'chair',
  chair: 'chair',
  armchair: 'chair',
  pouf: 'chair',
  sofa: 'sofa',
  sideboard: 'storage',
  shelf: 'storage',
  wardrobe: 'storage',
  bed: 'bed',
  table: 'table',
  'kitchen-cabinet': 'kitchen',
  sink: 'kitchen',
  stove: 'kitchen',
  appliance: 'kitchen',
  toilet: 'bathroom',
  washbasin: 'bathroom',
  shower: 'bathroom',
  bathtub: 'bathroom',
  washer: 'bathroom',
  tv: 'electronics',
  monitor: 'electronics',
  'pc-tower': 'electronics',
  console: 'electronics',
  plant: 'other',
  generic: 'other',
};

export const catalogCategoryForType = (type: FurnitureType): CatalogCategory => FROM_TYPE[type];

/** Kind used for a product when only its category is known (e.g. after the user changes it). */
export const DEFAULT_KIND: Record<CatalogCategory, FurnitureType> = {
  desk: 'desk',
  chair: 'office-chair',
  storage: 'sideboard',
  bed: 'bed',
  sofa: 'sofa',
  table: 'table',
  kitchen: 'kitchen-cabinet',
  bathroom: 'generic',
  electronics: 'generic',
  other: 'generic',
};
