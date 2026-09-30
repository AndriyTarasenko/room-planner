import type { Point } from './rect';

/** Convex polygon as a list of vertices (either winding). */
export type Polygon = Point[];

/**
 * Separating axis test for two convex polygons.
 * Returns true only when they overlap by more than `epsilon` along every axis,
 * so furniture placed exactly edge-to-edge is not reported as colliding.
 */
export function convexPolygonsOverlap(a: Polygon, b: Polygon, epsilon = 0.01): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      const nx = -(p2.y - p1.y);
      const ny = p2.x - p1.x;
      const len = Math.hypot(nx, ny);
      if (len === 0) continue;
      const ax = nx / len;
      const ay = ny / len;
      const [minA, maxA] = project(a, ax, ay);
      const [minB, maxB] = project(b, ax, ay);
      const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (overlap <= epsilon) return false;
    }
  }
  return true;
}

function project(poly: Polygon, ax: number, ay: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax + p.y * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Signed area (positive for clockwise winding in y-down coordinates). */
export function signedArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonArea(poly: Polygon): number {
  return Math.abs(signedArea(poly));
}

/** Point-in-convex-polygon test (boundary counts as inside). */
export function pointInConvexPolygon(p: Point, poly: Polygon): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Sutherland–Hodgman clipping of a convex subject polygon by a convex clip polygon.
 * Used to draw the actual overlap region of colliding furniture.
 */
export function clipConvexPolygon(subject: Polygon, clip: Polygon): Polygon {
  const clockwise = signedArea(clip) > 0;
  let output = subject;
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p: Point) => {
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      return clockwise ? cross >= -1e-9 : cross <= 1e-9;
    };
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) output.push(intersect(prev, cur, a, b));
        output.push(cur);
      } else if (prevIn) {
        output.push(intersect(prev, cur, a, b));
      }
    }
  }
  return output;
}

function intersect(p1: Point, p2: Point, p3: Point, p4: Point): Point {
  const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(d) < 1e-12) return { x: p2.x, y: p2.y };
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}
