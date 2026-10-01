import {
  type Polygon,
  insetConvexPolygon,
  intersectionArea,
  pointInPolygon,
  poleOfInaccessibility,
  polygonArea,
  signedArea,
} from './polygon';
import { type Box, type Point, boxOfPoints } from './rect';

/** An axis-aligned rectangle: top-left corner and size. */
export interface RoomRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** Tolerance for floating point noise when checking room bounds. */
const BOUNDS_EPS = 0.01;

export const roomBox = (r: RoomRect): Box => ({ minX: r.x, minY: r.y, maxX: r.x + r.width, maxY: r.y + r.depth });

export const roomCenter = (r: RoomRect): Point => ({ x: r.x + r.width / 2, y: r.y + r.depth / 2 });

export const rectPolygon = (r: RoomRect): Polygon => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.depth },
  { x: r.x, y: r.y + r.depth },
];

export const boxPolygon = (b: Box): Polygon => rectPolygon({ x: b.minX, y: b.minY, width: b.maxX - b.minX, depth: b.maxY - b.minY });

/** The rectangle a polygon describes, or null when it is not an axis-aligned rectangle. */
export function polygonRect(poly: readonly Point[], eps = 1e-9): RoomRect | null {
  if (poly.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % 4];
    const horizontal = Math.abs(a.y - b.y) <= eps;
    const vertical = Math.abs(a.x - b.x) <= eps;
    if (horizontal === vertical) return null;
  }
  const b = boxOfPoints(poly);
  return { x: b.minX, y: b.minY, width: b.maxX - b.minX, depth: b.maxY - b.minY };
}

export function isBoxInsideRoom(box: Box, room: RoomRect, eps = BOUNDS_EPS): boolean {
  return (
    box.minX >= room.x - eps &&
    box.minY >= room.y - eps &&
    box.maxX <= room.x + room.width + eps &&
    box.maxY <= room.y + room.depth + eps
  );
}

/**
 * Translation that moves `box` back inside the room. If the box is larger than the room
 * along an axis it is aligned to the top/left wall on that axis.
 */
export function clampOffsetToRoom(box: Box, room: RoomRect): { dx: number; dy: number } {
  return {
    dx: clampAxis(box.minX, box.maxX, room.x, room.x + room.width),
    dy: clampAxis(box.minY, box.maxY, room.y, room.y + room.depth),
  };
}

function clampAxis(min: number, max: number, lo: number, hi: number): number {
  if (max - min >= hi - lo) return lo - min;
  if (min < lo) return lo - min;
  if (max > hi) return hi - max;
  return 0;
}

/**
 * Share of a convex shape covered by the given floors, compared with its own area. The shape
 * is shrunk by `eps` first, so touching or poking less than `eps` past an edge still counts.
 */
function coversShape(floors: readonly (readonly Point[])[], part: Polygon, eps: number): boolean {
  const inner = insetConvexPolygon(part, eps);
  if (!inner) {
    const c = centroidOf(part);
    return floors.some((f) => pointInPolygon(c, f, eps));
  }
  const area = polygonArea(inner);
  let covered = 0;
  for (const floor of floors) {
    covered += intersectionArea(floor as Polygon, inner);
    if (covered >= area * (1 - 1e-9) - 1e-6) return true;
  }
  return false;
}

const centroidOf = (poly: readonly Point[]): Point => ({
  x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
  y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
});

/**
 * True when every convex part lies on the given floors (the union of them, so a shape may
 * span two rooms joined by an open wall). Floors are simple polygons, concave ones included.
 */
export function isShapeOnFloors(parts: readonly Polygon[], floors: readonly (readonly Point[])[], eps = BOUNDS_EPS): boolean {
  return parts.every((part) => coversShape(floors, part, eps));
}

const translate = (parts: readonly Polygon[], dx: number, dy: number) => parts.map((part) => part.map((p) => ({ x: p.x + dx, y: p.y + dy })));

