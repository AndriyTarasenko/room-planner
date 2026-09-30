import { type Footprint, footprintBox, worldParts } from './footprint';
import { type Polygon, clipConvexPolygon, convexPolygonsOverlap, polygonArea } from './polygon';
import { boxesOverlap } from './rect';

export interface Collidable extends Footprint {
  id: string;
}

export interface Collision {
  a: string;
  b: string;
  /** Overlapping regions in world coordinates (one per overlapping part pair). */
  regions: Polygon[];
  area: number;
}

/** Minimum overlap depth (cm) before two footprints count as colliding. */
export const COLLISION_EPSILON = 0.05;

export function polygonSetsOverlap(a: Polygon[], b: Polygon[], epsilon = COLLISION_EPSILON): boolean {
  return a.some((pa) => b.some((pb) => convexPolygonsOverlap(pa, pb, epsilon)));
}

export function footprintsOverlap(a: Footprint, b: Footprint, epsilon = COLLISION_EPSILON): boolean {
  if (!boxesOverlap(footprintBox(a), footprintBox(b), epsilon)) return false;
  return polygonSetsOverlap(worldParts(a), worldParts(b), epsilon);
}

export function overlapRegions(a: Polygon[], b: Polygon[], epsilon = COLLISION_EPSILON): Polygon[] {
  const regions: Polygon[] = [];
  for (const pa of a) {
    for (const pb of b) {
      if (!convexPolygonsOverlap(pa, pb, epsilon)) continue;
      const clipped = clipConvexPolygon(pa, pb);
      if (clipped.length >= 3) regions.push(clipped);
    }
  }
  return regions;
}

/**
 * All pairs of overlapping items. `canCollide` lets the caller apply domain rules
 * (e.g. monitors on a desk are not a collision).
 */
export function findCollisions<T extends Collidable>(
  items: readonly T[],
  canCollide: (a: T, b: T) => boolean = () => true,
): Collision[] {
  const prepared = items.map((item) => ({ item, box: footprintBox(item), parts: worldParts(item) }));
  const result: Collision[] = [];
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const A = prepared[i];
      const B = prepared[j];
      if (!boxesOverlap(A.box, B.box, COLLISION_EPSILON)) continue;
      if (!canCollide(A.item, B.item)) continue;
      const regions = overlapRegions(A.parts, B.parts);
      if (regions.length === 0) continue;
      result.push({
        a: A.item.id,
        b: B.item.id,
        regions,
        area: regions.reduce((sum, r) => sum + polygonArea(r), 0),
      });
    }
  }
  return result;
}
