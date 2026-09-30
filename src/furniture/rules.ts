/**
 * Domain rules that decide what counts as a problem. Geometry answers "do these shapes
 * overlap?", these rules answer "should the user care?".
 */
import { worldParts } from '../geometry/footprint';
import { pointInConvexPolygon } from '../geometry/polygon';
import type { FurnitureItem, FurnitureType } from '../types';

const DESK_TYPES: ReadonlySet<FurnitureType> = new Set(['desk', 'sit-stand-desk', 'l-desk']);
const HOST_TYPES: ReadonlySet<FurnitureType> = new Set([...DESK_TYPES, 'sideboard', 'shelf', 'generic']);

export const isDesk = (item: Pick<FurnitureItem, 'type'>) => DESK_TYPES.has(item.type);

/** Items that monitors and other surface items can stand on. */
export const canHostSurfaceItems = (item: FurnitureItem) => item.placement === 'floor' && HOST_TYPES.has(item.type);

/** Floor items collide with floor items, surface items with surface items. */
export function canCollide(a: FurnitureItem, b: FurnitureItem): boolean {
  return a.placement === b.placement && !a.ignoreCollisions && !b.ignoreCollisions;
}

/** Whether `other` standing in `owner`'s clearance zone is worth a warning. */
export function canIntrudeClearance(owner: FurnitureItem, other: FurnitureItem): boolean {
  if (other.id === owner.id || other.placement !== 'floor' || other.ignoreCollisions) return false;
  if (other.attachedTo === owner.id || owner.attachedTo === other.id) return false;
  // The seating zone in front of a desk exists for the chair.
  if (isDesk(owner) && other.category === 'seating') return false;
  return true;
}

/** Topmost host item whose footprint contains the center of `item`. */
export function findHostUnder(item: FurnitureItem, items: readonly FurnitureItem[]): FurnitureItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const candidate = items[i];
    if (candidate.id === item.id || !canHostSurfaceItems(candidate)) continue;
    if (worldParts(candidate).some((poly) => pointInConvexPolygon({ x: item.x, y: item.y }, poly))) return candidate;
  }
  return null;
}
