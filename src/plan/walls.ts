/**
 * Wall geometry. A room is a polygon of interior corners and wall `i` runs from corner `i` to
 * corner `i + 1`. Walls sit outside the interior, so the interior keeps its exact measured
 * size and furniture can stand flush against a wall at 0 cm. Where two walls meet, their
 * outer faces are mitered, so corners are closed at any angle.
 */
import { type Polygon, lineIntersection } from '../geometry/polygon';
import { type Box, type Point, boxOfPoints, unionBoxes } from '../geometry/rect';
import type { WallLine } from '../geometry/snapping';
import type { Room, Wall } from '../types';

/** Typical interior wall; exterior walls are usually thicker and can be set per wall. */
export const DEFAULT_WALL_THICKNESS = 12;
export const WALL_LIMITS = { min: 1, max: 100 } as const;

/** Miters longer than this many wall thicknesses (very sharp corners) are cut short. */
const MITER_LIMIT = 4;

export const defaultWall = (thickness = DEFAULT_WALL_THICKNESS): Wall => ({ kind: 'wall', thickness });

export function defaultWalls(count = 4, thickness = DEFAULT_WALL_THICKNESS): Wall[] {
  return Array.from({ length: count }, () => defaultWall(thickness));
}

/** Index of wall or corner `i` of an `n`-sided room, wrapping around. */
export const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Thickness of a wall, or 0 when it is open. */
export function wallThickness(room: Pick<Room, 'walls'>, i: number): number {
  const wall = room.walls[wrap(i, room.walls.length)];
  return wall.kind === 'wall' ? wall.thickness : 0;
}

/**
 * A wall as a line on the interior face, from its start corner to its end corner. Offsets
 * along a wall (doors, windows) are measured from its start.
 */
export interface WallFrame {
  start: Point;
  end: Point;
  /** Unit vector along the wall. */
  along: Point;
  /** Unit vector pointing into the room. */
  inward: Point;
  length: number;
}

/** Frame of wall `i`. Corners run clockwise on screen, so the room is to the right of each wall. */
export function wallFrame(room: Pick<Room, 'corners'>, i: number): WallFrame {
  const n = room.corners.length;
  const start = room.corners[wrap(i, n)];
  const end = room.corners[wrap(i + 1, n)];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const along = length > 0 ? { x: (end.x - start.x) / length, y: (end.y - start.y) / length } : { x: 1, y: 0 };
  return { start, end, along, inward: { x: -along.y, y: along.x }, length };
}

export const wallFrames = (room: Pick<Room, 'corners'>) => room.corners.map((_, i) => wallFrame(room, i));

export const wallLength = (room: Pick<Room, 'corners'>, i: number) => wallFrame(room, i).length;

/** The point `t` cm along a wall, moved `outward` cm away from the room (into the wall). */
export function pointOnWall(frame: WallFrame, t: number, outward = 0): Point {
  return {
    x: frame.start.x + frame.along.x * t - frame.inward.x * outward,
    y: frame.start.y + frame.along.y * t - frame.inward.y * outward,
  };
}

/** Position of `p` along a wall, measured from its start corner. */
export function alongWall(frame: WallFrame, p: Point): number {
  return (p.x - frame.start.x) * frame.along.x + (p.y - frame.start.y) * frame.along.y;
}

