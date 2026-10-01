import type { Category } from '../types';

export interface CategoryInfo {
  label: string;
  color: string;
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  desk: { label: 'Desk & table', color: '#dccaa9' },
  seating: { label: 'Seating', color: '#b7c6dd' },
  storage: { label: 'Storage', color: '#c4d4bd' },
  bed: { label: 'Bed & sofa', color: '#d8c9df' },
  kitchen: { label: 'Kitchen', color: '#e7b9a3' },
  bathroom: { label: 'Bathroom', color: '#a9cbcf' },
  electronics: { label: 'Electronics', color: '#4a505c' },
  other: { label: 'Other', color: '#d6d6db' },
};

export const CATEGORY_ORDER: readonly Category[] = ['desk', 'seating', 'storage', 'bed', 'kitchen', 'bathroom', 'electronics', 'other'];

/** Swatches offered in the inspector (category colors first). */
export const COLOR_SWATCHES: readonly string[] = [
  ...CATEGORY_ORDER.map((c) => CATEGORIES[c].color),
  '#e8d892',
  '#f4f4f5',
  '#262a31',
];
