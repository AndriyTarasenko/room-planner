import type { RoomSize } from './bounds';
import { type Polygon, pointInConvexPolygon } from './polygon';
import { boxOfPoints } from './rect';

export interface FloorUsage {
  /** Room floor area in cm². */
  total: number;
  /** Floor area not covered by any footprint, in cm². */
  free: number;
  ratio: number;
}

/**
 * Free floor area, estimated by rasterizing footprints onto a `cell` cm grid.
 * Overlapping furniture is only counted once. 2 cm cells keep this well under a
 * millisecond for typical rooms, which is precise enough for a planning hint.
 */
export function floorUsage(room: RoomSize, footprints: readonly Polygon[], cell = 2): FloorUsage {
  const cols = Math.max(1, Math.ceil(room.width / cell));
  const rows = Math.max(1, Math.ceil(room.depth / cell));
  const covered = new Uint8Array(cols * rows);

  for (const poly of footprints) {
    const b = boxOfPoints(poly);
    const c0 = Math.max(0, Math.floor(b.minX / cell));
    const c1 = Math.min(cols - 1, Math.floor(b.maxX / cell));
    const r0 = Math.max(0, Math.floor(b.minY / cell));
    const r1 = Math.min(rows - 1, Math.floor(b.maxY / cell));
    for (let r = r0; r <= r1; r++) {
      const cy = Math.min((r + 0.5) * cell, room.depth);
      for (let c = c0; c <= c1; c++) {
        const idx = r * cols + c;
        if (covered[idx]) continue;
        const cx = Math.min((c + 0.5) * cell, room.width);
        if (pointInConvexPolygon({ x: cx, y: cy }, poly)) covered[idx] = 1;
      }
    }
  }

  let coveredArea = 0;
  for (let r = 0; r < rows; r++) {
    const h = Math.min(cell, room.depth - r * cell);
    for (let c = 0; c < cols; c++) {
      if (covered[r * cols + c]) coveredArea += Math.min(cell, room.width - c * cell) * h;
    }
  }
  const total = room.width * room.depth;
  const free = Math.max(0, total - coveredArea);
  return { total, free, ratio: total > 0 ? free / total : 0 };
}
