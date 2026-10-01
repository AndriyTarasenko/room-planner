/**
 * Import/export and localStorage payload validation. Input is treated as untrusted:
 * every field is checked, clamped or replaced by a sensible default, so a hand-edited
 * or older file still loads instead of crashing the editor.
 */
import { parseProductRef } from '../catalog/validation';
import { CATEGORIES } from '../furniture/categories';
import { EMPTY_CLEARANCE } from '../furniture/factory';
import { presetForType } from '../furniture/presets';
import { boxOfPoints, normalizeAngle } from '../geometry/rect';
import { OPENING_DEFAULTS, OPENING_LIMITS, clampOpening } from '../plan/openings';
import { MAX_CORNERS, isValidOutline, normalizeRoom, rectCorners } from '../plan/shape';
import { DEFAULT_WALL_THICKNESS, WALL_LIMITS, defaultWall, defaultWalls } from '../plan/walls';
import {
  type Category,
  type Clearance,
  FURNITURE_TYPES,
  type FurnitureItem,
  GRID_SIZES,
  type GridSize,
  type Layout,
  OPENING_KINDS,
  type Opening,
  PROJECT_FILE_FORMAT,
  PROJECT_SCHEMA_VERSION,
  type ProjectData,
  type ProjectFile,
  type PlanPoint,
  type Room,
  type Settings,
  type Shape,
  type Wall,
} from '../types';
import { isHexColor } from '../utils/color';
import { createId } from '../utils/id';
import { type Json, bool, isObject, num, oneOf, str } from '../utils/validate';
import { DEFAULT_SETTINGS, ITEM_LIMITS, POSITION_LIMIT, ROOM_LIMITS } from './defaults';

export class ProjectFileError extends Error {}

export function toProjectFile(data: ProjectData): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    rooms: data.rooms,
    layouts: data.layouts,
    activeLayoutId: data.activeLayoutId,
    settings: data.settings,
  };
}

export function serializeProject(data: ProjectData): string {
  return JSON.stringify(toProjectFile(data), null, 2);
}

/** Parses JSON text from an exported file. Throws ProjectFileError with a readable message. */
export function parseProjectJson(text: string): ProjectData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProjectFileError('The file is not valid JSON.');
  }
  return parseProjectData(raw);
}

/** Schema version of raw project data: `schemaVersion` since v2, `version` in v1 files, 1 when neither is set. */
export function schemaVersionOf(raw: Json): number {
  if (typeof raw.schemaVersion === 'number') return raw.schemaVersion;
  if (typeof raw.version === 'number') return raw.version;
  return 1;
}

/**
 * Upgrades raw project JSON one schema version at a time. Steps only reshape data;
 * parseProjectData validates the result afterwards like any other input.
 */
export function migrateProject(raw: Json): Json {
  let data = raw;
  const from = schemaVersionOf(raw);
  if (from > PROJECT_SCHEMA_VERSION) throw new ProjectFileError('This project was created by a newer version of Room Planner.');
  if (from < 2) {
    // v1 → v2: `version` became `schemaVersion`. Furniture gained an optional `product`
    // and the `table` type; existing v1 furniture is valid v2 furniture as it is.
    const { version: _v1, ...rest } = data;
    data = { ...rest, schemaVersion: 2 };
  }
  if (from < 3) {
    // v2 → v3: the single `room` became the first entry of `rooms`, at the plan origin.
    // Furniture coordinates were already relative to that corner, so they stay as they are.
    const { room, ...rest } = data;
    data = { ...rest, schemaVersion: 3, ...(isObject(room) ? { rooms: [{ ...room, name: 'Room 1', x: 0, y: 0 }] } : {}) };
  }
  if (from < 4) {
    // v3 → v4: rectangles became polygons.
    data = { ...data, schemaVersion: 4, ...(Array.isArray(data.rooms) ? { rooms: data.rooms.map((r) => (isObject(r) ? migrateRectRoom(r) : r)) } : {}) };
  }
  return data;
}

const V3_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * A v3 room (position, size, four named sides) as a v4 polygon. Corners run clockwise from
 * the inner top-left, so the walls are top, right, bottom, left. Bottom and left walls now
 * run right to left and bottom to top, so openings on them are measured from the other end
 * (and their hinge side is named the other way round); they stay where they were.
 */
