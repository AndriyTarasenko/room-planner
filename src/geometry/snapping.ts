import { type Box, type Point, boxesOverlap, expandBox } from './rect';

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

/**
 * A wall face furniture can snap to: a line at a fixed x (vertical) or y (horizontal).
 * `inward` is +1 when the room is on the high side of the line (a left or top wall), −1 otherwise,
 * so only the box edge facing the wall snaps to it.
 */
export interface WallLine {
  orientation: 'vertical' | 'horizontal';
  position: number;
  /** Extent along the line. */
  span: [number, number];
  inward: 1 | -1;
}

export interface SnapOptions {
  /** Interior wall faces that attract the box; only walls near the box take part. Empty disables wall snapping. */
  walls: readonly WallLine[];
  /** Max distance in cm at which an edge snaps. */
  threshold: number;
  /** Other objects to snap against (empty to disable object snapping). */
  targets: readonly SnapTarget[];
  /** Grid size in cm, or null. Grid snapping applies only on axes without an edge snap. */
  grid: number | null;
  /** Where grid lines start: the top-left of the room the box is in. */
  gridOrigin?: Point;
  /** Only objects and walls within this distance take part in snapping. */
  objectRange?: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export interface Candidate {
  delta: number;
  kind: 'wall' | 'object';
  /** Snapped line position. */
  position: number;
  /** Extent of the target along the guide axis. */
  span: [number, number];
}

/** Rounds to the nearest multiple of `step`. */
export function snapValue(value: number, step: number, origin = 0): number {
  if (step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
}

/**
 * Snaps a moving bounding box to walls, nearby object edges/centers and the grid.
 * Works independently per axis; the closest candidate within `threshold` wins,
 * with walls preferred on ties.
 */
export function snapBox(box: Box, opts: SnapOptions): SnapResult {
  const range = opts.objectRange ?? 100;
  const reach = expandBox(box, range);
  const near = opts.targets.filter((t) => boxesOverlap(reach, t.box));
  const walls = opts.walls.filter((w) => {
    // Only walls beside the box: its extent along the wall must overlap the wall.
    const [lo, hi] = w.orientation === 'vertical' ? [box.minY, box.maxY] : [box.minX, box.maxX];
    const [rLo, rHi] = w.orientation === 'vertical' ? [reach.minX, reach.maxX] : [reach.minY, reach.maxY];
    return Math.min(hi, w.span[1]) - Math.max(lo, w.span[0]) > 0.01 && w.position >= rLo && w.position <= rHi;
  });

  const x = bestCandidate(axisCandidates('x', box, walls, near), opts.threshold);
  const y = bestCandidate(axisCandidates('y', box, walls, near), opts.threshold);

  let dx = x?.delta ?? 0;
  let dy = y?.delta ?? 0;
  if (opts.grid) {
    const origin = opts.gridOrigin ?? { x: 0, y: 0 };
    if (!x) dx = snapValue(box.minX, opts.grid, origin.x) - box.minX;
    if (!y) dy = snapValue(box.minY, opts.grid, origin.y) - box.minY;
  }

  return { dx, dy, guides: guidesFor(box, dx, dy, x, y) };
}

/** Guide lines for the winning candidates, spanning both the moved box and the target. */
export function guidesFor(box: Box, dx: number, dy: number, x: Candidate | null, y: Candidate | null): SnapGuide[] {
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
  return guides;
}

function axisCandidates(axis: 'x' | 'y', box: Box, walls: readonly WallLine[], near: readonly SnapTarget[]): Candidate[] {
  const min = axis === 'x' ? box.minX : box.minY;
  const max = axis === 'x' ? box.maxX : box.maxY;
  const center = (min + max) / 2;
  const out: Candidate[] = [];

  for (const w of walls) {
    if ((w.orientation === 'vertical') !== (axis === 'x')) continue;
    // A wall with the room on its high side (left or top wall) attracts the box's low edge.
    out.push({ delta: w.position - (w.inward === 1 ? min : max), kind: 'wall', position: w.position, span: w.span });
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

/** The candidate with the smallest move within `threshold`; walls win ties. */
export function bestCandidate(candidates: readonly Candidate[], threshold: number): Candidate | null {
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
