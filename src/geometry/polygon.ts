import { type Point, boxOfPoints } from './rect';

/** A polygon as a list of vertices (either winding). Convex unless a function says otherwise. */
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

/* ───────── Simple (possibly concave) polygons: room floors ───────── */

export function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const q = closestPointOnSegment(p, a, b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Distance from `p` to the nearest edge of a polygon. */
export function distanceToBoundary(p: Point, poly: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distanceToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}

/** Point-in-polygon for any simple polygon (even–odd rule). Points within `eps` of an edge count as inside. */
export function pointInPolygon(p: Point, poly: readonly Point[], eps = 0): boolean {
  if (eps > 0 && distanceToBoundary(p, poly) <= eps) return true;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** True when segments ab and cd share at least one point. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point, eps = 1e-9): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
  const onSegment = (p: Point, q: Point, r: Point) =>
    Math.min(p.x, q.x) - eps <= r.x && r.x <= Math.max(p.x, q.x) + eps && Math.min(p.y, q.y) - eps <= r.y && r.y <= Math.max(p.y, q.y) + eps;
  if (Math.abs(d1) <= eps && onSegment(c, d, a)) return true;
  if (Math.abs(d2) <= eps && onSegment(c, d, b)) return true;
  if (Math.abs(d3) <= eps && onSegment(a, b, c)) return true;
  if (Math.abs(d4) <= eps && onSegment(a, b, d)) return true;
  return false;
}

/**
 * True for a polygon whose edges only meet at shared corners: at least three corners, no
 * edge shorter than `minEdge`, no edge crossing or touching a non-adjacent one, and no edge
 * folding back onto its neighbor.
 */
export function isSimplePolygon(poly: readonly Point[], minEdge = 1e-6): boolean {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if (Math.hypot(b.x - a.x, b.y - a.y) < minEdge) return false;
  }
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    // Adjacent edges only share their corner; folding back would make them overlap.
    const c = poly[(i + 2) % n];
    if (Math.abs(cross(a, b, c)) < 1e-9 && (c.x - b.x) * (a.x - b.x) + (c.y - b.y) * (a.y - b.y) > 0) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsIntersect(a, b, poly[j], poly[(j + 1) % n])) return false;
    }
  }
  return true;
}

/**
 * Area of the part of `subject` (any simple polygon) that lies inside the convex polygon `clip`.
 * Clipping a concave subject can leave zero-width bridges in the result; they add no area.
 */
export function intersectionArea(subject: Polygon, clip: Polygon): number {
  return polygonArea(clipConvexPolygon(subject, clip));
}

/** Intersection of the infinite lines through ab and cd, or null when they are parallel. */
export function lineIntersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-12) return null;
  const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / den;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/**
 * A convex polygon shrunk by `d` on every side, or null when nothing is left. Used as a
 * tolerance: a shape that pokes less than `d` out of a room still counts as inside.
 */
export function insetConvexPolygon(poly: Polygon, d: number): Polygon | null {
  if (d <= 0) return poly;
  const n = poly.length;
  const sign = signedArea(poly) > 0 ? 1 : -1;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (sign * -(b.y - a.y)) / len;
    const ny = (sign * (b.x - a.x)) / len;
    return { a: { x: a.x + nx * d, y: a.y + ny * d }, b: { x: b.x + nx * d, y: b.y + ny * d } };
  });
  const out: Polygon = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i + n - 1) % n];
    const cur = lines[i];
    out.push(lineIntersection(prev.a, prev.b, cur.a, cur.b) ?? cur.a);
  }
  const area = signedArea(out);
  return area * sign > 1e-9 && Math.abs(area) < Math.abs(signedArea(poly)) + 1e-9 ? out : null;
}

/** How far `p` can travel along the unit vector `dir` before it reaches an edge of the polygon (Infinity if never). */
export function rayToBoundary(p: Point, dir: Point, poly: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = dir.x * ey - dir.y * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
    const u = ((a.x - p.x) * dir.y - (a.y - p.y) * dir.x) / den;
    if (t >= -1e-9 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, Math.max(0, t));
  }
  return best;
}

/**
 * The point inside a polygon farthest from its edges (the "pole of inaccessibility"), found
 * to within `precision` cm by subdividing cells. That is where a label fits best, and unlike
 * the centroid of an L-shaped room it always lies inside.
 */
export function poleOfInaccessibility(poly: readonly Point[], precision = 1): { point: Point; distance: number } {
  const box = boxOfPoints(poly);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const size = Math.min(width, height);
  if (!(size > 0)) return { point: { x: box.minX, y: box.minY }, distance: 0 };
  const cell = (x: number, y: number, h: number) => {
    const p = { x, y };
    const d = (pointInPolygon(p, poly) ? 1 : -1) * distanceToBoundary(p, poly);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  let best = cell(box.minX + width / 2, box.minY + height / 2, 0);
  const h0 = size / 2;
  const queue: ReturnType<typeof cell>[] = [];
  for (let x = box.minX; x < box.maxX; x += size) {
    for (let y = box.minY; y < box.maxY; y += size) queue.push(cell(x + h0, y + h0, h0));
  }
  for (let guard = 0; queue.length > 0 && guard < 4000; guard++) {
    let top = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[top].max) top = i;
    const c = queue.splice(top, 1)[0];
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    const h = c.h / 2;
    queue.push(cell(c.x - h, c.y - h, h), cell(c.x + h, c.y - h, h), cell(c.x - h, c.y + h, h), cell(c.x + h, c.y + h, h));
  }
  return { point: { x: best.x, y: best.y }, distance: Math.max(0, best.d) };
}
