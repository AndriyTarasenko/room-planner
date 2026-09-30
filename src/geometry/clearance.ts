import type { Clearance } from '../types';
import { type Collidable, overlapRegions } from './collision';
import { type Footprint, frameOf, localRectPolygon, worldParts, type LocalRect } from './footprint';
import type { Polygon } from './polygon';
import { localToWorld } from './rect';

export type ClearanceSide = 'front' | 'back' | 'left' | 'right';
export const CLEARANCE_SIDES: readonly ClearanceSide[] = ['front', 'back', 'left', 'right'];

export interface ClearanceZone {
  side: ClearanceSide;
  polygon: Polygon;
}

export interface WithClearance extends Collidable {
  clearance: Clearance;
}

/**
 * Local-frame rectangles for each non-zero clearance side.
 * Front is +y (bottom edge at rotation 0), left is −x.
 */
export function localClearanceRects(width: number, depth: number, c: Clearance): { side: ClearanceSide; rect: LocalRect }[] {
  const hw = width / 2;
  const hd = depth / 2;
  const out: { side: ClearanceSide; rect: LocalRect }[] = [];
  if (c.front > 0) out.push({ side: 'front', rect: { x: -hw, y: hd, width, depth: c.front } });
  if (c.back > 0) out.push({ side: 'back', rect: { x: -hw, y: -hd - c.back, width, depth: c.back } });
  if (c.left > 0) out.push({ side: 'left', rect: { x: -hw - c.left, y: -hd, width: c.left, depth } });
  if (c.right > 0) out.push({ side: 'right', rect: { x: hw, y: -hd, width: c.right, depth } });
  return out;
}

export function clearanceZones(item: Footprint & { clearance: Clearance }): ClearanceZone[] {
  if (!item.clearance.enabled) return [];
  const frame = frameOf(item);
  return localClearanceRects(item.width, item.depth, item.clearance).map(({ side, rect }) => ({
    side,
    polygon: localRectPolygon(rect).map((p) => localToWorld(p, frame)),
  }));
}

export interface ClearanceConflict {
  ownerId: string;
  intruderId: string;
  sides: ClearanceSide[];
  regions: Polygon[];
}

/**
 * Items that stand inside another item's clearance zone. Not a physical collision,
 * just a hint that doors can't open or the chair can't roll back.
 */
export function findClearanceConflicts<T extends WithClearance>(
  items: readonly T[],
  canIntrude: (owner: T, other: T) => boolean = (owner, other) => owner.id !== other.id,
): ClearanceConflict[] {
  const parts = new Map(items.map((i) => [i.id, worldParts(i)]));
  const conflicts: ClearanceConflict[] = [];
  for (const owner of items) {
    const zones = clearanceZones(owner);
    if (zones.length === 0) continue;
    for (const other of items) {
      if (other.id === owner.id || !canIntrude(owner, other)) continue;
      const otherParts = parts.get(other.id)!;
      const sides: ClearanceSide[] = [];
      const regions: Polygon[] = [];
      for (const zone of zones) {
        const r = overlapRegions([zone.polygon], otherParts);
        if (r.length > 0) {
          sides.push(zone.side);
          regions.push(...r);
        }
      }
      if (sides.length > 0) conflicts.push({ ownerId: owner.id, intruderId: other.id, sides, regions });
    }
  }
  return conflicts;
}
