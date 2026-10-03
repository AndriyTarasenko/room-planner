/**
 * Domain rules that decide what counts as a problem. Geometry answers "do these shapes
 * overlap?", these rules answer "should the user care?".
 */
import { worldParts } from '../geometry/footprint';
import { pointInConvexPolygon } from '../geometry/polygon';
import type { FurnitureItem, FurnitureType } from '../types';

const DESK_TYPES: ReadonlySet<FurnitureType> = new Set(['desk', 'sit-stand-desk', 'l-desk']);
const HOST_TYPES: ReadonlySet<FurnitureType> = new Set([...DESK_TYPES, 'table', 'sideboard', 'shelf', 'kitchen-cabinet', 'generic']);

export const isDesk = (item: Pick<FurnitureItem, 'type'>) => DESK_TYPES.has(item.type);

/**
 * Items that monitors and other surface items can stand on. Objects that go on the floor or
 * on furniture (a plant, a lamp) are small things themselves, not somewhere to put others.
 */
export const canHostSurfaceItems = (item: FurnitureItem) =>
  item.placement === 'floor' && !item.flexiblePlacement && HOST_TYPES.has(item.type);

/** Whether dropping an item can put it onto furniture: surface items and floor-or-furniture items. */
export const goesOnHosts = (item: Pick<FurnitureItem, 'placement' | 'flexiblePlacement'>) =>
  item.placement === 'surface' || item.flexiblePlacement;

/**
 * Where a new surface item goes when it wasn't dropped onto a host and no host is selected:
 * a TV onto a TV bench, kitchen items (microwave, wall cabinet) onto a kitchen counter, and
 * everything else (monitors, consoles) onto the first desk.
 */
export function defaultHost(item: FurnitureItem, items: readonly FurnitureItem[]): FurnitureItem | null {
  const hosts = items.filter((i) => i.id !== item.id && canHostSurfaceItems(i));
  if (item.type === 'tv') return hosts.find((i) => /\btv\b/i.test(i.name)) ?? null;
  if (item.category === 'kitchen') return hosts.find((i) => i.type === 'kitchen-cabinet') ?? null;
  return hosts.find(isDesk) ?? null;
}

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

/** Floor furniture in a door's swing keeps the door from opening; monitors on a desk don't. */
export const canBlockDoor = (item: FurnitureItem) => item.placement === 'floor' && !item.ignoreCollisions;

/** Topmost host item whose footprint contains the center of `item`. */
export function findHostUnder(item: FurnitureItem, items: readonly FurnitureItem[]): FurnitureItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const candidate = items[i];
    if (candidate.id === item.id || !canHostSurfaceItems(candidate)) continue;
    if (worldParts(candidate).some((poly) => pointInConvexPolygon({ x: item.x, y: item.y }, poly))) return candidate;
  }
  return null;
}
