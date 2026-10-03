/**
 * Pure, immutable operations on the project document. The Zustand store wraps these
 * with history and selection handling; keeping them here makes them easy to test.
 */
import { frameOf, worldParts } from '../geometry/footprint';
import { localToWorld, normalizeAngle, worldToLocal } from '../geometry/rect';
import { floorClampOffset, itemIdsInRoom } from '../plan/rooms';
import { moveRoomTo, resizeRect, roomBounds, roomRect } from '../plan/shape';
import type { FloorPlan, FurnitureItem, Layout, Opening, ProjectDocument, Room } from '../types';
import { createId } from '../utils/id';

export type Geometry = Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>;
/**
 * Position and size of a room: `x`, `y` is the top-left of its floor's bounding box (the
 * inner top-left corner of a rectangle). Width and depth can only be set on rectangles.
 */
export interface RoomGeometry {
  x: number;
  y: number;
  width: number;
  depth: number;
}

export function getActiveLayout(doc: ProjectDocument): Layout {
  return doc.layouts.find((l) => l.id === doc.activeLayoutId) ?? doc.layouts[0];
}

/** The floor plan of the active layout. */
export function getActivePlan(doc: ProjectDocument): FloorPlan {
  const { planId } = getActiveLayout(doc);
  return doc.plans.find((p) => p.id === planId) ?? doc.plans[0];
}

/** Rooms of the active layout's floor plan. */
export function activeRooms(doc: ProjectDocument): Room[] {
  return getActivePlan(doc).rooms;
}

/** The other layouts that use the same floor plan as `layoutId`. */
export function layoutsSharingPlan(doc: ProjectDocument, layoutId: string): Layout[] {
  const layout = doc.layouts.find((l) => l.id === layoutId);
  return layout ? doc.layouts.filter((l) => l.id !== layoutId && l.planId === layout.planId) : [];
}

/**
 * Gives a layout its own copy of the floor plan it shares with other layouts, so changes to
 * either no longer show in the other. Room and opening ids are kept: they are the same rooms,
 * and a selected room stays selected when switching between the layouts.
 */
export function unlinkPlan(doc: ProjectDocument, layoutId: string): ProjectDocument {
  if (layoutsSharingPlan(doc, layoutId).length === 0) return doc;
  const layout = doc.layouts.find((l) => l.id === layoutId)!;
  const source = doc.plans.find((p) => p.id === layout.planId) ?? doc.plans[0];
  // Updates are immutable, so the copy can start out sharing the rooms.
  const plan: FloorPlan = { id: createId('plan'), rooms: source.rooms };
  return {
    ...doc,
    plans: [...doc.plans, plan],
    layouts: doc.layouts.map((l) => (l.id === layoutId ? { ...l, planId: plan.id } : l)),
  };
}

/** Drops floor plans no layout uses any more. */
export function prunePlans(doc: ProjectDocument): ProjectDocument {
  const used = new Set(doc.layouts.map((l) => l.planId));
  return doc.plans.every((p) => used.has(p.id)) ? doc : { ...doc, plans: doc.plans.filter((p) => used.has(p.id)) };
}

/** Replaces the rooms of the active layout's floor plan. */
export function mapActiveRooms(doc: ProjectDocument, fn: (rooms: Room[]) => Room[]): ProjectDocument {
  const plan = getActivePlan(doc);
  const rooms = fn(plan.rooms);
  if (rooms === plan.rooms) return doc;
  return { ...doc, plans: doc.plans.map((p) => (p.id === plan.id ? { ...p, rooms } : p)) };
}

export function mapActiveFurniture(
  doc: ProjectDocument,
  fn: (items: FurnitureItem[]) => FurnitureItem[],
): ProjectDocument {
  const layout = getActiveLayout(doc);
  const next = fn(layout.furniture);
  if (next === layout.furniture) return doc;
  return { ...doc, layouts: doc.layouts.map((l) => (l.id === layout.id ? { ...l, furniture: next } : l)) };
}

/**
 * Applies a geometry change. Items attached to the changed item follow when it moves or
 * rotates; on resize they keep their place so monitors don't slide around on the desk.
 * With `rooms`, the item is kept on the floor (inside the room it is in).
 */
