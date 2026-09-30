/** Basic 2D primitives. Pure functions, no knowledge of furniture or React. */

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned bounding box. */
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A rectangle of `width` × `depth` centered at (cx, cy), rotated clockwise by `rotation` degrees. */
export interface OrientedRect {
  cx: number;
  cy: number;
  width: number;
  depth: number;
  rotation: number;
}

/** Position + rotation of a local coordinate frame inside the room. */
export interface Frame {
  x: number;
  y: number;
  rotation: number;
}

const EPS = 1e-9;

export const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Normalizes an angle to [0, 360). */
export function normalizeAngle(deg: number): number {
  const r = deg % 360;
  const n = r < 0 ? r + 360 : r;
  // Avoid -0 and floating noise like 359.9999999.
  return Math.abs(n - 360) < 1e-7 ? 0 : n === 0 ? 0 : n;
}

/** True for rotations of 0, 90, 180, 270 (within a small tolerance). */
export function isQuarterTurn(deg: number, tolerance = 0.01): boolean {
  const n = normalizeAngle(deg) % 90;
  return n < tolerance || 90 - n < tolerance;
}

export function rotateVector(p: Point, deg: number): Point {
  if (deg === 0) return { x: p.x, y: p.y };
  const r = toRadians(deg);
  const cos = cleanTrig(Math.cos(r));
  const sin = cleanTrig(Math.sin(r));
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** Snaps sin/cos values that are effectively 0 or ±1 so quarter turns stay exact. */
function cleanTrig(v: number): number {
  if (Math.abs(v) < EPS) return 0;
  if (Math.abs(v - 1) < EPS) return 1;
  if (Math.abs(v + 1) < EPS) return -1;
  return v;
}

export function localToWorld(p: Point, frame: Frame): Point {
  const r = rotateVector(p, frame.rotation);
  return { x: r.x + frame.x, y: r.y + frame.y };
}

export function worldToLocal(p: Point, frame: Frame): Point {
  return rotateVector({ x: p.x - frame.x, y: p.y - frame.y }, -frame.rotation);
}

/** Corners in local order: top-left, top-right, bottom-right, bottom-left (before rotation). */
export function rectCorners(r: OrientedRect): Point[] {
  const hw = r.width / 2;
  const hd = r.depth / 2;
  const frame = { x: r.cx, y: r.cy, rotation: r.rotation };
  return [
    localToWorld({ x: -hw, y: -hd }, frame),
    localToWorld({ x: hw, y: -hd }, frame),
    localToWorld({ x: hw, y: hd }, frame),
    localToWorld({ x: -hw, y: hd }, frame),
  ];
}

export function boxOfPoints(points: readonly Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function unionBoxes(boxes: readonly Box[]): Box {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

export function rectAABB(r: OrientedRect): Box {
  return boxOfPoints(rectCorners(r));
}

/** Size of the axis-aligned bounding box of a rotated `width` × `depth` rectangle. */
export function rotatedSize(width: number, depth: number, rotation: number): { width: number; depth: number } {
  const r = toRadians(rotation);
  const cos = Math.abs(cleanTrig(Math.cos(r)));
  const sin = Math.abs(cleanTrig(Math.sin(r)));
  return { width: width * cos + depth * sin, depth: width * sin + depth * cos };
}

export const boxWidth = (b: Box) => b.maxX - b.minX;
export const boxHeight = (b: Box) => b.maxY - b.minY;
export const boxCenter = (b: Box): Point => ({ x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });

export function translateBox(b: Box, dx: number, dy: number): Box {
  return { minX: b.minX + dx, minY: b.minY + dy, maxX: b.maxX + dx, maxY: b.maxY + dy };
}

export function expandBox(b: Box, amount: number): Box {
  return { minX: b.minX - amount, minY: b.minY - amount, maxX: b.maxX + amount, maxY: b.maxY + amount };
}

/** Strict overlap (touching edges do not count). */
export function boxesOverlap(a: Box, b: Box, epsilon = 0): boolean {
  return a.minX < b.maxX - epsilon && b.minX < a.maxX - epsilon && a.minY < b.maxY - epsilon && b.minY < a.maxY - epsilon;
}