function migrateRectRoom(raw: Json): Json {
  const { x: rawX, y: rawY, width: rawWidth, depth: rawDepth, walls: rawWalls, openings: rawOpenings, ...rest } = raw;
  const x = num(rawX, 0, -POSITION_LIMIT, POSITION_LIMIT);
  const y = num(rawY, 0, -POSITION_LIMIT, POSITION_LIMIT);
  const width = num(rawWidth, 380, ROOM_LIMITS.min, ROOM_LIMITS.max);
  const depth = num(rawDepth, 320, ROOM_LIMITS.min, ROOM_LIMITS.max);
  const walls = V3_SIDES.map((side) => (isObject(rawWalls) ? rawWalls[side] : undefined));
  const openings = (Array.isArray(rawOpenings) ? rawOpenings.filter(isObject) : []).map((o) => {
    const { side, ...opening } = o;
    const wall = Math.max(0, V3_SIDES.indexOf(oneOf(side, V3_SIDES, 'top')));
    if (wall < 2) return { ...opening, wall };
    // Clamp as v3 did, so the flipped offset lands on the same spot.
    const length = wall === 2 ? width : depth;
    const kind = oneOf(o.kind, OPENING_KINDS, 'door');
    const w = Math.min(Math.max(num(o.width, OPENING_DEFAULTS[kind].width, OPENING_LIMITS.min, OPENING_LIMITS.max), Math.min(OPENING_LIMITS.min, length)), length);
    const offset = Math.min(Math.max(0, num(o.offset, 0, 0, POSITION_LIMIT)), length - w);
    const hinge = oneOf(o.hinge, ['start', 'end'] as const, 'start') === 'start' ? 'end' : 'start';
    return { ...opening, wall, width: w, offset: Math.round((length - offset - w) * 10) / 10, hinge };
  });
  return { ...rest, corners: rectCorners(x, y, width, depth), walls, openings };
}

export function parseProjectData(input: unknown): ProjectData {
  if (!isObject(input)) throw new ProjectFileError('The file does not contain a project.');
  if (input.format !== undefined && input.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('This JSON file is not a Room Planner project.');
  }
  const raw = migrateProject(input);
  const roomsRaw = Array.isArray(raw.rooms) ? raw.rooms.filter(isObject) : [];
  if (roomsRaw.length === 0) throw new ProjectFileError('The project has no rooms.');
  if (!Array.isArray(raw.layouts) || raw.layouts.length === 0) throw new ProjectFileError('The project has no layouts.');

  // Rooms, openings and furniture share one selection, so their ids must not collide.
  const planIds = new Set<string>();
  const unique = (id: string, prefix: string) => {
    const result = planIds.has(id) ? createId(prefix) : id;
    planIds.add(result);
    return result;
  };
  const rooms = roomsRaw.map((r, i) => {
    const room = parseRoom(r, i);
    room.id = unique(room.id, 'room');
    for (const o of room.openings) o.id = unique(o.id, 'opening');
    return room;
  });
  const layouts = dedupeLayoutIds(raw.layouts.map((l, i) => parseLayout(l, i, planIds)));
  const activeLayoutId =
    typeof raw.activeLayoutId === 'string' && layouts.some((l) => l.id === raw.activeLayoutId)
      ? raw.activeLayoutId
      : layouts[0].id;
  return { rooms, layouts, activeLayoutId, settings: parseSettings(raw.settings) };
}

/**
 * A room from untrusted data. Corners are brought into clockwise order; an outline that
 * isn't a usable room (walls crossing, too few corners) is replaced by its bounding rectangle
 * without doors and windows, so the project still loads.
 */
