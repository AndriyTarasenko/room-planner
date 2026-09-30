import type { RoomSize } from './bounds';
import { type Footprint, footprintBox } from './footprint';
import { type Point, isQuarterTurn, rotatedSize } from './rect';

/**
 * Center position after changing an item's width/depth from the inspector.
 * For axis-aligned items the edge closest to a wall stays put, so a desk pushed
 * against the left wall grows to the right instead of into the wall.
 * Freely rotated items resize around their center.
 */
export function anchoredResizeCenter(item: Footprint, newWidth: number, newDepth: number, room: RoomSize): Point {
  if (!isQuarterTurn(item.rotation)) return { x: item.x, y: item.y };
  const box = footprintBox(item);
  const size = rotatedSize(newWidth, newDepth, item.rotation);
  const keepLeft = box.minX <= room.width - box.maxX;
  const keepTop = box.minY <= room.depth - box.maxY;
  return {
    x: keepLeft ? box.minX + size.width / 2 : box.maxX - size.width / 2,
    y: keepTop ? box.minY + size.depth / 2 : box.maxY - size.depth / 2,
  };
}
