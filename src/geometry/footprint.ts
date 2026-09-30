import type { FurnitureItem, Shape } from '../types';
import { type Box, type Point, boxOfPoints, localToWorld } from './rect';
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
 * The footprint split into convex rectangles in local coordinates.
 * Plain furniture is one rectangle, an L-shaped desk is two.
 */
export function localParts(f: Pick<Footprint, 'width' | 'depth' | 'shape'>): LocalRect[] {
  const shape = f.shape ?? RECT;
  const hw = f.width / 2;
  const hd = f.depth / 2;
  if (shape.kind === 'l') {
    const s = lSegment(f.width, f.depth, shape.segment);
    const main: LocalRect = { x: -hw, y: -hd, width: f.width, depth: s };
    const legX = shape.returnSide === 'right' ? hw - s : -hw;
    const leg: LocalRect = { x: legX, y: -hd + s, width: s, depth: f.depth - s };
    return [main, leg];
  }
  return [{ x: -hw, y: -hd, width: f.width, depth: f.depth }];
}

/** Outline polygon in local coordinates, used for rendering. */
export function localOutline(f: Pick<Footprint, 'width' | 'depth' | 'shape'>): Point[] {
  const shape = f.shape ?? RECT;
  const hw = f.width / 2;
  const hd = f.depth / 2;
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
  return localParts(f).map((r) => localRectPolygon(r).map((p) => localToWorld(p, frame)));
}

export function footprintBox(f: Footprint): Box {
  return boxOfPoints(worldParts(f).flat());
}
