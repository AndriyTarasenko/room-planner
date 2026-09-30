/**
 * Domain model. All lengths are centimeters, all angles are degrees
 * (clockwise, matching the y-down screen coordinate system).
 */

export type FurnitureType =
  | 'desk'
  | 'sit-stand-desk'
  | 'l-desk'
  | 'office-chair'
  | 'sofa'
  | 'sideboard'
  | 'shelf'
  | 'wardrobe'
  | 'bed'
  | 'monitor'
  | 'pc-tower'
  | 'console'
  | 'generic';

export type Category = 'desk' | 'seating' | 'storage' | 'bed' | 'electronics' | 'other';

/**
 * `floor` items stand on the floor and collide with each other.
 * `surface` items (monitors, consoles) sit on top of other furniture and only
 * collide with other surface items.
 */
export type Placement = 'floor' | 'surface';

/**
 * Free space an object needs around it (chair roll-back, wardrobe doors…).
 * Sides are in the object's local frame: at rotation 0 "front" faces down (+y).
 */
export interface Clearance {
  enabled: boolean;
  front: number;
  back: number;
  left: number;
  right: number;
}

export type Shape =
  | { kind: 'rect' }
  /** L-shaped footprint: a main top of depth `segment` along the back edge plus a return leg. */
  | { kind: 'l'; segment: number; returnSide: 'left' | 'right' };

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  name: string;
  /** Center of the footprint in room coordinates (origin = inner top-left corner). */
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  rotation: number;
  category: Category;
  color: string;
  notes: string;
  placement: Placement;
  /** Skip collision warnings for this item (e.g. PC tower tucked under a desk). */
  ignoreCollisions: boolean;
  clearance: Clearance;
  shape: Shape;
  /** Loose "group with" link: the item follows its parent when the parent moves or rotates. */
  attachedTo: string | null;
  /** Desk-only: show chair / monitor / reach guides. */
  showDeskGuides: boolean;
}

export interface Room {
  id: string;
  width: number;
  depth: number;
}

export interface Layout {
  id: string;
  name: string;
  furniture: FurnitureItem[];
}

export type GridSize = 5 | 10 | 25 | 50;
export const GRID_SIZES: readonly GridSize[] = [5, 10, 25, 50];

export interface Settings {
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: GridSize;
  snapToWalls: boolean;
  snapToFurniture: boolean;
  constrainToRoom: boolean;
  showClearances: boolean;
  showMeasurements: boolean;
}

/** The undoable part of the application state. */
export interface ProjectDocument {
  room: Room;
  layouts: Layout[];
  activeLayoutId: string;
}

export interface ProjectData extends ProjectDocument {
  settings: Settings;
}

export const PROJECT_FILE_FORMAT = 'room-planner-project';
export const PROJECT_FILE_VERSION = 1;

/** Shape of exported JSON files. */
export interface ProjectFile extends ProjectData {
  format: typeof PROJECT_FILE_FORMAT;
  version: number;
  exportedAt: string;
}
