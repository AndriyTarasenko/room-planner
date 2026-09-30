import type { Box } from './rect';

export interface RoomSize {
  width: number;
  depth: number;
}

/** Tolerance for floating point noise when checking room bounds. */
const BOUNDS_EPS = 0.01;

export function isBoxInsideRoom(box: Box, room: RoomSize, eps = BOUNDS_EPS): boolean {
  return box.minX >= -eps && box.minY >= -eps && box.maxX <= room.width + eps && box.maxY <= room.depth + eps;
}

/**
 * Translation that moves `box` back inside the room. If the box is larger than the room
 * along an axis it is aligned to the top/left wall on that axis.
 */
export function clampOffsetToRoom(box: Box, room: RoomSize): { dx: number; dy: number } {
  return { dx: clampAxis(box.minX, box.maxX, room.width), dy: clampAxis(box.minY, box.maxY, room.depth) };
}

function clampAxis(min: number, max: number, limit: number): number {
  if (max - min >= limit) return -min;
  if (min < 0) return -min;
  if (max > limit) return limit - max;
  return 0;
}
