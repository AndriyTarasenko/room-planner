import type { FurnitureItem, Shape } from '../types';
import { type Box, type Point, boxOfPoints, isQuarterTurn, localToWorld, rotatedSize } from './rect';
import type { Polygon } from './polygon';

/** The subset of an item that determines where it is on the floor plan. */
export type Footprint = Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'shape'>;

/** Axis-aligned rectangle in the item's local frame (origin at the item center). */
export interface LocalRect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

const RECT: Shape = { kind: 'rect' };

/** Clamps the L-shape segment depth to something that still forms an L. */
export function lSegment(width: number, depth: number, segment: number): number {
  return Math.max(1, Math.min(segment, depth - 1, width - 1));
}

/**
 * Vertices of the polygon standing in for a round footprint. It is inscribed in the ellipse
 * and has a vertex at each end of both axes, so it touches the same box sides and never
 * reports a collision the real shape wouldn't have; with 48 vertices it is within 0.25% of
 * the radius everywhere.
 */
const ROUND_SEGMENTS = 48;

function ellipsePolygon(width: number, depth: number): Polygon {
  return Array.from({ length: ROUND_SEGMENTS }, (_, i) => {
    const a = (i / ROUND_SEGMENTS) * Math.PI * 2;
    return { x: (Math.cos(a) * width) / 2, y: (Math.sin(a) * depth) / 2 };
  });
}

/**
 * The footprint split into convex polygons in local coordinates. Plain furniture is one
 * rectangle, an L-shaped desk is two, and round furniture one many-sided polygon.
 */
export function localParts(f: Pick<Footprint, 'width' | 'depth' | 'shape'>): Polygon[] {
  const shape = f.shape ?? RECT;
  const hw = f.width / 2;
  const hd = f.depth / 2;
  if (shape.kind === 'round') return [ellipsePolygon(f.width, f.depth)];
  if (shape.kind === 'l') {
    const s = lSegment(f.width, f.depth, shape.segment);
    const main: LocalRect = { x: -hw, y: -hd, width: f.width, depth: s };
    const legX = shape.returnSide === 'right' ? hw - s : -hw;
    const leg: LocalRect = { x: legX, y: -hd + s, width: s, depth: f.depth - s };
    return [localRectPolygon(main), localRectPolygon(leg)];
  }
  return [localRectPolygon({ x: -hw, y: -hd, width: f.width, depth: f.depth })];
}

/** Outline polygon in local coordinates, used for rendering. */
export function localOutline(f: Pick<Footprint, 'width' | 'depth' | 'shape'>): Point[] {
  const shape = f.shape ?? RECT;
  const hw = f.width / 2;
  const hd = f.depth / 2;
  if (shape.kind === 'round') return ellipsePolygon(f.width, f.depth);
  if (shape.kind === 'l') {
    const s = lSegment(f.width, f.depth, shape.segment);
    if (shape.returnSide === 'right') {
      return [
        { x: -hw, y: -hd },
        { x: hw, y: -hd },
        { x: hw, y: hd },
        { x: hw - s, y: hd },
        { x: hw - s, y: -hd + s },
        { x: -hw, y: -hd + s },
      ];
    }
    return [
      { x: -hw, y: -hd },
      { x: hw, y: -hd },
      { x: hw, y: -hd + s },
      { x: -hw + s, y: -hd + s },
      { x: -hw + s, y: hd },
      { x: -hw, y: hd },
    ];
  }
  return [
    { x: -hw, y: -hd },
    { x: hw, y: -hd },
    { x: hw, y: hd },
    { x: -hw, y: hd },
  ];
}

export function localRectPolygon(r: LocalRect): Polygon {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.depth },
    { x: r.x, y: r.y + r.depth },
  ];
}

export function frameOf(f: Pick<Footprint, 'x' | 'y' | 'rotation'>) {
  return { x: f.x, y: f.y, rotation: f.rotation };
}

/** Convex world-space polygons that together make up the footprint. */
export function worldParts(f: Footprint): Polygon[] {
  const frame = frameOf(f);
  return localParts(f).map((part) => part.map((p) => localToWorld(p, frame)));
}

/** Width and depth of the box around an ellipse turned by `rotation` degrees. */
function ellipseExtent(width: number, depth: number, rotation: number): { width: number; depth: number } {
  if (width === depth) return { width, depth };
  if (isQuarterTurn(rotation)) return rotatedSize(width, depth, rotation);
  const a = (rotation * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { width: 2 * Math.hypot((width / 2) * c, (depth / 2) * s), depth: 2 * Math.hypot((width / 2) * s, (depth / 2) * c) };
}

export function footprintBox(f: Footprint): Box {
  if (f.shape?.kind === 'round') {
    // Exact extent of the rotated ellipse, so sizes and wall distances don't depend on the polygon.
    const { width, depth } = ellipseExtent(f.width, f.depth, f.rotation);
    return { minX: f.x - width / 2, minY: f.y - depth / 2, maxX: f.x + width / 2, maxY: f.y + depth / 2 };
  }
  return boxOfPoints(worldParts(f).flat());
}

/**
 * Whether the footprint touches each side of its bounding box in the middle, so dimension
 * lines can run through the item center: rectangles and ovals turned by a multiple of 90°,
 * and circles at any angle.
 */
export function touchesBoxMidpoints(f: Pick<Footprint, 'width' | 'depth' | 'rotation' | 'shape'>): boolean {
  if (f.shape.kind === 'l') return false;
  return isQuarterTurn(f.rotation) || (f.shape.kind === 'round' && f.width === f.depth);
}

/** A circle (not an oval), whose size is one diameter. */
export const isCircle = (f: Pick<Footprint, 'width' | 'depth' | 'shape'>) => f.shape.kind === 'round' && f.width === f.depth;