export function applyGeometry(
  items: FurnitureItem[],
  id: string,
  patch: Partial<Geometry>,
  rooms: readonly Room[] | null,
): FurnitureItem[] {
  const current = items.find((i) => i.id === id);
  if (!current) return items;
  let next: FurnitureItem = { ...current, ...patch };
  if (patch.rotation !== undefined) next.rotation = normalizeAngle(patch.rotation);
  if (rooms) {
    const { dx, dy } = floorClampOffset(worldParts(next), rooms);
    if (dx || dy) next = { ...next, x: next.x + dx, y: next.y + dy };
  }
  if (
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.depth === current.depth &&
    next.rotation === current.rotation
  ) {
    return items;
  }

  const resized = next.width !== current.width || next.depth !== current.depth;
  const moved = next.x !== current.x || next.y !== current.y || next.rotation !== current.rotation;
  const before = frameOf(current);
  const after = frameOf(next);

  return items.map((item) => {
    if (item.id === id) return next;
    if (item.attachedTo === id && moved && !resized) {
      const p = localToWorld(worldToLocal(item, before), after);
      return { ...item, x: p.x, y: p.y, rotation: normalizeAngle(item.rotation + next.rotation - current.rotation) };
    }
    return item;
  });
}

export function removeItem(items: FurnitureItem[], id: string): FurnitureItem[] {
  return items
    .filter((i) => i.id !== id)
    // Floor-or-furniture items on it end up on the floor.
    .map((i) => (i.attachedTo === id ? { ...i, attachedTo: null, ...(i.flexiblePlacement && { placement: 'floor' as const }) } : i));
}

/** Copies an item (and anything attached to it) with fresh ids, offset by (dx, dy). */
export function duplicateItem(
  items: FurnitureItem[],
  id: string,
  dx: number,
  dy: number,
): { items: FurnitureItem[]; newId: string | null } {
  const source = items.find((i) => i.id === id);
  if (!source) return { items, newId: null };
  const copy: FurnitureItem = { ...source, id: createId('item'), x: source.x + dx, y: source.y + dy, attachedTo: source.attachedTo };
  const children = items
    .filter((i) => i.attachedTo === id)
    .map((c) => ({ ...c, id: createId('item'), x: c.x + dx, y: c.y + dy, attachedTo: copy.id }));
  return { items: [...items, copy, ...children], newId: copy.id };
}

export function bringToFront(items: FurnitureItem[], id: string): FurnitureItem[] {
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0 || idx === items.length - 1) return items;
  return [...items.slice(0, idx), ...items.slice(idx + 1), items[idx]];
}

export function sendBackward(items: FurnitureItem[], id: string): FurnitureItem[] {
  const idx = items.findIndex((i) => i.id === id);
  if (idx <= 0) return items;
  const next = items.slice();
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  return next;
}

/** Deep copy of a layout with new ids (attachments are remapped), on the same floor plan. */
export function cloneLayout(layout: Layout, name: string): Layout {
  const idMap = new Map(layout.furniture.map((i) => [i.id, createId('item')]));
  return {
    id: createId('layout'),
    name,
    planId: layout.planId,
    furniture: layout.furniture.map((i) => ({
      ...i,
      clearance: { ...i.clearance },
      shape: { ...i.shape },
      id: idMap.get(i.id)!,
      attachedTo: i.attachedTo ? (idMap.get(i.attachedTo) ?? null) : null,
    })),
  };
}

/** "Layout A", "Layout B", … skipping names already taken. */
export function nextLayoutName(layouts: readonly Layout[]): string {
  const taken = new Set(layouts.map((l) => l.name.trim().toLowerCase()));
  for (let i = 0; i < 26 * 27; i++) {
    const letters = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    const name = `Layout ${letters}`;
    if (!taken.has(name.toLowerCase())) return name;
  }
  return `Layout ${layouts.length + 1}`;
}

/** Changes one room of the active floor plan. */
export function mapRoom(doc: ProjectDocument, id: string, fn: (room: Room) => Room): ProjectDocument {
  return mapActiveRooms(doc, (rooms) => {
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx < 0) return rooms;
    const next = fn(rooms[idx]);
    if (next === rooms[idx]) return rooms;
    const copy = rooms.slice();
    copy[idx] = next;
    return copy;
  });
}

