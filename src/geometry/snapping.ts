import type { RoomSize } from './bounds';
import { type Box, boxesOverlap, expandBox } from './rect';

export interface SnapTarget {
  id: string;
  box: Box;
}

/** A guide line shown while snapped. Vertical guides have a fixed x, horizontal a fixed y. */
export interface SnapGuide {
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  kind: 'wall' | 'object';
}

export interface SnapOptions {
  room: RoomSize;
  /** Max distance in cm at which an edge snaps. */
  threshold: number;
  walls: boolean;
  /** Other objects to snap against (empty to disable object snapping). */
  targets: readonly SnapTarget[];
  /** Grid size in cm, or null. Grid snapping applies only on axes without an edge snap. */
  grid: number | null;
  /** Only objects within this distance take part in object snapping. */
  objectRange?: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

interface Candidate {
  delta: number;
  kind: 'wall' | 'object';
  /** Snapped line position. */
  position: number;
  /** Extent of the target along the guide axis. */
  span: [number, number];
}

/** Rounds to the nearest multiple of `step`. */
export function snapValue(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/**
 * Snaps a moving bounding box to walls, nearby object edges/centers and the grid.
 * Works independently per axis; the closest candidate within `threshold` wins,
 * with walls preferred on ties.
 */
export function snapBox(box: Box, opts: SnapOptions): SnapResult {
  const range = opts.objectRange ?? 100;
  const near = opts.targets.filter((t) => boxesOverlap(expandBox(box, range), t.box));

  const x = bestCandidate(axisCandidates('x', box, opts, near), opts.threshold);
  const y = bestCandidate(axisCandidates('y', box, opts, near), opts.threshold);

  let dx = x?.delta ?? 0;
  let dy = y?.delta ?? 0;
  if (opts.grid) {
    if (!x) dx = snapValue(box.minX, opts.grid) - box.minX;
    if (!y) dy = snapValue(box.minY, opts.grid) - box.minY;
  }

  const guides: SnapGuide[] = [];
  if (x) {
    const lo = Math.min(box.minY + dy, x.span[0]);
    const hi = Math.max(box.maxY + dy, x.span[1]);
    guides.push({ orientation: 'vertical', position: x.position, start: lo, end: hi, kind: x.kind });
  }
  if (y) {
    const lo = Math.min(box.minX + dx, y.span[0]);
    const hi = Math.max(box.maxX + dx, y.span[1]);
    guides.push({ orientation: 'horizontal', position: y.position, start: lo, end: hi, kind: y.kind });
  }
  return { dx, dy, guides };
}

function axisCandidates(axis: 'x' | 'y', box: Box, opts: SnapOptions, near: readonly SnapTarget[]): Candidate[] {
  const min = axis === 'x' ? box.minX : box.minY;
  const max = axis === 'x' ? box.maxX : box.maxY;
  const center = (min + max) / 2;
  const limit = axis === 'x' ? opts.room.width : opts.room.depth;
  const wallSpan: [number, number] = axis === 'x' ? [0, opts.room.depth] : [0, opts.room.width];
  const out: Candidate[] = [];

  if (opts.walls) {
    out.push({ delta: 0 - min, kind: 'wall', position: 0, span: wallSpan });
    out.push({ delta: limit - max, kind: 'wall', position: limit, span: wallSpan });
  }

  for (const t of near) {
    const tMin = axis === 'x' ? t.box.minX : t.box.minY;
    const tMax = axis === 'x' ? t.box.maxX : t.box.maxY;
    const span: [number, number] = axis === 'x' ? [t.box.minY, t.box.maxY] : [t.box.minX, t.box.maxX];
    for (const edge of [tMin, tMax]) {
      out.push({ delta: edge - min, kind: 'object', position: edge, span });
      out.push({ delta: edge - max, kind: 'object', position: edge, span });
    }
    const tCenter = (tMin + tMax) / 2;
    out.push({ delta: tCenter - center, kind: 'object', position: tCenter, span });
  }
  return out;
}

function bestCandidate(candidates: Candidate[], threshold: number): Candidate | null {
  let best: Candidate | null = null;
  for (const c of candidates) {
    const d = Math.abs(c.delta);
    if (d > threshold) continue;
    if (!best) {
      best = c;
      continue;
    }
    const bd = Math.abs(best.delta);
    if (d < bd - 1e-6 || (Math.abs(d - bd) <= 1e-6 && c.kind === 'wall' && best.kind !== 'wall')) best = c;
  }
  return best;
}
