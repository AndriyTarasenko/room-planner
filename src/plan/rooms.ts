/**
 * Rooms of the floor plan: creating them, which room a point or item belongs to, whether
 * furniture stands on the floor, and where a new room goes.
 */
import { boxPolygon, clampShapeIntoPolygon, isShapeOnFloors, polygonLabelPoint } from '../geometry/bounds';
import { type Polygon, distanceToBoundary, pointInPolygon } from '../geometry/polygon';
import { type Box, type Point, boxCenter, boxOfPoints } from '../geometry/rect';
import type { FurnitureItem, Opening, PlanPoint, Room, Wall } from '../types';
import { createId } from '../utils/id';
import { normalizeRoom, rectCorners, roomBounds } from './shape';
import { DEFAULT_WALL_THICKNESS, axisWalls, defaultWalls, outerBox } from './walls';

export const NEW_ROOM_SIZE = { width: 300, depth: 300 } as const;

/** Tolerance for floating point noise when checking room bounds. */
const BOUNDS_EPS = 0.01;

/** A rectangular room with its inner top-left corner at `x`, `y`. `walls` are top, right, bottom, left. */
export function createRoom(input: {
  name?: string;
  x?: number;
  y?: number;
  width: number;
  depth: number;
  walls?: Wall[];
  openings?: Opening[];
}): Room {
  return {
    id: createId('room'),
    name: input.name ?? 'Room',
    corners: rectCorners(input.x ?? 0, input.y ?? 0, input.width, input.depth),
    walls: input.walls ?? defaultWalls(),
    openings: input.openings ?? [],
  };
}

/** A room of any shape, from its interior corners in either direction. */
export function createRoomFromCorners(corners: readonly PlanPoint[], input: { name?: string; walls?: Wall[] } = {}): Room {
  return normalizeRoom({
    id: createId('room'),
    name: input.name ?? 'Room',
    corners: corners.map((p) => ({ x: p.x, y: p.y })),
    walls: input.walls ?? defaultWalls(corners.length),
    openings: [],
  });
}

/** "Room 2", "Room 3", … skipping names already taken. */
export function nextRoomName(rooms: readonly Pick<Room, 'name'>[]): string {
  const taken = new Set(rooms.map((r) => r.name.trim().toLowerCase()));
  for (let n = rooms.length + 1; ; n++) {
    if (!taken.has(`room ${n}`)) return `Room ${n}`;
  }
}

/**
 * Where a room's name and move handle go: the center of a rectangle, or the point deepest
 * inside any other shape (always on the floor, even in an L-shaped room).
 */
export const roomAnchor = (room: Pick<Room, 'corners'>): Point => polygonLabelPoint(room.corners).point;

export const isPointInRoom = (p: Point, room: Pick<Room, 'corners'>, eps = BOUNDS_EPS) => pointInPolygon(p, room.corners, eps);

/** Distance from a point to a room's floor (0 inside). */
export function distanceToRoom(p: Point, room: Pick<Room, 'corners'>): number {
  return pointInPolygon(p, room.corners) ? 0 : distanceToBoundary(p, room.corners);
}

/** The first room whose floor contains `p`. */
export function roomContaining<R extends Pick<Room, 'corners'>>(p: Point, rooms: readonly R[]): R | undefined {
  return rooms.find((r) => isPointInRoom(p, r));
}

/** The room containing `p`, or the nearest one when `p` is in a wall or outside the plan. */
export function roomAt<R extends Pick<Room, 'corners'>>(p: Point, rooms: readonly R[]): R {
  const inside = roomContaining(p, rooms);
  if (inside) return inside;
  let best = rooms[0];
  let bestDistance = Infinity;
  for (const r of rooms) {
    const d = distanceToRoom(p, r);
    if (d < bestDistance) {
      best = r;
      bestDistance = d;
    }
  }
  return best;
}

/** The room an object belongs to: the one containing the center of its bounding box. */
export const roomForBox = <R extends Pick<Room, 'corners'>>(box: Box, rooms: readonly R[]): R => roomAt(boxCenter(box), rooms);

/**
 * True when a shape (convex parts, like a footprint) lies on the floor: inside one room, or
 * inside several rooms that together cover it (two parts of an open-plan space).
 */
export function isShapeOnFloor(parts: readonly Polygon[], rooms: readonly Pick<Room, 'corners'>[], eps = BOUNDS_EPS): boolean {
  return isShapeOnFloors(
    parts,
    rooms.map((r) => r.corners),
    eps,
  );
}

export const isBoxOnFloor = (box: Box, rooms: readonly Pick<Room, 'corners'>[], eps = BOUNDS_EPS) => isShapeOnFloor([boxPolygon(box)], rooms, eps);

/**
 * Offset that puts a shape back on the floor: into the room it belongs to, unless it already
 * stands on the floor.
 */
export function floorClampOffset(parts: readonly Polygon[], rooms: readonly Pick<Room, 'corners'>[]): { dx: number; dy: number } {
  if (rooms.length === 0 || isShapeOnFloor(parts, rooms)) return { dx: 0, dy: 0 };
  const room = roomForBox(boxOfPoints(parts.flat()), rooms);
  return clampShapeIntoPolygon(parts, room.corners);
}

/**
 * Ids of the items that belong to a room: floor items whose center is inside it, plus
 * anything standing on them (monitors go wherever their desk goes).
 */
export function itemIdsInRoom(items: readonly FurnitureItem[], room: Pick<Room, 'corners'>): Set<string> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const hostOf = (i: FurnitureItem) => (i.attachedTo ? byId.get(i.attachedTo) : undefined);
  const ids = new Set<string>();
  for (const item of items) {
    const anchor = hostOf(item) ?? item;
    if (isPointInRoom(anchor, room)) ids.add(item.id);
  }
  return ids;
}

/**
 * Where a new rectangular room goes when it isn't placed by hand: to the right of the plan's
 * rightmost room, top-aligned with it and sharing its wall. `walls` are the new room's walls
 * (top, right, bottom, left).
 */
export function dockedRoomPosition(rooms: readonly Room[], walls: Wall[] = defaultWalls()): Point {
  if (rooms.length === 0) return { x: 0, y: 0 };
  let neighbor = rooms[0];
  for (const r of rooms) {
    const right = outerBox(r).maxX;
    const best = outerBox(neighbor).maxX;
    if (right > best + 0.01 || (Math.abs(right - best) <= 0.01 && roomBounds(r).minY < roomBounds(neighbor).minY)) neighbor = r;
  }
  const b = roomBounds(neighbor);
  const rightWall = axisWalls(neighbor).find((w) => w.axis === 'x' && w.inward === -1 && Math.abs(w.position - b.maxX) < 0.01);
  const theirs = rightWall ? rightWall.thickness : DEFAULT_WALL_THICKNESS;
  const left = walls[3];
  const gap = Math.max(theirs, left && left.kind === 'wall' ? left.thickness : 0);
  return { x: b.maxX + gap, y: b.minY };
}
