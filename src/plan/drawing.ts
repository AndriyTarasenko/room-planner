/**
 * Drawing a room wall by wall: where the next corner goes for a pointer position. Walls
 * snap to 45° steps from the previous corner, corners snap onto the corners of existing
 * rooms (so a new room can share their walls) and line up with them, and lengths are whole
 * centimeters (or grid steps).
 */
import type { Point } from '../geometry/rect';
import type { SnapGuide } from '../geometry/snapping';
import type { Room } from '../types';
import { cornerTargets, snapPoint } from './roomSnapping';

export interface DraftPoint {
  point: Point;
  guides: SnapGuide[];
  /** The point is the first corner again, so placing it closes the room. */
  closes: boolean;
}

export interface DraftSnapOptions {
  /** Snap distance in cm. */
  threshold: number;
  /** False while Alt is held: no snapping, only whole centimeters. */
  snap: boolean;
  /** Grid step in cm when snapping to the grid, else null. */
  grid: number | null;
}

const STEP = Math.PI / 4;
const round = (v: number, step: number) => Math.round(v / step) * step;
const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v);

/** Where the next corner of a drawn room goes for the pointer at `raw`. */
export function snapDraftPoint(raw: Point, placed: readonly Point[], rooms: readonly Room[], opts: DraftSnapOptions): DraftPoint {
  const first = placed[0];
  if (placed.length >= 3 && Math.hypot(raw.x - first.x, raw.y - first.y) <= opts.threshold * 1.5) {
    return { point: first, guides: [], closes: true };
  }
  const unit = opts.grid ?? 1;
  if (!opts.snap) return { point: { x: Math.round(raw.x), y: Math.round(raw.y) }, guides: [], closes: false };

  const targets = [...cornerTargets(rooms), ...placed];
  let nearest: Point | null = null;
  for (const t of targets) {
    const d = Math.hypot(raw.x - t.x, raw.y - t.y);
    if (d <= opts.threshold && (!nearest || d < Math.hypot(raw.x - nearest.x, raw.y - nearest.y))) nearest = t;
  }
  if (nearest) return { point: { ...nearest }, guides: [], closes: false };

  const last = placed[placed.length - 1];
  if (last) {
    const dx = raw.x - last.x;
    const dy = raw.y - last.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const snapped = round(angle, STEP);
    // Close enough to a 45° direction: slide along it.
    if (len > 0 && Math.abs(Math.sin(angle - snapped)) * len <= opts.threshold) {
      const dir = { x: clean(Math.cos(snapped)), y: clean(Math.sin(snapped)) };
      let length = len * Math.cos(angle - snapped);
      const guides: SnapGuide[] = [];
      // Along a horizontal or vertical wall, stop in line with an existing corner.
      if (dir.x === 0 || dir.y === 0) {
        const aligned = snapPoint(raw, targets, opts.threshold);
        const g = aligned.guides.find((guide) => (dir.y === 0 ? guide.orientation === 'vertical' : guide.orientation === 'horizontal'));
        if (g) {
          length = dir.y === 0 ? (g.position - last.x) * dir.x : (g.position - last.y) * dir.y;
          guides.push(g);
        }
      }
      if (guides.length === 0) length = round(length, unit);
      const point = { x: last.x + dir.x * length, y: last.y + dir.y * length };
      if (dir.x !== 0 && dir.y !== 0) point.x = Math.round(point.x * 10) / 10;
      if (dir.x !== 0 && dir.y !== 0) point.y = Math.round(point.y * 10) / 10;
      for (const g of guides) {
        const along = g.orientation === 'vertical' ? point.y : point.x;
        g.start = Math.min(g.start, along);
        g.end = Math.max(g.end, along);
      }
      return { point, guides, closes: false };
    }
  }

  const aligned = snapPoint(raw, targets, opts.threshold);
  const point = {
    x: aligned.guides.some((g) => g.orientation === 'vertical') ? aligned.point.x : round(raw.x, unit),
    y: aligned.guides.some((g) => g.orientation === 'horizontal') ? aligned.point.y : round(raw.y, unit),
  };
  return { point, guides: aligned.guides, closes: false };
}

/** The point `length` cm from `from` toward `toward`, for typing an exact wall length. */
export function pointAtLength(from: Point, toward: Point, length: number): Point | null {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || !(length > 0)) return null;
  return { x: Math.round((from.x + (dx / len) * length) * 10) / 10, y: Math.round((from.y + (dy / len) * length) * 10) / 10 };
}
