/**
 * The Ruler tool: the straight distance between any two points of the plan. Its ends snap
 * to corners (rooms, walls, door and window jambs, furniture), then onto wall faces and
 * furniture outlines. Within a few pixels of horizontal or vertical, the second end locks to
 * that axis and stops on any wall or furniture edge it crosses. Lengths come out in whole
 * centimeters unless an end snapped onto something.
 */
import { frameOf, localOutline } from '../geometry/footprint';
import { type Point, localToWorld } from '../geometry/rect';
import type { FurnitureItem, Room } from '../types';
import { cornerTargets } from './roomSnapping';
import { pointOnWall, wallFrame, wallPolygon, wallThickness } from './walls';

export interface Segment {
  a: Point;
  b: Point;
}

/** What ruler ends snap to, collected once per plan and layout. */
export interface RulerTargets {
  points: Point[];
  edges: Segment[];
}

export interface RulerSnap {
  point: Point;
  /** `point`: a corner; `edge`: on a wall face or furniture outline; `free`: nothing. */
  kind: 'point' | 'edge' | 'free';
}

export interface RulerSnapOptions {
  /** Snap distance in cm. */
  threshold: number;
  /** False while Alt is held: no snapping, only whole centimeters. */
  snap: boolean;
}

const closed = (points: readonly Point[]): Segment[] => points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));

export function rulerTargets(rooms: readonly Room[], items: readonly FurnitureItem[]): RulerTargets {
  const points = cornerTargets(rooms);
  const edges: Segment[] = [];
  for (const room of rooms) {
    edges.push(...closed(room.corners));
    room.corners.forEach((_, i) => {
      // The outer face of the wall, from its start corner to its end corner.
      const wall = wallPolygon(room, i);
      if (wall) edges.push({ a: wall[3], b: wall[2] });
    });
    for (const o of room.openings) {
      const f = wallFrame(room, o.wall);
      const t = wallThickness(room, o.wall);
      for (const along of [o.offset, o.offset + o.width]) {
        points.push(pointOnWall(f, along));
        if (t > 0) points.push(pointOnWall(f, along, t));
      }
    }
  }
  for (const item of items) {
    const frame = frameOf(item);
    const outline = localOutline(item).map((p) => localToWorld(p, frame));
    edges.push(...closed(outline));
    if (item.shape.kind === 'round') {
      // The outline of a round item is a many-sided polygon; only its center and extremes are corners worth hitting.
      const hw = item.width / 2;
      const hd = item.depth / 2;
      const extremes = [{ x: hw, y: 0 }, { x: 0, y: hd }, { x: -hw, y: 0 }, { x: 0, y: -hd }];
      points.push({ x: item.x, y: item.y }, ...extremes.map((p) => localToWorld(p, frame)));
    } else {
      points.push(...outline);
    }
  }
  return { points, edges };
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** `raw` moved to a whole number of centimeters from `anchor`, in the same direction; or to whole coordinates without an anchor. */
function wholeCm(raw: Point, anchor: Point | null): Point {
  if (!anchor) return { x: Math.round(raw.x), y: Math.round(raw.y) };
  const len = distance(raw, anchor);
  if (len < 1e-9) return { ...anchor };
  const k = Math.round(len) / len;
  return { x: anchor.x + (raw.x - anchor.x) * k, y: anchor.y + (raw.y - anchor.y) * k };
}

/**
 * How far `p` is from a segment, and the point of the segment to snap to: the nearest one,
 * moved to a whole number of centimeters from the segment's start (or to its end).
 */
function onSegment(p: Point, s: Segment): { point: Point; distance: number } {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { point: { ...s.a }, distance: distance(p, s.a) };
  const exact = Math.min(len, Math.max(0, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len));
  const at = (t: number) => ({ x: s.a.x + (dx / len) * t, y: s.a.y + (dy / len) * t });
  return { point: at(Math.min(len, Math.round(exact))), distance: distance(p, at(exact)) };
}

/** Where a segment crosses the line `axis` = `value` (x = value for a vertical line), as the other coordinate. */
function crossing(s: Segment, axis: 'x' | 'y', value: number): number | null {
  const other = axis === 'x' ? 'y' : 'x';
  const da = s.a[axis] - value;
  const db = s.b[axis] - value;
  // Segments lying along the line, or entirely on one side of it, don't cross it.
  if (da === db || da * db > 0) return null;
  return s.a[other] + (da / (da - db)) * (s.b[other] - s.a[other]);
}

/**
 * The second end locked to a horizontal or vertical line through `anchor`, when the pointer
 * is close enough to one. It stops on the nearest edge the line crosses near the pointer.
 */
function axisLocked(raw: Point, anchor: Point, edges: readonly Segment[], threshold: number): RulerSnap | null {
  const dx = raw.x - anchor.x;
  const dy = raw.y - anchor.y;
  // `fixed` is the coordinate the line keeps: y for a horizontal measurement.
  const fixed: 'x' | 'y' | null = Math.abs(dy) <= threshold && Math.abs(dx) > Math.abs(dy) ? 'y' : Math.abs(dx) <= threshold && Math.abs(dy) > Math.abs(dx) ? 'x' : null;
  if (!fixed) return null;
  const free = fixed === 'y' ? 'x' : 'y';
  let hit: number | null = null;
  for (const e of edges) {
    const at = crossing(e, fixed, anchor[fixed]);
    if (at !== null && Math.abs(at - raw[free]) <= threshold && (hit === null || Math.abs(at - raw[free]) < Math.abs(hit - raw[free]))) hit = at;
  }
  const value = hit ?? anchor[free] + Math.round(raw[free] - anchor[free]);
  const point = fixed === 'y' ? { x: value, y: anchor.y } : { x: anchor.x, y: value };
  return { point, kind: hit === null ? 'free' : 'edge' };
}

/** Where a ruler end goes for the pointer at `raw`. `anchor` is the other end, once it is placed. */
export function snapRulerPoint(raw: Point, anchor: Point | null, targets: RulerTargets, opts: RulerSnapOptions): RulerSnap {
  if (!opts.snap) return { point: wholeCm(raw, anchor), kind: 'free' };

  let corner: Point | null = null;
  for (const p of targets.points) {
    if (distance(p, raw) <= opts.threshold && (!corner || distance(p, raw) < distance(corner, raw))) corner = p;
  }
  if (corner) return { point: { ...corner }, kind: 'point' };

  const locked = anchor && axisLocked(raw, anchor, targets.edges, opts.threshold);
  if (locked) return locked;

  let edge: { point: Point; distance: number } | null = null;
  for (const e of targets.edges) {
    const hit = onSegment(raw, e);
    if (hit.distance <= opts.threshold && (!edge || hit.distance < edge.distance)) edge = hit;
  }
  if (edge) return { point: edge.point, kind: 'edge' };

  return { point: wholeCm(raw, anchor), kind: 'free' };
}