/**
 * Translation that moves a shape (convex parts) inside a polygon: the shortest push out of
 * the walls it pokes through. Rectangles use the exact axis clamp; other polygons try the
 * push through each edge on its own and through pairs of edges (for corners), shortest first.
 */
export function clampShapeIntoPolygon(parts: readonly Polygon[], poly: readonly Point[]): { dx: number; dy: number } {
  const rect = polygonRect(poly);
  const points = parts.flat();
  const box = boxOfPoints(points);
  if (rect) return clampOffsetToRoom(box, rect);
  const floors = [poly];
  const fits = (dx: number, dy: number) => isShapeOnFloors(translate(parts, dx, dy), floors);
  if (fits(0, 0)) return { dx: 0, dy: 0 };

  const tryPushes = (dx0: number, dy0: number): { dx: number; dy: number } | null => {
    const moved = points.map((p) => ({ x: p.x + dx0, y: p.y + dy0 }));
    const reach = Math.max(box.maxX - box.minX, box.maxY - box.minY);
    const clockwise = signedArea(poly as Polygon) > 0 ? 1 : -1;
    const pushes: { n: Point; depth: number }[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) continue;
      const along = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const n = { x: -along.y * clockwise, y: along.x * clockwise };
      let depth = 0;
      for (const v of moved) {
        const t = (v.x - a.x) * along.x + (v.y - a.y) * along.y;
        if (t < -reach || t > len + reach) continue;
        const s = (v.x - a.x) * n.x + (v.y - a.y) * n.y;
        if (-s > depth) depth = -s;
      }
      if (depth > 1e-9) pushes.push({ n, depth });
    }
    const candidates: Point[] = pushes.map(({ n, depth }) => ({ x: n.x * depth, y: n.y * depth }));
    for (let i = 0; i < pushes.length; i++) {
      for (let j = i + 1; j < pushes.length; j++) {
        const p = pushes[i];
        const q = pushes[j];
        const det = p.n.x * q.n.y - p.n.y * q.n.x;
        if (Math.abs(det) < 1e-6) continue;
        candidates.push({ x: (p.depth * q.n.y - q.depth * p.n.y) / det, y: (p.n.x * q.depth - q.n.x * p.depth) / det });
      }
    }
    candidates.sort((u, v) => Math.hypot(u.x, u.y) - Math.hypot(v.x, v.y));
    for (const c of candidates) {
      if (fits(dx0 + c.x, dy0 + c.y)) return { dx: dx0 + c.x, dy: dy0 + c.y };
    }
    return null;
  };

  const direct = tryPushes(0, 0);
  if (direct) return direct;
  // Far outside, or wedged in a corner: first into the polygon's bounding box, then out of the walls.
  const bounds = boxOfPoints(poly);
  const inBox = clampOffsetToRoom(box, { x: bounds.minX, y: bounds.minY, width: bounds.maxX - bounds.minX, depth: bounds.maxY - bounds.minY });
  if (fits(inBox.dx, inBox.dy)) return inBox;
  return tryPushes(inBox.dx, inBox.dy) ?? inBox;
}

const labelPoints = new WeakMap<readonly Point[], { point: Point; radius: number }>();

/**
 * Where a room's label and move handle go, and how far that point is from the nearest wall:
 * the center of a rectangle, or the point deepest inside any other shape. Cached per corner
 * array, which is immutable.
 */
export function polygonLabelPoint(poly: readonly Point[]): { point: Point; radius: number } {
  const cached = labelPoints.get(poly);
  if (cached) return cached;
  const rect = polygonRect(poly);
  const result = rect
    ? { point: roomCenter(rect), radius: Math.min(rect.width, rect.depth) / 2 }
    : (() => {
        const pole = poleOfInaccessibility(poly, 0.5);
        return { point: pole.point, radius: pole.distance };
      })();
  labelPoints.set(poly, result);
  return result;
}
