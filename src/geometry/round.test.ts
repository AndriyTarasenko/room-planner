import { describe, expect, it } from 'vitest';
import type { Shape } from '../types';
import { isShapeOnFloors, rectPolygon } from './bounds';
import { findClearanceConflicts } from './clearance';
import { footprintsOverlap } from './collision';
import { wallDistances, wallMeasureLines } from './distances';
import { footprintBox, isCircle, localParts, touchesBoxMidpoints, worldParts } from './footprint';
import { polygonArea } from './polygon';

const ROUND: Shape = { kind: 'round' };
const RECT: Shape = { kind: 'rect' };
const circle = (x: number, y: number, diameter: number, rotation = 0) => ({ x, y, width: diameter, depth: diameter, rotation, shape: ROUND });

describe('round footprints', () => {
  it('stand in for the ellipse with one convex polygon of nearly the same area', () => {
    const parts = localParts({ width: 180, depth: 100, shape: ROUND });
    expect(parts).toHaveLength(1);
    expect(polygonArea(parts[0]) / (Math.PI * 90 * 50)).toBeGreaterThan(0.99);
    expect(polygonArea(parts[0]) / (Math.PI * 90 * 50)).toBeLessThanOrEqual(1);
  });

  it('have the exact bounding box of the ellipse at any angle', () => {
    expect(footprintBox(circle(100, 100, 90))).toEqual({ minX: 55, minY: 55, maxX: 145, maxY: 145 });
    expect(footprintBox(circle(100, 100, 90, 33))).toEqual({ minX: 55, minY: 55, maxX: 145, maxY: 145 });
    const oval = { x: 0, y: 0, width: 180, depth: 100, rotation: 90, shape: ROUND };
    const box = footprintBox(oval);
    expect(box.minX).toBeCloseTo(-50, 9);
    expect(box.maxY).toBeCloseTo(90, 9);
    // At 45° both extents are sqrt((a² + b²) / 2).
    const tilted = footprintBox({ ...oval, rotation: 45 });
    expect(tilted.maxX).toBeCloseTo(Math.sqrt((90 ** 2 + 50 ** 2) / 2), 9);
    expect(tilted.maxY).toBeCloseTo(tilted.maxX, 9);
  });

  it('tells circles from ovals and knows when dimension lines can run through the center', () => {
    expect(isCircle(circle(0, 0, 50))).toBe(true);
    expect(isCircle({ ...circle(0, 0, 50), depth: 40 })).toBe(false);
    expect(isCircle({ ...circle(0, 0, 50), shape: RECT })).toBe(false);
    expect(touchesBoxMidpoints(circle(0, 0, 50, 17))).toBe(true);
    expect(touchesBoxMidpoints({ ...circle(0, 0, 50, 17), depth: 40 })).toBe(false);
    expect(touchesBoxMidpoints({ ...circle(0, 0, 50, 90), depth: 40 })).toBe(true);
    expect(touchesBoxMidpoints({ ...circle(0, 0, 50, 17), shape: RECT })).toBe(false);
  });
});

describe('round collisions', () => {
  it('reports circles that overlap but not circles that only touch', () => {
    expect(footprintsOverlap(circle(0, 0, 100), circle(100, 0, 100))).toBe(false);
    expect(footprintsOverlap(circle(0, 0, 100), circle(99, 0, 100))).toBe(true);
  });

  it('uses the round outline, not the bounding box', () => {
    // The boxes overlap at the corner, the circles are 113 cm apart.
    expect(footprintsOverlap(circle(0, 0, 100), circle(80, 80, 100))).toBe(false);
    // A chair tucked into the corner of a round table's box doesn't hit the table.
    const chair = { x: 50, y: 50, width: 20, depth: 20, rotation: 0, shape: RECT };
    expect(footprintsOverlap(circle(0, 0, 100), chair)).toBe(false);
    expect(footprintsOverlap(circle(0, 0, 100), { ...chair, x: 40, y: 40 })).toBe(true);
  });

  it('is on the floor when the circle is, even if its box pokes into a missing corner', () => {
    // An L-shaped floor: 200 × 200 with the top-right 100 × 100 cut away.
    const floor = [
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 0, y: 200 },
      ],
    ];
    // Its box reaches 10 cm into the cut-away corner, but the circle stays 2.4 cm clear of it.
    const nearCorner = circle(70, 130, 80);
    expect(footprintBox(nearCorner)).toEqual({ minX: 30, minY: 90, maxX: 110, maxY: 170 });
    expect(isShapeOnFloors(worldParts(nearCorner), floor)).toBe(true);
    expect(isShapeOnFloors(worldParts({ ...nearCorner, shape: RECT }), floor)).toBe(false);
    expect(isShapeOnFloors(worldParts(circle(90, 120, 80)), floor)).toBe(false);
  });

  it('flags things inside a round table’s clearance strips', () => {
    const table = { id: 't', ...circle(100, 100, 100), clearance: { enabled: true, front: 70, back: 0, left: 0, right: 0 } };
    const chair = { id: 'c', x: 100, y: 180, width: 40, depth: 40, rotation: 0, shape: RECT, clearance: { enabled: false, front: 0, back: 0, left: 0, right: 0 } };
    expect(findClearanceConflicts([table, chair])).toHaveLength(1);
  });
});

describe('round measurements', () => {
  const room = rectPolygon({ x: 0, y: 0, width: 400, depth: 300 });

  it('measures exact wall distances from the outline', () => {
    const d = wallDistances(footprintBox(circle(100, 100, 90, 25)), room);
    expect(d.left).toBeCloseTo(55, 9);
    expect(d.top).toBeCloseTo(55, 9);
    expect(d.right).toBeCloseTo(255, 9);
    expect(d.bottom).toBeCloseTo(155, 9);
  });

  it('runs dimension lines from the points where a circle comes closest to each wall', () => {
    const lines = wallMeasureLines(circle(100, 120, 90, 25), room);
    const left = lines.find((l) => l.direction === 'left')!;
    expect(left.from).toEqual({ x: 55, y: 120 });
    expect(left.to).toEqual({ x: 0, y: 120 });
    const bottom = lines.find((l) => l.direction === 'bottom')!;
    expect(bottom.from).toEqual({ x: 100, y: 165 });
    expect(bottom.value).toBeCloseTo(135, 9);
  });
});
