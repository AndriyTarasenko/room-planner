import { floorUsage, type FloorUsage } from '../geometry/area';
import { isBoxInsideRoom } from '../geometry/bounds';
import { type ClearanceConflict, clearanceZones, findClearanceConflicts } from '../geometry/clearance';
import { type Collision, findCollisions } from '../geometry/collision';
import { footprintBox, worldParts } from '../geometry/footprint';
import { boxOfPoints } from '../geometry/rect';
import type { FurnitureItem, Room } from '../types';
import { canCollide, canIntrudeClearance } from './rules';

export type IssueKind = 'collision' | 'clearance' | 'outside';

export interface Issue {
  kind: IssueKind;
  /** Item the issue is shown on. */
  itemId: string;
  /** The other item involved, if any. */
  otherId?: string;
  message: string;
}

export interface LayoutAnalysis {
  collisions: Collision[];
  clearanceConflicts: ClearanceConflict[];
  /** Items whose clearance zone runs through a wall (doors that can't open, a chair that can't roll back). */
  wallBlockedClearanceIds: ReadonlySet<string>;
  collidingIds: ReadonlySet<string>;
  /** Items whose clearance zone is blocked by furniture or a wall. */
  blockedClearanceIds: ReadonlySet<string>;
  outsideIds: ReadonlySet<string>;
  usage: FloorUsage;
  issues: Issue[];
}

/** Everything the UI needs to know about problems in a layout, computed in one pass. */
export function analyzeLayout(items: readonly FurnitureItem[], room: Room): LayoutAnalysis {
  const byId = new Map(items.map((i) => [i.id, i]));
  const name = (id: string) => byId.get(id)?.name || 'object';

  const collisions = findCollisions(items, canCollide);
  const clearanceConflicts = findClearanceConflicts(items, canIntrudeClearance);
  const outside = items.filter((i) => !isBoxInsideRoom(footprintBox(i), room));
  // Only judge the clearance of items that are themselves inside the room.
  const wallBlocked = items.filter(
    (i) => !outside.includes(i) && clearanceZones(i).some((z) => !isBoxInsideRoom(boxOfPoints(z.polygon), room, 0.5)),
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
  for (const i of wallBlocked) issues.push({ kind: 'clearance', itemId: i.id, message: 'Clearance runs into a wall' });
  for (const i of outside) issues.push({ kind: 'outside', itemId: i.id, message: 'Outside the room' });

  const floorFootprints = items.filter((i) => i.placement === 'floor').flatMap((i) => worldParts(i));

  return {
    collisions,
    clearanceConflicts,
    wallBlockedClearanceIds: new Set(wallBlocked.map((i) => i.id)),
    collidingIds: new Set(collisions.flatMap((c) => [c.a, c.b])),
    blockedClearanceIds: new Set([...clearanceConflicts.map((c) => c.ownerId), ...wallBlocked.map((i) => i.id)]),
    outsideIds: new Set(outside.map((i) => i.id)),
    usage: floorUsage(room, floorFootprints),
    issues,
  };
}

let cache: { items: readonly FurnitureItem[]; room: Room; result: LayoutAnalysis } | null = null;

/** Memoized on the (immutable) items array and room, so many components can share one result. */
export function analyzeLayoutCached(items: readonly FurnitureItem[], room: Room): LayoutAnalysis {
  if (cache && cache.items === items && cache.room === room) return cache.result;
  const result = analyzeLayout(items, room);
  cache = { items, room, result };
  return result;
}
