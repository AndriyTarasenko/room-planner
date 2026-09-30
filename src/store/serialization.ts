/**
 * Import/export and localStorage payload validation. Input is treated as untrusted:
 * every field is checked, clamped or replaced by a sensible default, so a hand-edited
 * or older file still loads instead of crashing the editor.
 */
import { CATEGORIES } from '../furniture/categories';
import { EMPTY_CLEARANCE } from '../furniture/factory';
import { presetForType } from '../furniture/presets';
import { normalizeAngle } from '../geometry/rect';
import {
  type Category,
  type Clearance,
  type FurnitureItem,
  type FurnitureType,
  GRID_SIZES,
  type GridSize,
  type Layout,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  type ProjectData,
  type ProjectFile,
  type Room,
  type Settings,
  type Shape,
} from '../types';
import { isHexColor } from '../utils/color';
import { createId } from '../utils/id';
import { DEFAULT_SETTINGS, ITEM_LIMITS, ROOM_LIMITS } from './defaults';

export class ProjectFileError extends Error {}

const FURNITURE_TYPES: readonly FurnitureType[] = [
  'desk',
  'sit-stand-desk',
  'l-desk',
  'office-chair',
  'sofa',
  'sideboard',
  'shelf',
  'wardrobe',
  'bed',
  'monitor',
  'pc-tower',
  'console',
  'generic',
];

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

const str = (v: unknown, fallback: string, maxLength = 2000) => (typeof v === 'string' ? v.slice(0, maxLength) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;

export function toProjectFile(data: ProjectData): ProjectFile {
  return {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    room: data.room,
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

export function parseProjectData(raw: unknown): ProjectData {
  if (!isObject(raw)) throw new ProjectFileError('The file does not contain a project.');
  if (raw.format !== undefined && raw.format !== PROJECT_FILE_FORMAT) {
    throw new ProjectFileError('This JSON file is not a Room Planner project.');
  }
  if (typeof raw.version === 'number' && raw.version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError('This project was created by a newer version of Room Planner.');
  }
  if (!isObject(raw.room)) throw new ProjectFileError('The project has no room.');
  if (!Array.isArray(raw.layouts) || raw.layouts.length === 0) throw new ProjectFileError('The project has no layouts.');

  const room = parseRoom(raw.room);
  const layouts = dedupeLayoutIds(raw.layouts.map((l, i) => parseLayout(l, i)));
  const activeLayoutId =
    typeof raw.activeLayoutId === 'string' && layouts.some((l) => l.id === raw.activeLayoutId)
      ? raw.activeLayoutId
      : layouts[0].id;
  return { room, layouts, activeLayoutId, settings: parseSettings(raw.settings) };
}

function parseRoom(raw: Json): Room {
  return {
    id: str(raw.id, '', 100) || createId('room'),
    width: num(raw.width, 380, ROOM_LIMITS.min, ROOM_LIMITS.max),
    depth: num(raw.depth, 320, ROOM_LIMITS.min, ROOM_LIMITS.max),
  };
}

function parseLayout(raw: unknown, index: number): Layout {
  if (!isObject(raw)) throw new ProjectFileError(`Layout ${index + 1} is invalid.`);
  const furnitureRaw = Array.isArray(raw.furniture) ? raw.furniture : [];
  const furniture = furnitureRaw.filter(isObject).map(parseFurniture);
  // Ids must be unique inside a layout; attachments to missing items are dropped.
  const seen = new Set<string>();
  for (const item of furniture) {
    if (seen.has(item.id)) item.id = createId('item');
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
  return {
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
