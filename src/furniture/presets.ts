import type { Category, Clearance, FurnitureType, Placement, Shape } from '../types';

export type LibraryGroup = 'Desks' | 'Seating' | 'Storage' | 'Bedroom & living' | 'Electronics' | 'Other';

export interface FurniturePreset {
  id: string;
  group: LibraryGroup;
  /** Label in the library list. */
  label: string;
  /** Default name of placed items. */
  name: string;
  type: FurnitureType;
  category: Category;
  width: number;
  depth: number;
  height: number;
  placement: Placement;
  rotation?: number;
  clearance?: Partial<Clearance>;
  shape?: Shape;
}

export const LIBRARY_GROUPS: readonly LibraryGroup[] = ['Desks', 'Seating', 'Storage', 'Bedroom & living', 'Electronics', 'Other'];

const desk = (width: number): FurniturePreset => ({
  id: `desk-${width}`,
  group: 'Desks',
  label: 'Desk',
  name: 'Desk',
  type: 'desk',
  category: 'desk',
  width,
  depth: 80,
  height: 75,
  placement: 'floor',
  clearance: { enabled: false, front: 90 },
});

export const MONITOR_SIZES = [
  { label: '24″', inches: 24, width: 54, depth: 18, height: 42 },
  { label: '27″', inches: 27, width: 61, depth: 20, height: 46 },
  { label: '32″', inches: 32, width: 72, depth: 23, height: 53 },
] as const;

const monitor = (m: (typeof MONITOR_SIZES)[number]): FurniturePreset => ({
  id: `monitor-${m.inches}`,
  group: 'Electronics',
  label: `Monitor ${m.label}`,
  name: `Monitor ${m.label}`,
  type: 'monitor',
  category: 'electronics',
  width: m.width,
  depth: m.depth,
  height: m.height,
  placement: 'surface',
});

/** Standard desk widths for the one-click size switcher. */
export const DESK_WIDTHS = [140, 160, 180, 200] as const;

export const PRESETS: readonly FurniturePreset[] = [
  ...DESK_WIDTHS.map(desk),
  {
    id: 'sit-stand-desk',
    group: 'Desks',
    label: 'Sit-stand desk',
    name: 'Sit-stand desk',
    type: 'sit-stand-desk',
    category: 'desk',
    width: 180,
    depth: 80,
    height: 72,
    placement: 'floor',
    clearance: { enabled: false, front: 90 },
  },
  {
    id: 'l-desk',
    group: 'Desks',
    label: 'L-shaped desk',
    name: 'L-shaped desk',
    type: 'l-desk',
    category: 'desk',
    width: 160,
    depth: 120,
    height: 75,
    placement: 'floor',
    shape: { kind: 'l', segment: 60, returnSide: 'right' },
    clearance: { enabled: false, front: 90 },
  },
  {
    id: 'office-chair',
    group: 'Seating',
    label: 'Office chair',
    name: 'Office chair',
    type: 'office-chair',
    category: 'seating',
    width: 65,
    depth: 65,
    height: 115,
    placement: 'floor',
    // Rotated so the seat faces a desk placed against the top wall.
    rotation: 180,
    clearance: { enabled: true, back: 40 },
  },
  {
    id: 'sofa',
    group: 'Bedroom & living',
    label: 'Sofa',
    name: 'Sofa',
    type: 'sofa',
    category: 'bed',
    width: 200,
    depth: 90,
    height: 85,
    placement: 'floor',
    clearance: { enabled: false, front: 60 },
  },
  {
    id: 'bed',
    group: 'Bedroom & living',
    label: 'Bed',
    name: 'Bed',
    type: 'bed',
    category: 'bed',
    width: 140,
    depth: 200,
    height: 45,
    placement: 'floor',
    clearance: { enabled: false, left: 60, right: 60, front: 60 },
  },
  {
    id: 'sideboard',
    group: 'Storage',
    label: 'Sideboard',
    name: 'Sideboard',
    type: 'sideboard',
    category: 'storage',
    width: 160,
    depth: 45,
    height: 80,
    placement: 'floor',
    clearance: { enabled: false, front: 50 },
  },
  {
    id: 'shelf',
    group: 'Storage',
    label: 'Shelf',
    name: 'Shelf',
    type: 'shelf',
    category: 'storage',
    width: 80,
    depth: 35,
    height: 180,
    placement: 'floor',
    clearance: { enabled: false, front: 50 },
  },
  {
    id: 'wardrobe',
    group: 'Storage',
    label: 'Wardrobe',
    name: 'Wardrobe',
    type: 'wardrobe',
    category: 'storage',
    width: 100,
    depth: 60,
    height: 200,
    placement: 'floor',
    clearance: { enabled: true, front: 60 },
  },
  ...MONITOR_SIZES.map(monitor),
  {
    id: 'pc-tower',
    group: 'Electronics',
    label: 'PC tower',
    name: 'PC tower',
    type: 'pc-tower',
    category: 'electronics',
    width: 22,
    depth: 47,
    height: 48,
    placement: 'floor',
  },
  {
    id: 'console',
    group: 'Electronics',
    label: 'Game console',
    name: 'Game console',
    type: 'console',
    category: 'electronics',
    width: 11,
    depth: 26,
    height: 39,
    placement: 'surface',
  },
  {
    id: 'generic',
    group: 'Other',
    label: 'Rectangular object',
    name: 'Object',
    type: 'generic',
    category: 'other',
    width: 60,
    depth: 40,
    height: 50,
    placement: 'floor',
  },
];

export const TYPE_LABELS: Record<FurnitureType, string> = {
  desk: 'Desk',
  'sit-stand-desk': 'Sit-stand desk',
  'l-desk': 'L-shaped desk',
  'office-chair': 'Office chair',
  sofa: 'Sofa',
  sideboard: 'Sideboard',
  shelf: 'Shelf',
  wardrobe: 'Wardrobe',
  bed: 'Bed',
  monitor: 'Monitor',
  'pc-tower': 'PC tower',
  console: 'Game console',
  generic: 'Object',
};

export function findPreset(id: string): FurniturePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Default preset per type, used to fill in missing fields on import. */
export function presetForType(type: FurnitureType): FurniturePreset {
  return PRESETS.find((p) => p.type === type) ?? PRESETS.find((p) => p.type === 'generic')!;
}
