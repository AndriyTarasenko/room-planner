import { wallDistances } from './distances';
import { type Footprint, footprintBox } from './footprint';
import { type Point, isQuarterTurn, rotatedSize } from './rect';

/**
 * Center position after changing an item's width/depth from the inspector.
 * For axis-aligned items the edge closest to a wall stays put, so a desk pushed
 * against the left wall grows to the right instead of into the wall.
 * Freely rotated items resize around their center. `room` is the floor polygon.
 */
export function anchoredResizeCenter(item: Footprint, newWidth: number, newDepth: number, room: readonly Point[]): Point {
  if (!isQuarterTurn(item.rotation)) return { x: item.x, y: item.y };
  const box = footprintBox(item);
  const size = rotatedSize(newWidth, newDepth, item.rotation);
  const walls = wallDistances(box, room);
  const keepLeft = walls.left <= walls.right;
  const keepTop = walls.top <= walls.bottom;
  return {
    x: keepLeft ? box.minX + size.width / 2 : box.maxX - size.width / 2,
    y: keepTop ? box.minY + size.depth / 2 : box.maxY - size.depth / 2,
  };
}
