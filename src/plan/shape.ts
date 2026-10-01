/**
 * Room outlines: creating, checking and reshaping the polygon of a room. Every operation
 * returns a new room, or the same object when nothing changes or the result would not be a
 * valid room (walls crossing, a wall shrunk to nothing), so a drag simply stops there.
 * Doors and windows keep their place on the plan wherever their wall still runs.
 */
import { type RoomRect, polygonRect } from '../geometry/bounds';
import { isSimplePolygon, lineIntersection, polygonArea, signedArea } from '../geometry/polygon';
import { type Box, type Point, boxOfPoints } from '../geometry/rect';
import { POSITION_LIMIT, ROOM_LIMITS } from '../store/defaults';
import type { Opening, PlanPoint, Room, Wall } from '../types';
import { clampOpening } from './openings';
import { type WallFrame, alongWall, pointOnWall, wallFrame, wrap } from './walls';

/** Shortest wall a room may have, in cm. */
export const MIN_WALL_LENGTH = 1;
/** Smallest floor area of a room: 0.1 m². */
export const MIN_ROOM_AREA = 1000;
/** Most corners a room may have; far more than any real room needs. */
export const MAX_CORNERS = 64;
/** Neighbors within this angle of a moved wall's direction count as running along it (sin 5°). */
const ALONG_LINE = Math.sin((5 * Math.PI) / 180);

const round1 = (v: number) => Math.round(v * 10) / 10;
const roundPoint = (p: Point): PlanPoint => ({ x: round1(p.x), y: round1(p.y) });
const samePoint = (a: Point, b: Point, eps = 1e-6) => Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;

/** Corners of a rectangle, clockwise from the top-left: walls are then top, right, bottom, left. */
export function rectCorners(x: number, y: number, width: number, depth: number): PlanPoint[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth },
  ];
}

/** Bounding box of a room's floor. */
export const roomBounds = (room: Pick<Room, 'corners'>): Box => boxOfPoints(room.corners);

/** The room as a rectangle, or null when it has any other shape. */
export const roomRect = (room: Pick<Room, 'corners'>): RoomRect | null => polygonRect(room.corners);

export const roomArea = (room: Pick<Room, 'corners'>) => polygonArea(room.corners);

/**
 * True for corners that make a usable room: clockwise, walls at least 1 cm long that only
 * meet at corners, a floor of at least 0.1 m², and within the plan's size limits.
 */
export function isValidOutline(corners: readonly Point[]): boolean {
  if (corners.length < 3 || corners.length > MAX_CORNERS) return false;
  if (!corners.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= POSITION_LIMIT && Math.abs(p.y) <= POSITION_LIMIT)) return false;
  const box = boxOfPoints(corners);
  if (box.maxX - box.minX > ROOM_LIMITS.max || box.maxY - box.minY > ROOM_LIMITS.max) return false;
  return signedArea(corners as Point[]) >= MIN_ROOM_AREA && isSimplePolygon(corners, MIN_WALL_LENGTH);
}

/** Reverses the corner order, keeping every wall and opening on the same stretch of wall. */
function reverseRoom(room: Room): Room {
  const n = room.corners.length;
  // New wall k runs between the corners of old wall n − 2 − k, the other way round.
  const oldWall = (k: number) => wrap(n - 2 - k, n);
  const corners = [...room.corners].reverse();
  const walls = corners.map((_, k) => room.walls[oldWall(k)]);
  const openings = room.openings.map((o) => {
    const wall = wrap(n - 2 - o.wall, n);
    const length = wallFrame(room, o.wall).length;
    return { ...o, wall, offset: round1(length - o.offset - o.width), hinge: o.hinge === 'start' ? ('end' as const) : ('start' as const) };
  });
  return { ...room, corners, walls, openings };
}

/**
 * Brings imported or drawn corners into the stored form: repeated corners removed (their
 * zero-length walls dropped with anything on them) and clockwise order.
 */
export function normalizeRoom(room: Room): Room {
  let result = room;
  if (room.corners.some((c, i) => samePoint(c, room.corners[wrap(i + 1, room.corners.length)], 0.05))) {
    const keep = room.corners.map((c, i) => !samePoint(c, room.corners[wrap(i + 1, room.corners.length)], 0.05));
    if (keep.every((k) => !k)) keep[0] = true;
    const index = new Map<number, number>();
    keep.forEach((k, i) => k && index.set(i, index.size));
    result = {
      ...room,
      corners: room.corners.filter((_, i) => keep[i]),
      walls: room.walls.filter((_, i) => keep[i]),
      openings: room.openings.flatMap((o) => (index.has(o.wall) ? [{ ...o, wall: index.get(o.wall)! }] : [])),
    };
  }
  return signedArea(result.corners) < 0 ? reverseRoom(result) : result;
}

