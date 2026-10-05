import { polygonRect } from './bounds';
import { type Polygon, polygonArea } from './polygon';
import { type Point, boxOfPoints } from './rect';

export interface FloorUsage {
  /** Room floor area in cm². */
  total: number;
  /** Floor area not covered by any footprint, in cm². */
  free: number;
  ratio: number;
}

/**
 * Free floor area of one room (its floor polygon), estimated by rasterizing footprints onto
 * a `cell` cm grid anchored at the room's top-left. Overlapping furniture is only counted
 * once, and only the part of a footprint inside this room counts. 2 cm cells keep this well
 * under a millisecond for typical rooms, which is precise enough for a planning hint.
 */
export function floorUsage(room: readonly Point[], footprints: readonly Polygon[], cell = 2): FloorUsage {
  const rect = polygonRect(room);
  const bounds = boxOfPoints(room);
  const x0 = bounds.minX;
  const y0 = bounds.minY;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(depth / cell));
  const covered = new Uint8Array(cols * rows);
  // Rectangles are covered by the grid exactly; other shapes only count cells centered on the floor.
  const onFloor = rect ? null : new Uint8Array(cols * rows);
  if (onFloor) {
    // Scanline fill: where each row's center line crosses the walls, cells between pairs of
    // crossings are on the floor (even–odd rule, like pointInPolygon).
    for (let r = 0; r < rows; r++) {
      const cy = y0 + Math.min((r + 0.5) * cell, depth);
      const xs: number[] = [];
      for (let i = 0; i < room.length; i++) {
        const a = room[i];
        const b = room[(i + 1) % room.length];
        if (a.y > cy !== b.y > cy) xs.push(a.x + ((cy - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
      xs.sort((u, v) => u - v);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.floor((xs[k] - x0) / cell - 0.5));
        const c1 = Math.min(cols - 1, Math.ceil((xs[k + 1] - x0) / cell));
        for (let c = c0; c <= c1; c++) {
          const cx = x0 + Math.min((c + 0.5) * cell, width);
          if (cx > xs[k] && cx < xs[k + 1]) onFloor[r * cols + c] = 1;
        }
      }
    }
  }

  for (const poly of footprints) {
    const b = boxOfPoints(poly);
    const r0 = Math.max(0, Math.floor((b.minY - y0) / cell));
    const r1 = Math.min(rows - 1, Math.floor((b.maxY - y0) / cell));
    for (let r = r0; r <= r1; r++) {
      const cy = y0 + Math.min((r + 0.5) * cell, depth);
      // Footprint parts are convex, so the row's center line crosses each in one span: cells
      // centered on it are covered (this runs for every step of a drag).
      const span = convexSpanAt(poly, cy);
      if (!span) continue;
      const c0 = Math.max(0, Math.floor((span.min - x0) / cell));
      const c1 = Math.min(cols - 1, Math.floor((span.max - x0) / cell));
      for (let c = c0; c <= c1; c++) {
        const idx = r * cols + c;
        if (covered[idx] || (onFloor && !onFloor[idx])) continue;
        const cx = x0 + Math.min((c + 0.5) * cell, width);
        if (cx >= span.min && cx <= span.max) covered[idx] = 1;
      }
    }
  }

  let coveredArea = 0;
  for (let r = 0; r < rows; r++) {
    const h = Math.min(cell, depth - r * cell);
    for (let c = 0; c < cols; c++) {
      if (covered[r * cols + c]) coveredArea += Math.min(cell, width - c * cell) * h;
    }
  }
  const total = rect ? rect.width * rect.depth : polygonArea(room as Polygon);
  const free = Math.max(0, total - coveredArea);
  return { total, free, ratio: total > 0 ? free / total : 0 };
}

/** Where the horizontal line at `y` crosses a convex polygon, edges included; null when it misses. */
function convexSpanAt(poly: Polygon, y: number): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if ((a.y < y && b.y < y) || (a.y > y && b.y > y)) continue;
    if (a.y === b.y) {
      min = Math.min(min, a.x, b.x);
      max = Math.max(max, a.x, b.x);
    } else {
      const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  return min <= max ? { min, max } : null;
}

/** Adds up the usage of several rooms. */
export function sumUsage(parts: readonly FloorUsage[]): FloorUsage {
  const total = parts.reduce((sum, u) => sum + u.total, 0);
  const free = parts.reduce((sum, u) => sum + u.free, 0);
  return { total, free, ratio: total > 0 ? free / total : 0 };
}
