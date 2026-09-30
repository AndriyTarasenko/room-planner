import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  gridVisible: true,
  snapToGrid: false,
  gridSize: 10,
  snapToWalls: true,
  snapToFurniture: true,
  constrainToRoom: true,
  showClearances: true,
  showMeasurements: true,
};

export const ROOM_LIMITS = { min: 50, max: 5000 } as const;
export const ITEM_LIMITS = { min: 1, max: 2000 } as const;
