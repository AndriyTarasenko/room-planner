/**
 * Doors, windows and passages. An opening belongs to one wall of one room and is measured
 * along that wall's interior face, so it moves with the room and survives reshaping.
 */
import { type Polygon, pointInPolygon } from '../geometry/polygon';
import { type Box, type Point, boxOfPoints, unionBoxes } from '../geometry/rect';
import type { Opening, OpeningKind, Room } from '../types';
import { createId } from '../utils/id';
import {
  type WallFrame,
  alongWall,
  areParallel,
  distanceToWall,
  planBounds,
  pointOnWall,
  wallFrame,
  wallPolygons,
  wrap,
} from './walls';

export const OPENING_DEFAULTS: Record<OpeningKind, { label: string; width: number }> = {
  door: { label: 'Door', width: 80 },
  window: { label: 'Window', width: 120 },
  passage: { label: 'Passage', width: 90 },
};

export const OPENING_LIMITS = { min: 20, max: 1000 } as const;

export function createOpening(kind: OpeningKind, wall: number, offset: number, width = OPENING_DEFAULTS[kind].width): Opening {
  return { id: createId('opening'), kind, wall, offset, width, hinge: 'start', swing: 'in' };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Keeps an opening on an existing wall of the room: no wider than the wall, and not past
 * either corner. Returns the same object when nothing changes.
 */
export function clampOpening(opening: Opening, room: Pick<Room, 'corners'>): Opening {
  const wall = Number.isInteger(opening.wall) && opening.wall >= 0 && opening.wall < room.corners.length ? opening.wall : 0;
  const length = wallFrame(room, wall).length;
  const width = round1(Math.min(Math.max(opening.width, Math.min(OPENING_LIMITS.min, length)), length));
  const offset = round1(Math.min(Math.max(0, opening.offset), length - width));
  return wall === opening.wall && width === opening.width && offset === opening.offset ? opening : { ...opening, wall, width, offset };
}

/** Middle of the opening on the room's interior face. */
export function openingAnchor(room: Room, opening: Opening): Point {
  return pointOnWall(wallFrame(room, opening.wall), opening.offset + opening.width / 2);
}

export interface OpeningCut {
  /** The gap in the wall, in plan coordinates (a rectangle along the wall). */
  polygon: Polygon;
  /** How far the gap reaches from the interior face through the wall(s), in cm. */
  depth: number;
}

/**
 * The gap an opening makes in the wall. Where a neighboring room's wall runs along the same
 * line (two rooms sharing a wall), the gap continues through it, so a door between two rooms
 * is open on both sides.
 */
export function openingCut(room: Room, opening: Opening, rooms: readonly Room[]): OpeningCut {
  const frame = wallFrame(room, opening.wall);
  const lo = opening.offset;
  const hi = opening.offset + opening.width;
  const out = { x: -frame.inward.x, y: -frame.inward.y };
  const wall = room.walls[wrap(opening.wall, room.walls.length)];
  let depth = wall.thickness;

  const TOUCH = 0.5;
  // Other walls parallel to this one, measured in this wall's frame: along it, and outward from its face.
  const parallel = rooms.flatMap((other) =>
    wallPolygons(other)
      .filter((w) => areParallel(frame, wallFrame(other, w.index), 1e-3))
      .map((w) => {
        const along = w.polygon.map((p) => alongWall(frame, p));
        const outward = w.polygon.map((p) => (p.x - frame.start.x) * out.x + (p.y - frame.start.y) * out.y);
        return { lo: Math.min(...along), hi: Math.max(...along), near: Math.min(...outward), far: Math.max(...outward) };
      }),
  );
  for (let pass = 0; pass < 4; pass++) {
    let grown = false;
    for (const w of parallel) {
      if (Math.min(hi, w.hi) - Math.max(lo, w.lo) <= TOUCH) continue;
      if (w.near > depth + TOUCH || w.far < -TOUCH || w.far <= depth + 1e-6) continue;
      depth = w.far;
      grown = true;
    }
    if (!grown) break;
  }

  const polygon = [pointOnWall(frame, lo), pointOnWall(frame, hi), pointOnWall(frame, hi, depth), pointOnWall(frame, lo, depth)];
  return { polygon, depth };
}

export interface DoorSwing {
  hinge: Point;
  /** Leaf end when the door is fully open (90°). */
  open: Point;
  /** Arc traced by the leaf end, from closed to open. */
  arc: Point[];
  /** The swept area as a convex polygon (hinge plus arc), for conflict checks. */
  polygon: Polygon;
}

/**
 * The area a door leaf sweeps. Doors opening outward swing from the far face of the wall,
 * into the neighboring room (or outside).
 */
export function doorSwing(room: Room, opening: Opening, cutDepth: number, segments = 12): DoorSwing {
  const frame = wallFrame(room, opening.wall);
  const hingeAt = opening.hinge === 'start' ? opening.offset : opening.offset + opening.width;
  const hinge = pointOnWall(frame, hingeAt, opening.swing === 'out' ? cutDepth : 0);
  const n = opening.swing === 'in' ? frame.inward : { x: -frame.inward.x, y: -frame.inward.y };
  const c = opening.hinge === 'start' ? frame.along : { x: -frame.along.x, y: -frame.along.y };
  const r = opening.width;
  const arc: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (Math.PI / 2) * (i / segments);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    arc.push({ x: hinge.x + r * (cos * c.x + sin * n.x), y: hinge.y + r * (cos * c.y + sin * n.y) });
  }
  return { hinge, open: arc[arc.length - 1], arc, polygon: [hinge, ...arc] };
}

