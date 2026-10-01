import { describe, expect, it } from 'vitest';
import type { Clearance, Shape } from '../types';
import { findClearanceConflicts, clearanceZones } from './clearance';
import { findCollisions, footprintsOverlap } from './collision';
import { clipConvexPolygon, convexPolygonsOverlap, polygonArea } from './polygon';

const RECT: Shape = { kind: 'rect' };
const item = (id: string, x: number, y: number, width: number, depth: number, rotation = 0) => ({
  id,
  x,
  y,
  width,
  depth,
  rotation,
  shape: RECT,
});

describe('rectangle collision detection', () => {
  it('detects overlapping axis-aligned rectangles', () => {
    expect(footprintsOverlap(item('a', 50, 50, 100, 100), item('b', 120, 50, 100, 100))).toBe(true);
  });

  it('does not report rectangles that only touch', () => {
    expect(footprintsOverlap(item('a', 50, 50, 100, 100), item('b', 150, 50, 100, 100))).toBe(false);
  });

  it('does not report separated rectangles', () => {
    expect(footprintsOverlap(item('a', 50, 50, 100, 100), item('b', 300, 50, 100, 100))).toBe(false);
  });

  it('uses the real rotated shape, not the bounding box', () => {
    // A 45° square's bounding box reaches into the corner, but the square itself does not.
    const diamond = item('a', 0, 0, 100, 100, 45);
    const corner = item('b', 65, 65, 20, 20);
    expect(footprintsOverlap(diamond, corner)).toBe(false);
    const closer = item('b', 40, 40, 20, 20);
    expect(footprintsOverlap(diamond, closer)).toBe(true);
  });

  it('detects rotated rectangles overlapping', () => {
    const desk = item('desk', 100, 100, 180, 80, 90); // occupies x 60..140, y 10..190
    expect(footprintsOverlap(desk, item('chair', 160, 100, 60, 60))).toBe(true); // x 130..190
    expect(footprintsOverlap(desk, item('chair', 175, 100, 60, 60))).toBe(false); // x 145..205
  });

  it('checks L-shaped footprints part by part', () => {
    const l = {
      id: 'l',
      x: 80,
      y: 60,
      width: 160,
      depth: 120,
      rotation: 0,
      shape: { kind: 'l' as const, segment: 60, returnWidth: 60, returnSide: 'right' as const },
    };
    // The empty inner corner of the L (bottom-left) is free space.
    expect(footprintsOverlap(l, item('box', 30, 95, 40, 40))).toBe(false);
    expect(footprintsOverlap(l, item('box', 140, 95, 40, 40))).toBe(true);
  });

  it('finds all colliding pairs with overlap regions', () => {
    const collisions = findCollisions([
      item('a', 50, 50, 100, 100),
      item('b', 120, 50, 100, 100),
      item('c', 500, 500, 10, 10),
    ]);
    expect(collisions).toHaveLength(1);
    expect(collisions[0]).toMatchObject({ a: 'a', b: 'b' });
    expect(collisions[0].area).toBeCloseTo(30 * 100, 5);
  });

  it('lets callers exclude pairs with a rule', () => {
    const collisions = findCollisions([item('a', 50, 50, 100, 100), item('b', 60, 50, 100, 100)], () => false);
    expect(collisions).toHaveLength(0);
  });
});

describe('polygon helpers', () => {
  const square = (x: number, y: number, s: number) => [
    { x, y },
    { x: x + s, y },
    { x: x + s, y: y + s },
    { x, y: y + s },
  ];

  it('clips convex polygons to their intersection', () => {
    const clipped = clipConvexPolygon(square(0, 0, 10), square(5, 5, 10));
    expect(polygonArea(clipped)).toBeCloseTo(25, 6);
  });

  it('SAT respects the epsilon', () => {
    expect(convexPolygonsOverlap(square(0, 0, 10), square(9.99, 0, 10))).toBe(false);
    expect(convexPolygonsOverlap(square(0, 0, 10), square(9.9, 0, 10))).toBe(true);
  });
});

describe('clearance zones', () => {
  const clearance = (c: Partial<Clearance>): Clearance => ({ enabled: true, front: 0, back: 0, left: 0, right: 0, ...c });

  it('places the front zone on the +y side and follows rotation', () => {
    const [front] = clearanceZones({ ...item('w', 50, 30, 100, 60), clearance: clearance({ front: 60 }) });
    const ys = front.polygon.map((p) => p.y);
    expect(Math.min(...ys)).toBe(60);
    expect(Math.max(...ys)).toBe(120);

    const [rotated] = clearanceZones({ ...item('w', 50, 30, 100, 60, 90), clearance: clearance({ front: 60 }) });
    // Rotated 90° clockwise, local +y points to world −x.
    const xs = rotated.polygon.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-40, 9);
    expect(Math.max(...xs)).toBeCloseTo(20, 9);
  });

  it('returns nothing when disabled', () => {
    expect(clearanceZones({ ...item('w', 0, 0, 10, 10), clearance: { ...clearance({ front: 50 }), enabled: false } })).toEqual([]);
  });

  it('reports objects inside a clearance zone without calling it a collision', () => {
    const wardrobe = { ...item('wardrobe', 50, 30, 100, 60), clearance: clearance({ front: 60 }) };
    const box = { ...item('box', 50, 90, 20, 20), clearance: clearance({}) };
    const far = { ...item('far', 50, 200, 20, 20), clearance: clearance({}) };
    const conflicts = findClearanceConflicts([wardrobe, box, far]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ ownerId: 'wardrobe', intruderId: 'box', sides: ['front'] });
    expect(findCollisions([wardrobe, box, far])).toHaveLength(0);
  });
});
