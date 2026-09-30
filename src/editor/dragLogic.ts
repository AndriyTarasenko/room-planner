import { clampOffsetToRoom } from '../geometry/bounds';
import { footprintBox } from '../geometry/footprint';
import type { Point } from '../geometry/rect';
import { type SnapGuide, snapBox } from '../geometry/snapping';
import type { FurnitureItem, Room, Settings } from '../types';

/** Snap distance in screen pixels; converted to cm using the current zoom. */
export const SNAP_DISTANCE_PX = 8;

export interface DragContext {
  room: Room;
  items: readonly FurnitureItem[];
  settings: Settings;
  /** Pixels per cm. */
  scale: number;
  /** Temporarily disable snapping (Alt held). */
  bypassSnapping?: boolean;
}

export interface DragResult extends Point {
  guides: SnapGuide[];
}

/**
 * Where a dragged item ends up for a proposed center: snapped to walls, nearby furniture
 * or the grid, rounded to whole centimeters otherwise, and kept inside the room.
 */
export function resolveDragPosition(item: FurnitureItem, proposed: Point, ctx: DragContext): DragResult {
  const { settings, room } = ctx;
  let x = proposed.x;
  let y = proposed.y;
  const box = footprintBox({ ...item, x, y });

  const snapping = !ctx.bypassSnapping;
  const targets =
    snapping && settings.snapToFurniture
      ? ctx.items
          .filter((o) => o.id !== item.id && o.attachedTo !== item.id)
          .map((o) => ({ id: o.id, box: footprintBox(o) }))
      : [];
  const snap = snapBox(box, {
    room,
    threshold: SNAP_DISTANCE_PX / ctx.scale,
    walls: snapping && settings.snapToWalls,
    targets,
    grid: snapping && settings.snapToGrid ? settings.gridSize : 1,
  });
  x += snap.dx;
  y += snap.dy;
  let guides: SnapGuide[] = snap.guides;

  if (settings.constrainToRoom) {
    const off = clampOffsetToRoom(footprintBox({ ...item, x, y }), room);
    x += off.dx;
    y += off.dy;
    if (off.dx) guides = guides.filter((g) => g.orientation !== 'vertical');
    if (off.dy) guides = guides.filter((g) => g.orientation !== 'horizontal');
  }
  return { x, y, guides };
}
