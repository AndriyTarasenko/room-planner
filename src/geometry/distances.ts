import { polygonRect } from './bounds';
import { type Footprint, footprintBox, touchesBoxMidpoints, worldParts } from './footprint';
import { pointInPolygon, rayToBoundary } from './polygon';
import { type Box, type Point, isQuarterTurn } from './rect';

export type Direction = 'left' | 'right' | 'top' | 'bottom';
export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'top', 'bottom'];

export type WallDistances = Record<Direction, number>;

const UNIT: Record<Direction, Point> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };

/**
 * Distance from `p` to the room's edge in direction `dir`: forward to the next wall from
 * inside the room, negative (back to the wall) from outside it.
 */
function distanceAlong(p: Point, dir: Point, room: readonly Point[]): number {
  if (pointInPolygon(p, room, 1e-6)) return rayToBoundary(p, dir, room);
  const back = rayToBoundary(p, { x: -dir.x, y: -dir.y }, room);
  return Number.isFinite(back) ? -back : Infinity;
}

/**
 * Points along one side of a box from which to measure outward: its ends, its middle and
 * every room corner in between, which is where a stepped wall comes closest.
 */
function sideSamples(box: Box, direction: Direction, room: readonly Point[]): Point[] {
  const vertical = direction === 'left' || direction === 'right';
  const fixed = direction === 'left' ? box.minX : direction === 'right' ? box.maxX : direction === 'top' ? box.minY : box.maxY;
  const lo = vertical ? box.minY : box.minX;
  const hi = vertical ? box.maxY : box.maxX;
  const inset = Math.min(0.01, (hi - lo) / 4);
  const ts = [(lo + hi) / 2, lo + inset, hi - inset];
  for (const c of room) {
    const t = vertical ? c.y : c.x;
    if (t > lo && t < hi) ts.push(t);
  }
  return ts.map((t) => (vertical ? { x: fixed, y: t } : { x: t, y: fixed }));
}

/** The closest wall in one direction from a box side, and where along the side it is measured. */
function nearestInDirection(box: Box, direction: Direction, room: readonly Point[]): { from: Point; value: number } {
  const samples = sideSamples(box, direction, room);
  let best = { from: samples[0], value: distanceAlong(samples[0], UNIT[direction], room) };
  for (const from of samples.slice(1)) {
    const value = distanceAlong(from, UNIT[direction], room);
    // Prefer the middle of the side unless another point is clearly closer.
    if (value < best.value - 0.05) best = { from, value };
  }
  return best;
}

/**
 * Clear distance from the footprint to the nearest wall of the room in each direction
 * (negative when it pokes through that wall). For stepped rooms this is the closest wall
 * anywhere along that side of the box.
 */
export function wallDistances(box: Box, room: readonly Point[]): WallDistances {
  const rect = polygonRect(room);
  if (rect) {
    return {
      left: box.minX - rect.x,
      right: rect.x + rect.width - box.maxX,
      top: box.minY - rect.y,
      bottom: rect.y + rect.depth - box.maxY,
    };
  }
  return {
    left: nearestInDirection(box, 'left', room).value,
    right: nearestInDirection(box, 'right', room).value,
    top: nearestInDirection(box, 'top', room).value,
    bottom: nearestInDirection(box, 'bottom', room).value,
  };
}

/** A dimension line from `from` to `to`, labelled with `value` centimeters. */
export interface MeasureLine {
  direction: Direction;
  from: Point;
  to: Point;
  value: number;
}

/**
 * Dimension lines from an item to the walls around it. For axis-aligned items and circles the
 * line runs through the item center (or where a stepped wall comes closest); for freely
 * rotated items it starts at the corner closest to the wall.
 */