/**
 * Where an opening goes when its wall changes: it keeps its distance from a wall end that
 * didn't move, or else its place along the wall's line.
 */
function remapOpening(o: Opening, before: WallFrame, after: WallFrame): Opening {
  const offset = round1(
    samePoint(before.start, after.start)
      ? o.offset
      : samePoint(before.end, after.end)
        ? o.offset + after.length - before.length
        : alongWall(after, pointOnWall(before, o.offset + o.width / 2)) - o.width / 2,
  );
  return offset === o.offset ? o : { ...o, offset };
}

const clampOpenings = (room: Room): Room => {
  const openings = room.openings.map((o) => clampOpening(o, room));
  return openings.every((o, i) => o === room.openings[i]) ? room : { ...room, openings };
};

/** Replaces the corners (same count), keeping openings in place. Invalid outlines are ignored. */
export function withCorners(room: Room, corners: readonly Point[]): Room {
  if (corners.length !== room.corners.length) return room;
  // Only moved corners are rounded, so untouched walls keep their exact length.
  const next = corners.map((p, i) => (samePoint(p, room.corners[i], 0) ? room.corners[i] : roundPoint(p)));
  if (next.every((p, i) => p === room.corners[i])) return room;
  if (!isValidOutline(next)) return room;
  const moved: Room = { ...room, corners: next };
  const openings = room.openings.map((o) => remapOpening(o, wallFrame(room, o.wall), wallFrame(moved, o.wall)));
  return clampOpenings({ ...moved, openings });
}

/** Moves a room as a whole. Openings travel with it unchanged. */
export function translateRoom(room: Room, dx: number, dy: number): Room {
  if (!dx && !dy) return room;
  const corners = room.corners.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  return isValidOutline(corners) ? { ...room, corners } : room;
}

/** Moves a room so its bounding box starts at `x`, `y`. */
export function moveRoomTo(room: Room, x: number, y: number): Room {
  const b = roomBounds(room);
  return translateRoom(room, x - b.minX, y - b.minY);
}

/** Sets position and size of a rectangular room. Other shapes are returned unchanged. */
export function resizeRect(room: Room, patch: Partial<RoomRect>): Room {
  const rect = roomRect(room);
  if (!rect) return room;
  const next = { ...rect, ...patch };
  const corners = room.corners.map((p) => ({
    x: Math.abs(p.x - rect.x) < 1e-9 ? next.x : next.x + next.width,
    y: Math.abs(p.y - rect.y) < 1e-9 ? next.y : next.y + next.depth,
  }));
  return withCorners(room, corners);
}

/** Moves one corner to `p`. */
export function moveCorner(room: Room, index: number, p: Point): Room {
  const corners = room.corners.slice();
  corners[wrap(index, corners.length)] = p;
  return withCorners(room, corners);
}

const runsAlong = (a: WallFrame, b: WallFrame) => Math.abs(a.along.x * b.along.y - a.along.y * b.along.x) < ALONG_LINE;

/**
 * Pushes wall `index` outward by `distance` cm (negative pulls it in), parallel to itself.
 * The neighboring walls keep their direction and simply get longer or shorter, so right
 * angles stay right angles. Where a neighbor runs along the same line (a wall split in two),
 * a short wall is added between them instead, which pushes out a bay or pulls in a niche.
 */
export function moveWall(room: Room, index: number, distance: number): Room {
  if (Math.abs(distance) < 1e-9) return room;
  const n = room.corners.length;
  const i = wrap(index, n);
  const f = wallFrame(room, i);
  const prev = wallFrame(room, i - 1);
  const next = wallFrame(room, i + 1);
  const shift = (p: Point) => pointOnWall({ ...f, start: p }, 0, distance);
  const a = shift(f.start);
  const b = shift(f.end);
  const jogStart = runsAlong(prev, f);
  const jogEnd = runsAlong(next, f);
  const startAt = jogStart ? a : lineIntersection(prev.start, prev.end, a, b);
  const endAt = jogEnd ? b : lineIntersection(next.start, next.end, a, b);
  if (!startAt || !endAt) return room;
  const start = roundPoint(startAt);
  const end = roundPoint(endAt);

  // Rebuild corner by corner, remembering where each old wall ends up.
  const corners: Point[] = [];
  const walls: Wall[] = [];
  const wallIndex = new Map<number, number>();
  const j = wrap(i + 1, n);
  for (let k = 0; k < n; k++) {
    if (k === i) {
      if (jogStart) {
        corners.push(room.corners[i]);
        walls.push(room.walls[i]);
      }
      wallIndex.set(i, corners.length);
      corners.push(start);
      walls.push(room.walls[i]);
    } else if (k === j) {
      if (jogEnd) {
        corners.push(end);
        walls.push(room.walls[i]);
        wallIndex.set(k, corners.length);
        corners.push(room.corners[k]);
      } else {
        wallIndex.set(k, corners.length);
        corners.push(end);
      }
      walls.push(room.walls[k]);
    } else {
      wallIndex.set(k, corners.length);
      corners.push(room.corners[k]);
      walls.push(room.walls[k]);
    }
  }
  if (!isValidOutline(corners)) return room;

  const moved: Room = { ...room, corners, walls };
  const openings = room.openings.map((o) => {
    const w = wallIndex.get(o.wall)!;
    const remapped = remapOpening(o, wallFrame(room, o.wall), wallFrame(moved, w));
    return w === o.wall ? remapped : { ...remapped, wall: w };
  });
  return clampOpenings({ ...moved, openings });
}

