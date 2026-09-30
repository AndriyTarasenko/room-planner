/**
 * Pure, immutable operations on the project document. The Zustand store wraps these
 * with history and selection handling; keeping them here makes them easy to test.
 */
import { clampOffsetToRoom } from '../geometry/bounds';
import { footprintBox, frameOf } from '../geometry/footprint';
import { localToWorld, normalizeAngle, worldToLocal } from '../geometry/rect';
import type { FurnitureItem, Layout, ProjectDocument, Room } from '../types';
import { createId } from '../utils/id';

export type Geometry = Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>;

export function getActiveLayout(doc: ProjectDocument): Layout {
  return doc.layouts.find((l) => l.id === doc.activeLayoutId) ?? doc.layouts[0];
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

/** Offset that keeps an item inside the room (zero when it doesn't fit anyway). */
export function roomClampOffset(item: FurnitureItem, room: Room): { dx: number; dy: number } {
  return clampOffsetToRoom(footprintBox(item), room);
}

/**
 * Applies a geometry change. Items attached to the changed item follow when it moves or
 * rotates; on resize they keep their place so monitors don't slide around on the desk.
 */
export function applyGeometry(
  items: FurnitureItem[],
  id: string,
  patch: Partial<Geometry>,
  room: Room | null,
): FurnitureItem[] {
  const current = items.find((i) => i.id === id);
  if (!current) return items;
  let next: FurnitureItem = { ...current, ...patch };
  if (patch.rotation !== undefined) next.rotation = normalizeAngle(patch.rotation);
  if (room) {
    const { dx, dy } = roomClampOffset(next, room);
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
    .map((i) => (i.attachedTo === id ? { ...i, attachedTo: null } : i));
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

/** Deep copy of a layout with new ids (attachments are remapped). */
export function cloneLayout(layout: Layout, name: string): Layout {
  const idMap = new Map(layout.furniture.map((i) => [i.id, createId('item')]));
  return {
    id: createId('layout'),
    name,
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

export function uniqueCopyName(name: string, layouts: readonly Layout[]): string {
  const taken = new Set(layouts.map((l) => l.name));
  const base = `${name} copy`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }
}