export function wallMeasureLines(item: Footprint, room: readonly Point[]): MeasureLine[] {
  const rect = polygonRect(room);
  if (!rect) return polygonMeasureLines(item, room);
  const box = footprintBox(item);
  const d = wallDistances(box, room);
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.depth;
  if (touchesBoxMidpoints(item)) {
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    return [
      { direction: 'left', from: { x: box.minX, y: cy }, to: { x: left, y: cy }, value: d.left },
      { direction: 'right', from: { x: box.maxX, y: cy }, to: { x: right, y: cy }, value: d.right },
      { direction: 'top', from: { x: cx, y: box.minY }, to: { x: cx, y: top }, value: d.top },
      { direction: 'bottom', from: { x: cx, y: box.maxY }, to: { x: cx, y: bottom }, value: d.bottom },
    ];
  }
  const corners = worldParts(item).flat();
  const extreme = (pick: (p: Point) => number, max: boolean) =>
    corners.reduce((best, p) => ((max ? pick(p) > pick(best) : pick(p) < pick(best)) ? p : best));
  const l = extreme((p) => p.x, false);
  const r = extreme((p) => p.x, true);
  const t = extreme((p) => p.y, false);
  const b = extreme((p) => p.y, true);
  return [
    { direction: 'left', from: l, to: { x: left, y: l.y }, value: d.left },
    { direction: 'right', from: r, to: { x: right, y: r.y }, value: d.right },
    { direction: 'top', from: t, to: { x: t.x, y: top }, value: d.top },
    { direction: 'bottom', from: b, to: { x: b.x, y: bottom }, value: d.bottom },
  ];
}

function polygonMeasureLines(item: Footprint, room: readonly Point[]): MeasureLine[] {
  const box = footprintBox(item);
  const line = (direction: Direction, from: Point, value: number): MeasureLine => {
    const u = UNIT[direction];
    return { direction, from, to: { x: from.x + u.x * value, y: from.y + u.y * value }, value };
  };
  if (isQuarterTurn(item.rotation) && item.shape.kind === 'rect') {
    return DIRECTIONS.flatMap((direction) => {
      const { from, value } = nearestInDirection(box, direction, room);
      return Number.isFinite(value) ? [line(direction, from, value)] : [];
    });
  }
  const corners = worldParts(item).flat();
  const extreme: Record<Direction, (a: Point, b: Point) => boolean> = {
    left: (a, b) => a.x < b.x,
    right: (a, b) => a.x > b.x,
    top: (a, b) => a.y < b.y,
    bottom: (a, b) => a.y > b.y,
  };
  return DIRECTIONS.flatMap((direction) => {
    const from = corners.reduce((best, p) => (extreme[direction](p, best) ? p : best));
    const value = distanceAlong(from, UNIT[direction], room);
    return Number.isFinite(value) ? [line(direction, from, value)] : [];
  });
}

export interface NeighborBox {
  id: string;
  box: Box;
}

export interface NeighborGap extends MeasureLine {
  otherId: string;
}

/**
 * For each direction, the nearest other object whose bounding box overlaps ours on the
 * perpendicular axis, with a dimension line across the gap. Only gaps in (0, maxGap] are
 * reported: overlapping objects are handled by collision detection instead.
 */
export function neighborGaps(box: Box, others: readonly NeighborBox[], maxGap = 150): NeighborGap[] {
  const best = new Map<Direction, { gap: number; other: NeighborBox; lo: number; hi: number }>();
  const consider = (direction: Direction, gap: number, other: NeighborBox, lo: number, hi: number) => {
    if (gap <= 0.05 || gap > maxGap) return;
    const current = best.get(direction);
    if (!current || gap < current.gap) best.set(direction, { gap, other, lo, hi });
  };

  for (const other of others) {
    const o = other.box;
    const yLo = Math.max(box.minY, o.minY);
    const yHi = Math.min(box.maxY, o.maxY);
    if (yHi - yLo > 0.05) {
      consider('left', box.minX - o.maxX, other, yLo, yHi);
      consider('right', o.minX - box.maxX, other, yLo, yHi);
    }
    const xLo = Math.max(box.minX, o.minX);
    const xHi = Math.min(box.maxX, o.maxX);
    if (xHi - xLo > 0.05) {
      consider('top', box.minY - o.maxY, other, xLo, xHi);
      consider('bottom', o.minY - box.maxY, other, xLo, xHi);
    }
  }

  const result: NeighborGap[] = [];
  for (const [direction, { gap, other, lo, hi }] of best) {
    const mid = (lo + hi) / 2;
    const o = other.box;
    let from: Point;
    let to: Point;
    switch (direction) {
      case 'left':
        from = { x: box.minX, y: mid };
        to = { x: o.maxX, y: mid };
        break;
      case 'right':
        from = { x: box.maxX, y: mid };
        to = { x: o.minX, y: mid };
        break;
      case 'top':
        from = { x: mid, y: box.minY };
        to = { x: mid, y: o.maxY };
        break;
      case 'bottom':
        from = { x: mid, y: box.maxY };
        to = { x: mid, y: o.minY };
        break;
    }
    result.push({ direction, from, to, value: gap, otherId: other.id });
  }
  return result;
}
