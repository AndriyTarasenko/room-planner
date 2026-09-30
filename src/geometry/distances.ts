import type { RoomSize } from './bounds';
import { type Footprint, footprintBox, worldParts } from './footprint';
import { type Box, type Point, isQuarterTurn } from './rect';

export type Direction = 'left' | 'right' | 'top' | 'bottom';
export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'top', 'bottom'];

export type WallDistances = Record<Direction, number>;

/** Clear distance from the footprint to each wall (negative when outside the room). */
export function wallDistances(box: Box, room: RoomSize): WallDistances {
  return {
    left: box.minX,
    right: room.width - box.maxX,
    top: box.minY,
    bottom: room.depth - box.maxY,
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
 * Dimension lines from an item to the four walls. For axis-aligned items the line runs
 * through the item center; for freely rotated items it starts at the corner closest to the wall.
 */
export function wallMeasureLines(item: Footprint, room: RoomSize): MeasureLine[] {
  const box = footprintBox(item);
  const d = wallDistances(box, room);
  if (isQuarterTurn(item.rotation) && item.shape.kind === 'rect') {
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    return [
      { direction: 'left', from: { x: box.minX, y: cy }, to: { x: 0, y: cy }, value: d.left },
      { direction: 'right', from: { x: box.maxX, y: cy }, to: { x: room.width, y: cy }, value: d.right },
      { direction: 'top', from: { x: cx, y: box.minY }, to: { x: cx, y: 0 }, value: d.top },
      { direction: 'bottom', from: { x: cx, y: box.maxY }, to: { x: cx, y: room.depth }, value: d.bottom },
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
    { direction: 'left', from: l, to: { x: 0, y: l.y }, value: d.left },
    { direction: 'right', from: r, to: { x: room.width, y: r.y }, value: d.right },
    { direction: 'top', from: t, to: { x: t.x, y: 0 }, value: d.top },
    { direction: 'bottom', from: b, to: { x: b.x, y: room.depth }, value: d.bottom },
  ];
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
