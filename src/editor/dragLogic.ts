import { footprintBox, worldParts } from '../geometry/footprint';
import type { Point } from '../geometry/rect';
import { type SnapGuide, snapBox } from '../geometry/snapping';
import { floorClampOffset, roomForBox } from '../plan/rooms';
import { roomBounds } from '../plan/shape';
import { roomWallLines } from '../plan/walls';
import type { FurnitureItem, Room, Settings } from '../types';

/** Snap distance in screen pixels; converted to cm using the current zoom. */
export const SNAP_DISTANCE_PX = 8;

export interface DragContext {
  rooms: readonly Room[];
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
 * or the grid of its room, rounded to whole centimeters from the room's walls otherwise,
 * and kept on the floor. Dragged far enough through a wall, it moves into the next room.
 */
export function resolveDragPosition(item: FurnitureItem, proposed: Point, ctx: DragContext): DragResult {
  const { settings, rooms } = ctx;
  let x = proposed.x;
  let y = proposed.y;
  const box = footprintBox({ ...item, x, y });
  const room = roomForBox(box, rooms);

  const snapping = !ctx.bypassSnapping;
  const targets =
    snapping && settings.snapToFurniture
      ? ctx.items
          .filter((o) => o.id !== item.id && o.attachedTo !== item.id)
          .map((o) => ({ id: o.id, box: footprintBox(o) }))
      : [];
  const snap = snapBox(box, {
    walls: snapping && settings.snapToWalls ? roomWallLines(rooms) : [],
    threshold: SNAP_DISTANCE_PX / ctx.scale,
    targets,
    grid: snapping && settings.snapToGrid ? settings.gridSize : 1,
    gridOrigin: room ? { x: roomBounds(room).minX, y: roomBounds(room).minY } : undefined,
  });
  x += snap.dx;
  y += snap.dy;
  let guides: SnapGuide[] = snap.guides;

  if (settings.constrainToRoom) {
    const off = floorClampOffset(worldParts({ ...item, x, y }), rooms);
    x += off.dx;
    y += off.dy;
    if (off.dx) guides = guides.filter((g) => g.orientation !== 'vertical');
    if (off.dy) guides = guides.filter((g) => g.orientation !== 'horizontal');
  }
  return { x, y, guides };
}
