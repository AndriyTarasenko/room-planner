/**
 * Snapping for rooms being moved or reshaped. A room docks against a neighbor so the two share
 * one wall: the gap between the floors is the thicker of the two walls, or zero when both
 * walls are open (two parts of an open-plan space). Rooms also line up with other rooms'
 * interior and outer wall faces, and dragged corners line up with other corners.
 */
import type { Point } from '../geometry/rect';
import { type Candidate, type SnapGuide, type SnapResult, bestCandidate, guidesFor } from '../geometry/snapping';
import type { Room } from '../types';
import { roomBounds } from './shape';
import { type AxisWall, axisWalls, outerCorners } from './walls';

const overlaps = (a: [number, number], b: [number, number]) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0;

/** Candidates that line up a moving wall, at `position`, with other walls on the same axis. */
function wallCandidates(m: AxisWall, others: readonly AxisWall[], position = m.position): Candidate[] {
  const out: Candidate[] = [];
  const add = (target: number, moving: number, span: [number, number]) => out.push({ delta: target - moving, kind: 'wall', position: target, span });
  const outer = position - m.inward * m.thickness;
  for (const o of others) {
    if (o.axis !== m.axis) continue;
    if (o.inward === m.inward) {
      // Facing the same way: line up the floors, or the outer faces of the walls.
      add(o.position, position, o.span);
      add(o.position - o.inward * o.thickness, outer, o.span);
    } else if (overlaps(m.span, o.span) && (o.position - position) * m.inward < 0) {
      // Back to back: share one wall, as thick as the thicker of the two.
      add(o.position + m.inward * Math.max(o.thickness, m.thickness), position, o.span);
    }
  }
  return out;
}

/** Snaps a room at its proposed position; returns the correction and guide lines. */
export function snapRoomMove(room: Room, others: readonly Room[], threshold: number): SnapResult {
  const theirs = others.flatMap(axisWalls);
  const mine = axisWalls(room);
  const along = (axis: 'x' | 'y') => mine.filter((w) => w.axis === axis).flatMap((w) => wallCandidates(w, theirs));
  const x = bestCandidate(along('x'), threshold);
  const y = bestCandidate(along('y'), threshold);
  const dx = x?.delta ?? 0;
  const dy = y?.delta ?? 0;
  return { dx, dy, guides: guidesFor(roomBounds(room), dx, dy, x, y) };
}

/**
 * Snaps a straight (horizontal or vertical) wall of a room being reshaped, where `value` is
 * the proposed coordinate of the wall (x for a vertical wall, y for a horizontal one). It
 * lines up with other rooms' walls and docks against them, and lines up with this room's
 * other walls facing the same way.
 */
export function snapRoomEdge(room: Room, wallIndex: number, value: number, others: readonly Room[], threshold: number): { value: number; guide: SnapGuide | null } {
  const m = axisWalls(room).find((w) => w.index === wallIndex);
  if (!m) return { value, guide: null };
  const own = axisWalls(room).filter((w) => w.index !== wallIndex && w.axis === m.axis && w.inward === m.inward);
  const candidates = [
    ...wallCandidates(m, others.flatMap(axisWalls), value),
    ...own.map((o): Candidate => ({ delta: o.position - value, kind: 'wall', position: o.position, span: o.span })),
  ];
  const best = bestCandidate(candidates, threshold);
  if (!best) return { value, guide: null };
  const guide: SnapGuide = {
    orientation: m.axis === 'x' ? 'vertical' : 'horizontal',
    position: best.position,
    start: Math.min(m.span[0], best.span[0]),
    end: Math.max(m.span[1], best.span[1]),
    kind: 'wall',
  };
  return { value: value + best.delta, guide };
}

/** Corners a dragged or drawn corner can line up with: the floor corners and outer wall corners of the rooms. */
export function cornerTargets(rooms: readonly Room[]): Point[] {
  return rooms.flatMap((r) => [...r.corners, ...outerCorners(r)]);
}

/**
 * Snaps a point's x and y separately to the nearest target coordinate within `threshold`,
 * with a guide line from the target to the point for each axis that snapped.
 */
export function snapPoint(p: Point, targets: readonly Point[], threshold: number): { point: Point; guides: SnapGuide[] } {
  let bx: Point | null = null;
  let by: Point | null = null;
  for (const t of targets) {
    if (Math.abs(t.x - p.x) <= threshold && (!bx || Math.abs(t.x - p.x) < Math.abs(bx.x - p.x))) bx = t;
    if (Math.abs(t.y - p.y) <= threshold && (!by || Math.abs(t.y - p.y) < Math.abs(by.y - p.y))) by = t;
  }
  const point = { x: bx ? bx.x : p.x, y: by ? by.y : p.y };
  const guides: SnapGuide[] = [];
  if (bx) guides.push({ orientation: 'vertical', position: bx.x, start: Math.min(bx.y, point.y), end: Math.max(bx.y, point.y), kind: 'wall' });
  if (by) guides.push({ orientation: 'horizontal', position: by.y, start: Math.min(by.x, point.x), end: Math.max(by.x, point.x), kind: 'wall' });
  return { point, guides };
}