/** Changes every layout on the active floor plan. */
function mapPlanLayouts(doc: ProjectDocument, fn: (layout: Layout) => Layout): Layout[] {
  const { planId } = getActiveLayout(doc);
  return doc.layouts.map((layout) => (layout.planId === planId ? fn(layout) : layout));
}

export function findOpening(rooms: readonly Room[], id: string): { room: Room; opening: Opening } | null {
  for (const room of rooms) {
    const opening = room.openings.find((o) => o.id === id);
    if (opening) return { room, opening };
  }
  return null;
}

/**
 * Moves a room of the active floor plan, or moves and resizes a rectangular one.
 *
 * With `carry`, the room moves as a whole and its furniture moves along, in every layout on
 * that floor plan.
 * Which furniture belongs to the room is decided on `base`, the document when the drag
 * started, so a room dragged across other furniture doesn't pick it up on the way.
 *
 * Without `carry` (resizing), furniture stays where it is, and doors and windows keep their
 * place on the plan when the left or top wall moves.
 */
export function applyRoomGeometry(
  doc: ProjectDocument,
  base: ProjectDocument,
  id: string,
  patch: Partial<RoomGeometry>,
  carry: boolean,
): ProjectDocument {
  const room = activeRooms(doc).find((r) => r.id === id);
  if (!room) return doc;
  const bounds = roomBounds(room);
  const x = patch.x ?? bounds.minX;
  const y = patch.y ?? bounds.minY;
  const rect = roomRect(room);
  const next =
    rect && (patch.width !== undefined || patch.depth !== undefined)
      ? resizeRect(room, { x, y, width: patch.width ?? rect.width, depth: patch.depth ?? rect.depth })
      : moveRoomTo(room, x, y);
  return replaceRoom(doc, base, next, carry);
}

/**
 * Puts a changed room into the active floor plan. With `carry`, its furniture (decided on
 * `base`, as in applyRoomGeometry) moves by as much as the room moved since `base`.
 */
export function replaceRoom(doc: ProjectDocument, base: ProjectDocument, next: Room, carry: boolean): ProjectDocument {
  const id = next.id;
  const room = activeRooms(doc).find((r) => r.id === id);
  if (!room || room === next) return doc;

  let layouts = doc.layouts;
  if (carry) {
    const baseRoom = activeRooms(base).find((r) => r.id === id) ?? room;
    const before = roomBounds(baseRoom);
    const after = roomBounds(next);
    const totalX = after.minX - before.minX;
    const totalY = after.minY - before.minY;
    layouts = mapPlanLayouts(doc, (layout) => {
      const baseItems = (base.layouts.find((l) => l.id === layout.id) ?? layout).furniture;
      const ids = itemIdsInRoom(baseItems, baseRoom);
      if (ids.size === 0) return layout;
      const start = new Map(baseItems.map((i) => [i.id, i]));
      return {
        ...layout,
        furniture: layout.furniture.map((i) => {
          const from = ids.has(i.id) ? start.get(i.id) : undefined;
          return from ? { ...i, x: from.x + totalX, y: from.y + totalY } : i;
        }),
      };
    });
  }
  return mapActiveRooms({ ...doc, layouts }, (rooms) => rooms.map((r) => (r.id === id ? next : r)));
}

/**
 * Removes a room of the active floor plan and the furniture standing in it, in every layout on
 * that plan. The last room is never removed.
 */
export function removeRoom(doc: ProjectDocument, id: string): ProjectDocument {
  const rooms = activeRooms(doc);
  const room = rooms.find((r) => r.id === id);
  if (!room || rooms.length <= 1) return doc;
  const layouts = mapPlanLayouts(doc, (layout) => {
    const ids = itemIdsInRoom(layout.furniture, room);
    if (ids.size === 0) return layout;
    return {
      ...layout,
      furniture: layout.furniture
        .filter((i) => !ids.has(i.id))
        .map((i) => (i.attachedTo && ids.has(i.attachedTo) ? { ...i, attachedTo: null } : i)),
    };
  });
  return mapActiveRooms({ ...doc, layouts }, (list) => list.filter((r) => r.id !== id));
}

export function uniqueCopyName(name: string, layouts: readonly Layout[]): string {
  const taken = new Set(layouts.map((l) => l.name));
  const base = `${name} copy`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }
}
