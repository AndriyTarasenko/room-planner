import { type FloorUsage, floorUsage, sumUsage } from '../geometry/area';
import { type ClearanceConflict, clearanceZones, findClearanceConflicts } from '../geometry/clearance';
import { type Collision, findCollisions, overlapRegions } from '../geometry/collision';
import { worldParts } from '../geometry/footprint';
import type { Polygon } from '../geometry/polygon';
import { doorSwingZones } from '../plan/openings';
import { isShapeOnFloor } from '../plan/rooms';
import type { FurnitureItem, Room } from '../types';
import { canBlockDoor, canCollide, canIntrudeClearance } from './rules';

export type IssueKind = 'collision' | 'clearance' | 'outside';

export interface Issue {
  kind: IssueKind;
  /** Item the issue is shown on. */
  itemId: string;
  /** The other item involved, if any. */
  otherId?: string;
  message: string;
}

/** Furniture standing where a door swings open. */
export interface DoorConflict {
  roomId: string;
  openingId: string;
  itemId: string;
  regions: Polygon[];
}

export interface LayoutAnalysis {
  collisions: Collision[];
  clearanceConflicts: ClearanceConflict[];
  doorConflicts: DoorConflict[];
  /** Items whose clearance zone runs through a wall (doors that can't open, a chair that can't roll back). */
  wallBlockedClearanceIds: ReadonlySet<string>;
  collidingIds: ReadonlySet<string>;
  /** Items whose clearance zone is blocked by furniture or a wall. */
  blockedClearanceIds: ReadonlySet<string>;
  /** Doors (opening ids) with furniture in their swing. */
  blockedDoorIds: ReadonlySet<string>;
  outsideIds: ReadonlySet<string>;
  /** Whole plan. */
  usage: FloorUsage;
  /** Per room id. */
  roomUsage: ReadonlyMap<string, FloorUsage>;
  issues: Issue[];
}

/** Floor items that stand in a door's swing. */
export function findDoorConflicts(items: readonly FurnitureItem[], rooms: readonly Room[]): DoorConflict[] {
  const zones = doorSwingZones(rooms);
  if (zones.length === 0) return [];
  const candidates = items.filter(canBlockDoor).map((item) => ({ item, parts: worldParts(item) }));
  const conflicts: DoorConflict[] = [];
  for (const zone of zones) {
    for (const { item, parts } of candidates) {
      const regions = overlapRegions([zone.polygon], parts);
      if (regions.length > 0) conflicts.push({ roomId: zone.room.id, openingId: zone.opening.id, itemId: item.id, regions });
    }
  }
  return conflicts;
}

/** "the Bedroom door", or "a Bedroom door" when the room has several. */
export function doorName(room: Room): string {
  const doors = room.openings.filter((o) => o.kind === 'door').length;
  return `${doors > 1 ? 'a' : 'the'} ${room.name} door`;
}

/** Everything the UI needs to know about problems in a layout, computed in one pass. */
export function analyzeLayout(items: readonly FurnitureItem[], rooms: readonly Room[]): LayoutAnalysis {
  const byId = new Map(items.map((i) => [i.id, i]));
  const name = (id: string) => byId.get(id)?.name || 'object';
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  const collisions = findCollisions(items, canCollide);
  const clearanceConflicts = findClearanceConflicts(items, canIntrudeClearance);
  const doorConflicts = findDoorConflicts(items, rooms);
  const outside = items.filter((i) => !isShapeOnFloor(worldParts(i), rooms));
  // Only judge the clearance of items that are themselves inside a room.
  const wallBlocked = items.filter(
    (i) => !outside.includes(i) && clearanceZones(i).some((z) => !isShapeOnFloor([z.polygon], rooms, 0.5)),
  );

  const issues: Issue[] = [];
  for (const c of collisions) {
    issues.push({ kind: 'collision', itemId: c.a, otherId: c.b, message: `Overlaps ${name(c.b)}` });
    issues.push({ kind: 'collision', itemId: c.b, otherId: c.a, message: `Overlaps ${name(c.a)}` });
  }
  for (const c of clearanceConflicts) {
    issues.push({ kind: 'clearance', itemId: c.ownerId, otherId: c.intruderId, message: `${name(c.intruderId)} is in the ${c.sides.join(' / ')} clearance` });
    issues.push({ kind: 'clearance', itemId: c.intruderId, otherId: c.ownerId, message: `Blocks clearance of ${name(c.ownerId)}` });
  }
  for (const c of doorConflicts) {
    const room = roomById.get(c.roomId);
    issues.push({ kind: 'clearance', itemId: c.itemId, message: `Blocks ${room ? doorName(room) : 'a door'}` });
  }
  for (const i of wallBlocked) issues.push({ kind: 'clearance', itemId: i.id, message: 'Clearance runs into a wall' });
  const outsideMessage = rooms.length === 1 ? 'Outside the room' : 'Not fully inside a room';
  for (const i of outside) issues.push({ kind: 'outside', itemId: i.id, message: outsideMessage });

  const floorFootprints = items.filter((i) => i.placement === 'floor').flatMap((i) => worldParts(i));
  const roomUsage = new Map(rooms.map((r) => [r.id, floorUsage(r.corners, floorFootprints)]));

  return {
    collisions,
    clearanceConflicts,
    doorConflicts,
    wallBlockedClearanceIds: new Set(wallBlocked.map((i) => i.id)),
    collidingIds: new Set(collisions.flatMap((c) => [c.a, c.b])),
    blockedClearanceIds: new Set([...clearanceConflicts.map((c) => c.ownerId), ...wallBlocked.map((i) => i.id)]),
    blockedDoorIds: new Set(doorConflicts.map((c) => c.openingId)),
    outsideIds: new Set(outside.map((i) => i.id)),
    usage: sumUsage([...roomUsage.values()]),
    roomUsage,
    issues,
  };
}

let cache: { items: readonly FurnitureItem[]; rooms: readonly Room[]; result: LayoutAnalysis } | null = null;

/** Memoized on the (immutable) items and rooms arrays, so many components can share one result. */
export function analyzeLayoutCached(items: readonly FurnitureItem[], rooms: readonly Room[]): LayoutAnalysis {
  if (cache && cache.items === items && cache.rooms === rooms) return cache.result;
  const result = analyzeLayout(items, rooms);
  cache = { items, rooms, result };
  return result;
}