/** Distance from `p` to a wall's interior face (the segment, not the infinite line). */
export function distanceToWall(frame: WallFrame, p: Point): number {
  const t = Math.min(frame.length, Math.max(0, alongWall(frame, p)));
  const q = pointOnWall(frame, t);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** True when the two frames run along parallel lines (either direction). */
export const areParallel = (a: WallFrame, b: WallFrame, eps = 1e-6) => Math.abs(a.along.x * b.along.y - a.along.y * b.along.x) < eps;

/** A wall that runs more left–right than up–down. */
export const isMostlyHorizontal = (frame: WallFrame) => Math.abs(frame.along.x) >= Math.abs(frame.along.y);

/**
 * Where the outer faces of wall `i - 1` and wall `i` meet, around corner `i`: the miter point.
 * Null when both walls are open or run along one line (their outer faces then just end).
 */
function outerJoint(room: Room, i: number): Point | null {
  const tPrev = wallThickness(room, i - 1);
  const tCur = wallThickness(room, i);
  if (tPrev <= 0 && tCur <= 0) return null;
  const prev = wallFrame(room, i - 1);
  const cur = wallFrame(room, i);
  if (areParallel(prev, cur)) return null;
  const corner = room.corners[wrap(i, room.corners.length)];
  const m = lineIntersection(pointOnWall(prev, 0, tPrev), pointOnWall(prev, prev.length, tPrev), pointOnWall(cur, 0, tCur), pointOnWall(cur, cur.length, tCur));
  if (!m) return null;
  const dx = m.x - corner.x;
  const dy = m.y - corner.y;
  const len = Math.hypot(dx, dy);
  const limit = MITER_LIMIT * Math.max(tPrev, tCur);
  const joint = len > limit ? { x: corner.x + (dx / len) * limit, y: corner.y + (dy / len) * limit } : m;
  // Floating point noise would otherwise show up as 391.99999999 in square rooms.
  return { x: Math.round(joint.x * 1e6) / 1e6, y: Math.round(joint.y * 1e6) / 1e6 };
}

/**
 * One wall as a polygon outside the interior (interior face, then the outer face back), or
 * null for an open wall.
 */
export function wallPolygon(room: Room, i: number): Polygon | null {
  const t = wallThickness(room, i);
  if (t <= 0) return null;
  const f = wallFrame(room, i);
  const startOuter = outerJoint(room, i) ?? pointOnWall(f, 0, t);
  const endOuter = outerJoint(room, i + 1) ?? pointOnWall(f, f.length, t);
  return [f.start, f.end, endOuter, startOuter];
}

export function wallPolygons(room: Room): { index: number; polygon: Polygon }[] {
  return room.corners.flatMap((_, index) => {
    const polygon = wallPolygon(room, index);
    return polygon ? [{ index, polygon }] : [];
  });
}

/** Outer corners of the walls, one per room corner (the room corner itself where no wall is built). */
export function outerCorners(room: Room): Point[] {
  return room.corners.map((corner, i) => {
    const joint = outerJoint(room, i);
    if (joint) return joint;
    const t = Math.max(wallThickness(room, i - 1), wallThickness(room, i));
    if (t <= 0) return corner;
    const f = wallFrame(room, i);
    return pointOnWall(f, 0, t);
  });
}

/** A room's footprint including its walls. */
export function outerBox(room: Room): Box {
  return boxOfPoints([...room.corners, ...wallPolygons(room).flatMap((w) => w.polygon)]);
}

/** Outer bounds of the whole floor plan, walls included. */
export function planBounds(rooms: readonly Room[]): Box {
  if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return unionBoxes(rooms.map(outerBox));
}

/**
 * A wall that runs exactly along the x or y axis, as the snapping code needs it. `axis` is
 * the fixed coordinate: `x` for a vertical wall. `inward` is +1 when the room lies on the
 * high side of the line (a left or top wall) and −1 otherwise.
 */
export interface AxisWall {
  index: number;
  axis: 'x' | 'y';
  position: number;
  /** Extent along the other axis. */
  span: [number, number];
  inward: 1 | -1;
  thickness: number;
}

export function axisWalls(room: Room): AxisWall[] {
  const out: AxisWall[] = [];
  room.corners.forEach((_, index) => {
    const f = wallFrame(room, index);
    const thickness = wallThickness(room, index);
    if (Math.abs(f.start.x - f.end.x) < 1e-9) {
      out.push({ index, axis: 'x', position: f.start.x, span: [Math.min(f.start.y, f.end.y), Math.max(f.start.y, f.end.y)], inward: f.inward.x > 0 ? 1 : -1, thickness });
    } else if (Math.abs(f.start.y - f.end.y) < 1e-9) {
      out.push({ index, axis: 'y', position: f.start.y, span: [Math.min(f.start.x, f.end.x), Math.max(f.start.x, f.end.x)], inward: f.inward.y > 0 ? 1 : -1, thickness });
    }
  });
  return out;
}

/** Interior faces of all straight walls, for snapping furniture against them. */
export function roomWallLines(rooms: readonly Room[]): WallLine[] {
  return rooms.flatMap((room) =>
    axisWalls(room).map((w) => ({ orientation: w.axis === 'x' ? ('vertical' as const) : ('horizontal' as const), position: w.position, span: w.span, inward: w.inward })),
  );
}

const COMPASS =['Top', 'Top right', 'Right', 'Bottom right', 'Bottom', 'Bottom left', 'Left', 'Top left'] as const;

/** Where a wall is on the room, as seen on the plan: the direction it faces from the inside. */
function wallDirection(frame: WallFrame): string {
  // The wall lies opposite its inward normal: inward pointing down means a top wall.
  const angle = Math.atan2(-frame.inward.x, frame.inward.y); // 0 for a top wall, clockwise
  const sector = wrap(Math.round(angle / (Math.PI / 4)), 8);
  return COMPASS[sector];
}

/** Names for all walls of a room ("Top", "Right", …), numbered where several face the same way ("Top 1", "Top 2"). */
export function wallNames(room: Pick<Room, 'corners'>): string[] {
  const names = wallFrames(room).map(wallDirection);
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  const seen = new Map<string, number>();
  return names.map((n) => {
    if ((counts.get(n) ?? 0) < 2) return n;
    const k = (seen.get(n) ?? 0) + 1;
    seen.set(n, k);
    return `${n} ${k}`;
  });
}

/** What the ends of a wall are called on the plan: left/right for walls running across, top/bottom for the others. */
export function wallEndLabels(frame: WallFrame): { start: string; end: string } {
  if (isMostlyHorizontal(frame)) return frame.along.x > 0 ? { start: 'Left', end: 'Right' } : { start: 'Right', end: 'Left' };
  return frame.along.y > 0 ? { start: 'Top', end: 'Bottom' } : { start: 'Bottom', end: 'Top' };
}

/** True when a wall's start is its left (or top) end on the plan, so offsets read like the plan. */
export const startsAtPlanStart = (frame: WallFrame) => (isMostlyHorizontal(frame) ? frame.along.x > 0 : frame.along.y > 0);