/**
 * Splits wall `index` with a new corner `t` cm from its start, so the two halves can be moved
 * separately. The new wall is built like the old one. A split point inside a door or window
 * moves to its nearer edge.
 */
export function splitWall(room: Room, index: number, t: number): Room {
  const n = room.corners.length;
  const i = wrap(index, n);
  const f = wallFrame(room, i);
  if (n >= MAX_CORNERS) return room;
  let at = round1(t);
  for (const o of room.openings) {
    if (o.wall !== i || at <= o.offset || at >= o.offset + o.width) continue;
    at = at - o.offset < o.offset + o.width - at ? o.offset : o.offset + o.width;
  }
  if (at < MIN_WALL_LENGTH || at > f.length - MIN_WALL_LENGTH) return room;
  const corner = roundPoint(pointOnWall(f, at));
  const corners = [...room.corners.slice(0, i + 1), corner, ...room.corners.slice(i + 1)];
  const walls = [...room.walls.slice(0, i + 1), { ...room.walls[i] }, ...room.walls.slice(i + 1)];
  if (!isValidOutline(corners)) return room;
  const openings = room.openings.map((o) => {
    if (o.wall > i) return { ...o, wall: o.wall + 1 };
    if (o.wall < i || o.offset + o.width / 2 <= at) return o;
    return { ...o, wall: i + 1, offset: round1(o.offset - at) };
  });
  return clampOpenings({ ...room, corners, walls, openings });
}

/**
 * Removes corner `index`, joining its two walls into one straight wall (built like the
 * first of them). Doors and windows on either wall move onto the joined wall. Returns the
 * room unchanged when it would get fewer than three corners or walls would cross.
 */
export function removeCorner(room: Room, index: number): Room {
  const n = room.corners.length;
  if (n <= 3) return room;
  const i = wrap(index, n);
  const before = wrap(i - 1, n);
  const corners = room.corners.filter((_, k) => k !== i);
  if (!isValidOutline(corners)) return room;
  // Old wall k keeps its index below i and moves down by one above it; the two joined walls
  // become the wall that starts at the corner before `i`.
  const joined = i === 0 ? n - 2 : i - 1;
  const walls = room.walls.filter((_, k) => k !== i);
  walls[joined] = room.walls[before];
  const result: Room = { ...room, corners, walls, openings: [] };
  const frame = wallFrame(result, joined);
  result.openings = room.openings.map((o) => {
    if (o.wall === i || o.wall === before) {
      const center = pointOnWall(wallFrame(room, o.wall), o.offset + o.width / 2);
      return { ...o, wall: joined, offset: round1(alongWall(frame, center) - o.width / 2) };
    }
    return { ...o, wall: o.wall > i ? o.wall - 1 : o.wall };
  });
  return clampOpenings(result);
}

/**
 * Makes wall `index` exactly `length` cm long by moving the next wall parallel to itself,
 * so every angle stays as it is. (A next wall on the same line can't do that; then the
 * shared corner moves instead.)
 */
export function setWallLength(room: Room, index: number, length: number): Room {
  const n = room.corners.length;
  const i = wrap(index, n);
  const f = wallFrame(room, i);
  const delta = length - f.length;
  if (Math.abs(delta) < 0.05) return room;
  const next = wallFrame(room, i + 1);
  // Moving the next wall outward by d slides its corner with this wall along this wall by d / k.
  const k = -(f.along.x * next.inward.x + f.along.y * next.inward.y);
  if (Math.abs(k) < ALONG_LINE) return moveCorner(room, i + 1, pointOnWall(f, length));
  return moveWall(room, i + 1, delta * k);
}