function parseRoom(raw: Json, index: number): Room {
  const id = str(raw.id, '', 100) || createId('room');
  const name = str(raw.name, '', 80).trim() || `Room ${index + 1}`;
  const cornersRaw = Array.isArray(raw.corners) ? raw.corners.filter(isObject).slice(0, MAX_CORNERS) : [];
  const corners: PlanPoint[] = cornersRaw
    .map((c) => ({ x: num(c.x, NaN, -POSITION_LIMIT, POSITION_LIMIT), y: num(c.y, NaN, -POSITION_LIMIT, POSITION_LIMIT) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const wallsRaw = Array.isArray(raw.walls) ? raw.walls : [];
  const openingsRaw = Array.isArray(raw.openings) ? raw.openings.filter(isObject) : [];
  let room = normalizeRoom({
    id,
    name,
    corners,
    walls: corners.map((_, i) => parseWall(wallsRaw[i])),
    openings: corners.length === cornersRaw.length ? openingsRaw.map(parseOpening) : [],
  });
  if (!isValidOutline(room.corners)) {
    const b = corners.length > 0 ? boxOfPoints(corners) : { minX: 0, minY: 0, maxX: 380, maxY: 320 };
    const size = (v: number, fallback: number) => num(Number.isFinite(v) && v > 0 ? v : fallback, fallback, ROOM_LIMITS.min, ROOM_LIMITS.max);
    room = { id, name, corners: rectCorners(b.minX, b.minY, size(b.maxX - b.minX, 380), size(b.maxY - b.minY, 320)), walls: defaultWalls(), openings: [] };
  }
  const fitted = room;
  return { ...fitted, openings: fitted.openings.map((o) => clampOpening(o, fitted)) };
}

function parseWall(raw: unknown): Wall {
  if (!isObject(raw)) return defaultWall();
  return {
    kind: oneOf(raw.kind, ['wall', 'open'] as const, 'wall'),
    thickness: num(raw.thickness, DEFAULT_WALL_THICKNESS, WALL_LIMITS.min, WALL_LIMITS.max),
  };
}

function parseOpening(raw: Json): Opening {
  const kind = oneOf(raw.kind, OPENING_KINDS, 'door');
  return {
    id: str(raw.id, '', 100) || createId('opening'),
    kind,
    wall: Math.round(num(raw.wall, 0, 0, MAX_CORNERS - 1)),
    offset: num(raw.offset, 0, 0, POSITION_LIMIT),
    width: num(raw.width, OPENING_DEFAULTS[kind].width, OPENING_LIMITS.min, OPENING_LIMITS.max),
    hinge: oneOf(raw.hinge, ['start', 'end'] as const, 'start'),
    swing: oneOf(raw.swing, ['in', 'out'] as const, 'in'),
  };
}

function parseLayout(raw: unknown, index: number, reservedIds: ReadonlySet<string>): Layout {
  if (!isObject(raw)) throw new ProjectFileError(`Layout ${index + 1} is invalid.`);
  const furnitureRaw = Array.isArray(raw.furniture) ? raw.furniture : [];
  const furniture = furnitureRaw.filter(isObject).map(parseFurniture);
  // Ids must be unique inside a layout and differ from room and opening ids;
  // attachments to missing items are dropped.
  const seen = new Set<string>();
  for (const item of furniture) {
    if (seen.has(item.id) || reservedIds.has(item.id)) item.id = createId('item');
    seen.add(item.id);
  }
  for (const item of furniture) {
    if (item.attachedTo && (!seen.has(item.attachedTo) || item.attachedTo === item.id)) item.attachedTo = null;
  }
  return {
    id: str(raw.id, '', 100) || createId('layout'),
    name: str(raw.name, '', 80).trim() || `Layout ${index + 1}`,
    furniture,
  };
}

function dedupeLayoutIds(layouts: Layout[]): Layout[] {
  const seen = new Set<string>();
  return layouts.map((l) => {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      return l;
    }
    const id = createId('layout');
    seen.add(id);
    return { ...l, id };
  });
}

function parseFurniture(raw: Json): FurnitureItem {
  const type = oneOf(raw.type, FURNITURE_TYPES, 'generic');
  const preset = presetForType(type);
  const category = oneOf<Category>(raw.category, Object.keys(CATEGORIES) as Category[], preset.category);
  const width = num(raw.width, preset.width, ITEM_LIMITS.min, ITEM_LIMITS.max);
  const depth = num(raw.depth, preset.depth, ITEM_LIMITS.min, ITEM_LIMITS.max);
  const item: FurnitureItem = {
    id: str(raw.id, '', 100) || createId('item'),
    type,
    name: str(raw.name, preset.name, 120),
    x: num(raw.x, 0, -100_000, 100_000),
    y: num(raw.y, 0, -100_000, 100_000),
    width,
    depth,
    height: num(raw.height, preset.height, 0, ITEM_LIMITS.max),
    rotation: normalizeAngle(num(raw.rotation, 0)),
    category,
    color: isHexColor(raw.color) ? raw.color : CATEGORIES[category].color,
    notes: str(raw.notes, '', 5000),
    placement: oneOf(raw.placement, ['floor', 'surface'] as const, preset.placement),
    ignoreCollisions: bool(raw.ignoreCollisions, false),
    clearance: parseClearance(raw.clearance),
    shape: parseShape(raw.shape, width, depth),
    attachedTo: typeof raw.attachedTo === 'string' ? raw.attachedTo : null,
    showDeskGuides: bool(raw.showDeskGuides, false),
  };
  const product = parseProductRef(raw.product);
  if (product) item.product = product;
  return item;
}

function parseClearance(raw: unknown): Clearance {
  if (!isObject(raw)) return { ...EMPTY_CLEARANCE };
  const side = (v: unknown) => num(v, 0, 0, 1000);
  return {
    enabled: bool(raw.enabled, false),
    front: side(raw.front),
    back: side(raw.back),
    left: side(raw.left),
    right: side(raw.right),
  };
}

function parseShape(raw: unknown, width: number, depth: number): Shape {
  if (isObject(raw) && raw.kind === 'round') return { kind: 'round' };
  if (isObject(raw) && raw.kind === 'l') {
    return {
      kind: 'l',
      segment: num(raw.segment, Math.min(60, depth / 2), 1, Math.max(1, Math.min(width, depth) - 1)),
      returnSide: oneOf(raw.returnSide, ['left', 'right'] as const, 'right'),
    };
  }
  return { kind: 'rect' };
}

export function parseSettings(raw: unknown): Settings {
  if (!isObject(raw)) return { ...DEFAULT_SETTINGS };
  const d = DEFAULT_SETTINGS;
  const gridSize = num(raw.gridSize, d.gridSize);
  return {
    gridVisible: bool(raw.gridVisible, d.gridVisible),
    snapToGrid: bool(raw.snapToGrid, d.snapToGrid),
    gridSize: (GRID_SIZES as readonly number[]).includes(gridSize) ? (gridSize as GridSize) : d.gridSize,
    snapToWalls: bool(raw.snapToWalls, d.snapToWalls),
    snapToFurniture: bool(raw.snapToFurniture, d.snapToFurniture),
    constrainToRoom: bool(raw.constrainToRoom, d.constrainToRoom),
    showClearances: bool(raw.showClearances, d.showClearances),
    showMeasurements: bool(raw.showMeasurements, d.showMeasurements),
  };
}