/** Every door's swing area in the plan, for conflict checks against furniture. */
export function doorSwingZones(rooms: readonly Room[]): { room: Room; opening: Opening; polygon: Polygon }[] {
  return rooms.flatMap((room) =>
    room.openings
      .filter((o) => o.kind === 'door')
      .map((opening) => ({ room, opening, polygon: doorSwing(room, opening, openingCut(room, opening, rooms).depth).polygon })),
  );
}

/** Everything the plan draws: rooms with their walls, plus door leaves that swing out past them. */
export function planExtent(rooms: readonly Room[]): Box {
  const boxes = [planBounds(rooms), ...doorSwingZones(rooms).map((z) => boxOfPoints(z.polygon))];
  return unionBoxes(boxes);
}

/** The wall of `room` closest to `p`. Near-ties keep `current`, so a dragged opening doesn't flicker between walls at a corner. */
export function nearestWall(room: Room, p: Point, current?: number): number {
  let best = current ?? 0;
  let bestDistance = distanceToWall(wallFrame(room, best), p) - (current !== undefined ? 2 : 0);
  room.corners.forEach((_, i) => {
    const d = distanceToWall(wallFrame(room, i), p);
    if (d < bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/** Offset that centers an opening of `width` at `t` cm along a wall, kept within the wall. */
export function offsetCenteredAt(frame: WallFrame, t: number, width: number): number {
  return Math.min(Math.max(0, t - width / 2), Math.max(0, frame.length - width));
}

export interface OpeningPlacement {
  wall: number;
  offset: number;
  width: number;
}

/**
 * Where a dragged opening goes: onto the wall nearest to its anchor, slid along that wall,
 * snapped to either corner or the center within `threshold` cm and otherwise to whole cm.
 */
export function resolveOpeningDrag(room: Room, opening: Opening, anchor: Point, threshold: number, snap = true): OpeningPlacement {
  const wall = nearestWall(room, anchor, opening.wall);
  const frame = wallFrame(room, wall);
  const width = Math.min(opening.width, frame.length);
  const max = frame.length - width;
  let offset = alongWall(frame, anchor) - width / 2;
  let snapped: number | null = null;
  if (snap) {
    for (const v of [0, max, max / 2]) {
      if (Math.abs(v - offset) <= threshold && (snapped === null || Math.abs(v - offset) < Math.abs(snapped - offset))) snapped = v;
    }
  }
  offset = snapped ?? Math.round(offset);
  return { wall, offset: round1(Math.min(Math.max(0, offset), max)), width };
}

/**
 * The wall a dropped opening lands on: a wall of the room the point is in, or of the nearest
 * room when the point is in a wall or outside the plan.
 */
export function openingDropTarget(rooms: readonly Room[], p: Point, width: number): { room: Room; placement: OpeningPlacement } | null {
  if (rooms.length === 0) return null;
  const inside = rooms.find((r) => pointInPolygon(p, r.corners, 0.01));
  let best: { room: Room; wall: number; distance: number } | null = null;
  for (const room of inside ? [inside] : rooms) {
    for (let wall = 0; wall < room.corners.length; wall++) {
      const distance = distanceToWall(wallFrame(room, wall), p);
      if (!best || distance < best.distance) best = { room, wall, distance };
    }
  }
  if (!best) return null;
  const { room, wall } = best;
  const frame = wallFrame(room, wall);
  const w = Math.min(width, frame.length);
  return { room, placement: { wall, offset: Math.round(offsetCenteredAt(frame, alongWall(frame, p), w)), width: w } };
}

/**
 * A free spot for a new opening: centered in the longest stretch of wall not taken by other
 * openings (keeping 10 cm from corners and neighbors). Open walls are skipped.
 */
export function freeOpeningPlacement(room: Room, width: number): OpeningPlacement {
  const MARGIN = 10;
  let best: { wall: number; lo: number; hi: number } | null = null;
  for (let wall = 0; wall < room.corners.length; wall++) {
    if (room.walls[wall].kind !== 'wall') continue;
    const length = wallFrame(room, wall).length;
    const taken = room.openings
      .filter((o) => o.wall === wall)
      .map((o) => [o.offset - MARGIN, o.offset + o.width + MARGIN] as const)
      .sort((a, b) => a[0] - b[0]);
    let cursor = MARGIN;
    for (const [lo, hi] of [...taken, [length - MARGIN, Infinity] as const]) {
      if (lo - cursor > (best ? best.hi - best.lo : -Infinity)) best = { wall, lo: cursor, hi: lo };
      cursor = Math.max(cursor, hi);
    }
  }
  const wall = best?.wall ?? 0;
  const frame = wallFrame(room, wall);
  const w = Math.min(width, frame.length);
  const center = best ? (best.lo + best.hi) / 2 : frame.length / 2;
  return { wall, offset: Math.round(offsetCenteredAt(frame, center, w)), width: w };
}
