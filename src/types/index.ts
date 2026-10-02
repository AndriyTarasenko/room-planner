/**
 * Domain model. All lengths are centimeters, all angles are degrees
 * (clockwise, matching the y-down screen coordinate system).
 */

/** What kind of object an item is: drives its top-down drawing and rules like "monitors go on desks". */
export type FurnitureType =
  | 'desk'
  | 'sit-stand-desk'
  | 'l-desk'
  | 'office-chair'
  | 'chair'
  | 'armchair'
  | 'pouf'
  | 'sofa'
  | 'sideboard'
  | 'shelf'
  | 'wardrobe'
  | 'bed'
  | 'table'
  | 'kitchen-cabinet'
  | 'sink'
  | 'stove'
  | 'appliance'
  | 'toilet'
  | 'washbasin'
  | 'shower'
  | 'bathtub'
  | 'washer'
  | 'tv'
  | 'monitor'
  | 'pc-tower'
  | 'console'
  | 'plant'
  | 'generic';

export const FURNITURE_TYPES: readonly FurnitureType[] = [
  'desk',
  'sit-stand-desk',
  'l-desk',
  'office-chair',
  'chair',
  'armchair',
  'pouf',
  'sofa',
  'sideboard',
  'shelf',
  'wardrobe',
  'bed',
  'table',
  'kitchen-cabinet',
  'sink',
  'stove',
  'appliance',
  'toilet',
  'washbasin',
  'shower',
  'bathtub',
  'washer',
  'tv',
  'monitor',
  'pc-tower',
  'console',
  'plant',
  'generic',
];

export type Category = 'desk' | 'seating' | 'storage' | 'bed' | 'kitchen' | 'bathroom' | 'electronics' | 'other';

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
  /**
   * L-shaped footprint: a main part of depth `segment` along the back edge plus a return leg
   * `returnWidth` wide down one side. The two arms are sized separately.
   */
  | { kind: 'l'; segment: number; returnWidth: number; returnSide: 'left' | 'right' }
  /** Round or oval: the ellipse that fills width × depth, a circle when both are equal. */
  | { kind: 'round' };

export interface FurnitureItem {
  id: string;
  type: FurnitureType;
  name: string;
  /** Center of the footprint in plan coordinates (the first room's inner top-left corner is 0, 0 by default). */
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
  /**
   * The catalog product this item was created from, copied at placement time. Purely
   * informational: geometry lives in the fields above, so the item never needs the catalog.
   */
  product?: ProductRef;
}

/** Product details carried by a placed item (manufacturer products only). */
export interface ProductRef {
  /** Catalog id at the time of placement, for reference only. */
  catalogId: string;
  manufacturer: string;
  productName: string;
  productFamily?: string;
  productType?: string;
  variant?: string;
  articleNumber?: string;
  productUrl?: string;
  /** Where the dimensions came from (URL or short description). */
  source?: string;
  /** YYYY-MM-DD */
  sourceLastVerified?: string;
}

/** A point of the floor plan, in centimeters. */
export interface PlanPoint {
  x: number;
  y: number;
}

/**
 * One wall of a room: the edge between two corners. `open` walls aren't built: the railing
 * side of a balcony, or the seam between two rooms that form one open-plan space. The
 * thickness is kept so a wall can be switched back on.
 */
export interface Wall {
  kind: 'wall' | 'open';
  /** Drawn outside the room's interior, so interior sizes stay exact. */
  thickness: number;
}

/** `passage` is a doorless opening, like an archway into the kitchen. */
export type OpeningKind = 'door' | 'window' | 'passage';
export const OPENING_KINDS: readonly OpeningKind[] = ['door', 'window', 'passage'];

/** A door, window or passage in one wall of a room. */
export interface Opening {
  id: string;
  kind: OpeningKind;
  /** Index of the wall it is in (see `Room.corners`). */
  wall: number;
  /** Distance from the wall's start corner to the opening, along the interior face. */
  offset: number;
  width: number;
  /** Doors only: which end of the opening the hinge is at. Kept for other kinds so switching back restores it. */
  hinge: 'start' | 'end';
  /** Doors only: swings into this room or away from it. */
  swing: 'in' | 'out';
}

/**
 * A room of the floor plan: any simple polygon, most often a rectangle. Corners are the
 * interior (floor) corners in plan coordinates, clockwise on screen. Wall `i` runs from
 * corner `i` to corner `i + 1`, the last one back to the first, and sits outside the
 * interior, so interior sizes stay exact.
 */
export interface Room {
  id: string;
  name: string;
  corners: PlanPoint[];
  /** One per corner: `walls[i]` is the wall starting at `corners[i]`. */
  walls: Wall[];
  openings: Opening[];
}

/**
 * The rooms, walls, doors and windows a layout's furniture stands in. Several layouts can
 * share one floor plan, so a wall fixed once is fixed in all of them; a layout with its own
 * copy can try out a different plan without touching the others.
 */
export interface FloorPlan {
  id: string;
  rooms: Room[];
}

export interface Layout {
  id: string;
  name: string;
  /** The floor plan this layout is arranged in. */
  planId: string;
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

/**
 * The undoable part of the application state. Every layout points to one of the floor plans;
 * furniture is stored in plan coordinates.
 */
export interface ProjectDocument {
  plans: FloorPlan[];
  layouts: Layout[];
  activeLayoutId: string;
}

export interface ProjectData extends ProjectDocument {
  settings: Settings;
}

export const PROJECT_FILE_FORMAT = 'room-planner-project';
/**
 * Version of the project file and localStorage schema.
 * 1: initial format (stored as `version`).
 * 2: `schemaVersion` field, optional `product` on furniture items, `table` furniture type.
 * 3: `room` became `rooms`, each with a name, position, walls and openings (doors, windows).
 * 4: rooms became polygons: `corners` and a list of `walls` replace position, size and the
 *    four named sides; openings refer to a wall by index.
 * 5: `rooms` moved into `plans`, a list of floor plans; each layout names its plan in `planId`.
 */
export const PROJECT_SCHEMA_VERSION = 5;

/** Shape of exported JSON files. */
export interface ProjectFile extends ProjectData {
  format: typeof PROJECT_FILE_FORMAT;
  schemaVersion: number;
  exportedAt: string;
}
