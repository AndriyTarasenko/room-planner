import { describe, expect, it } from 'vitest';
import type { Shape } from '../types';
import { floorUsage } from './area';
import { clampOffsetToRoom, clampShapeIntoPolygon, isBoxInsideRoom, isShapeOnFloors, polygonLabelPoint, rectPolygon } from './bounds';
import { neighborGaps, wallDistances, wallMeasureLines } from './distances';
import { footprintBox, worldParts } from './footprint';
import { pointInPolygon } from './polygon';
import { anchoredResizeCenter } from './resize';

const RECT: Shape = { kind: 'rect' };
const room = { x: 0, y: 0, width: 380, depth: 320 };
const roomPoly = rectPolygon(room);
// 500 × 400 with the top-right 200 × 200 cut away: an L.
const lShape = [
  { x: 0, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 200 },
  { x: 500, y: 200 },
  { x: 500, y: 400 },
  { x: 0, y: 400 },
];
const boxParts = (minX: number, minY: number, maxX: number, maxY: number) => [rectPolygon({ x: minX, y: minY, width: maxX - minX, depth: maxY - minY })];
const desk = { x: 130, y: 40, width: 180, depth: 80, rotation: 0, shape: RECT };

describe('room boundary detection', () => {
  it('accepts items fully inside, including touching the walls', () => {
    expect(isBoxInsideRoom(footprintBox(desk), room)).toBe(true);
    expect(isBoxInsideRoom({ minX: 0, minY: 0, maxX: 380, maxY: 320 }, room)).toBe(true);
  });

  it('rejects items crossing a wall', () => {
    expect(isBoxInsideRoom(footprintBox({ ...desk, x: 30 }), room)).toBe(false);
    expect(isBoxInsideRoom(footprintBox({ ...desk, y: 300 }), room)).toBe(false);
  });

  it('detects rotation pushing an item through a wall', () => {
    // 180 cm long desk rotated 90° near the top wall sticks out.
    expect(isBoxInsideRoom(footprintBox({ ...desk, rotation: 90 }), room)).toBe(false);
  });

  it('computes the offset that brings an item back inside', () => {
    expect(clampOffsetToRoom({ minX: -20, minY: 10, maxX: 160, maxY: 90 }, room)).toEqual({ dx: 20, dy: 0 });
    expect(clampOffsetToRoom({ minX: 300, minY: 290, maxX: 400, maxY: 340 }, room)).toEqual({ dx: -20, dy: -20 });
    expect(clampOffsetToRoom({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, room)).toEqual({ dx: 0, dy: 0 });
  });

  it('aligns items larger than the room to the top-left', () => {
    expect(clampOffsetToRoom({ minX: 50, minY: 0, maxX: 450, maxY: 10 }, room)).toEqual({ dx: -50, dy: 0 });
  });
});

describe('rooms of any shape', () => {
  it('knows which points are on the floor of an L-shaped room', () => {
    expect(pointInPolygon({ x: 100, y: 100 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 400, y: 100 }, lShape)).toBe(false);
    expect(pointInPolygon({ x: 400, y: 300 }, lShape)).toBe(true);
    expect(pointInPolygon({ x: 300, y: 100 }, lShape, 0.01)).toBe(true);
  });

  it('counts a shape as on the floor only when every part of it is', () => {
    expect(isShapeOnFloors(boxParts(200, 250, 450, 350), [lShape])).toBe(true);
    // Poking into the cut-away corner.
    expect(isShapeOnFloors(boxParts(250, 150, 350, 250), [lShape])).toBe(false);
    // Flush against the walls of the inner corner.
    expect(isShapeOnFloors(boxParts(200, 100, 300, 200), [lShape])).toBe(true);
    // Two rooms joined by an open wall form one floor.
    const next = rectPolygon({ x: 500, y: 200, width: 100, depth: 200 });
    expect(isShapeOnFloors(boxParts(450, 250, 550, 300), [lShape, next])).toBe(true);
  });

  it('pushes a shape out of the walls it pokes through', () => {
    // Into the cut-away corner from the left: back out the short way.
    expect(clampShapeIntoPolygon(boxParts(280, 100, 320, 150), lShape)).toEqual({ dx: -20, dy: 0 });
    // Into the corner from below.
    expect(clampShapeIntoPolygon(boxParts(350, 190, 400, 260), lShape)).toEqual({ dx: 0, dy: 10 });
    // Through two walls at an outer corner.
    expect(clampShapeIntoPolygon(boxParts(480, 380, 520, 420), lShape)).toEqual({ dx: -20, dy: -20 });
    // Through a slanted wall (running down-right at 45°): along its normal, down-left.
    const slanted = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 0, y: 300 }];
    const push = clampShapeIntoPolygon(boxParts(230, 20, 260, 50), slanted);
    expect(push.dx).toBeLessThan(0);
    expect(push.dx).toBeCloseTo(-push.dy, 9);
    expect(isShapeOnFloors(boxParts(230 + push.dx, 20 + push.dy, 260 + push.dx, 50 + push.dy), [slanted])).toBe(true);
  });

  it('puts labels at the widest spot, inside the floor', () => {
    expect(polygonLabelPoint(roomPoly).point).toEqual({ x: 190, y: 160 });
    const { point, radius } = polygonLabelPoint(lShape);
    expect(pointInPolygon(point, lShape)).toBe(true);
    expect(radius).toBeGreaterThan(95);
  });

  it('measures to the nearest wall along each side of an item', () => {
    // Below the cut-away corner: the wall above is the corner's bottom wall on the right part.
    expect(wallDistances({ minX: 250, minY: 250, maxX: 350, maxY: 300 }, lShape)).toEqual({ left: 250, right: 150, top: 50, bottom: 100 });
    const lines = wallMeasureLines({ ...desk, x: 300, y: 275, width: 100, depth: 50 }, lShape);
    expect(lines.find((l) => l.direction === 'top')).toMatchObject({ from: { x: 300, y: 250 }, to: { x: 300, y: 200 }, value: 50 });
    expect(lines.find((l) => l.direction === 'left')).toMatchObject({ value: 250 });
  });
});

describe('wall distances', () => {
  it('measures clear distance to each wall', () => {
    expect(wallDistances(footprintBox(desk), roomPoly)).toEqual({ left: 40, right: 160, top: 0, bottom: 240 });
  });

  it('accounts for rotation', () => {
    const rotated = { ...desk, x: 100, y: 150, rotation: 90 };
    expect(wallDistances(footprintBox(rotated), roomPoly)).toEqual({ left: 60, right: 240, top: 60, bottom: 80 });
  });

  it('draws dimension lines from the item edge to the wall', () => {
    const lines = wallMeasureLines(desk, roomPoly);
    const left = lines.find((l) => l.direction === 'left')!;
    expect(left.from).toEqual({ x: 40, y: 40 });
    expect(left.to).toEqual({ x: 0, y: 40 });
    expect(left.value).toBe(40);
  });

  it('starts dimension lines at the extreme corner for free rotations', () => {
    const tilted = { ...desk, x: 190, y: 160, rotation: 30 };
    const corners = worldParts(tilted).flat();
    const minX = Math.min(...corners.map((c) => c.x));
    const left = wallMeasureLines(tilted, roomPoly).find((l) => l.direction === 'left')!;
    expect(left.from.x).toBeCloseTo(minX, 9);
    expect(left.value).toBeCloseTo(minX, 9);
    expect(left.to.x).toBe(0);
  });
});

describe('neighbor gaps', () => {
  it('finds the closest object in each direction', () => {
    const box = { minX: 100, minY: 100, maxX: 200, maxY: 150 };
    const gaps = neighborGaps(box, [
      { id: 'right-near', box: { minX: 230, minY: 90, maxX: 260, maxY: 160 } },
      { id: 'right-far', box: { minX: 280, minY: 90, maxX: 300, maxY: 160 } },
      { id: 'below', box: { minX: 150, minY: 190, maxX: 250, maxY: 220 } },
      { id: 'diagonal', box: { minX: 0, minY: 0, maxX: 50, maxY: 50 } },
    ]);
    const byDir = Object.fromEntries(gaps.map((g) => [g.direction, g]));
    expect(byDir.right).toMatchObject({ otherId: 'right-near', value: 30 });
    expect(byDir.bottom).toMatchObject({ otherId: 'below', value: 40 });
    // Line is drawn in the middle of the shared span (x 150..200).
    expect(byDir.bottom.from).toEqual({ x: 175, y: 150 });
    expect(byDir.left).toBeUndefined();
    expect(byDir.top).toBeUndefined();
  });

  it('ignores gaps beyond the limit', () => {
    const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(neighborGaps(box, [{ id: 'x', box: { minX: 300, minY: 0, maxX: 310, maxY: 10 } }], 150)).toEqual([]);
  });
});

describe('anchored resizing', () => {
  it('keeps the edge nearest a wall in place', () => {
    // Desk touching the left wall grows to the right.
    const againstLeft = { ...desk, x: 90 };
    expect(anchoredResizeCenter(againstLeft, 200, 80, roomPoly)).toEqual({ x: 100, y: 40 });
    // Desk touching the right wall grows to the left.
    const againstRight = { ...desk, x: 290 };
    expect(anchoredResizeCenter(againstRight, 200, 80, roomPoly)).toEqual({ x: 280, y: 40 });
  });

  it('resizes freely rotated items around their center', () => {
    expect(anchoredResizeCenter({ ...desk, rotation: 30 }, 200, 80, roomPoly)).toEqual({ x: 130, y: 40 });
  });
});

describe('floor usage', () => {
  it('subtracts footprints from the room area', () => {
    const usage = floorUsage(rectPolygon({ x: 0, y: 0, width: 100, depth: 100 }), worldParts({ x: 25, y: 25, width: 50, depth: 50, rotation: 0, shape: RECT }));
    expect(usage.total).toBe(10000);
    expect(usage.free).toBeCloseTo(7500, 0);
    expect(usage.ratio).toBeCloseTo(0.75, 3);
  });

  it('counts overlapping footprints once', () => {
    const a = worldParts({ x: 25, y: 25, width: 50, depth: 50, rotation: 0, shape: RECT });
    const usage = floorUsage(rectPolygon({ x: 0, y: 0, width: 100, depth: 100 }), [...a, ...a]);
    expect(usage.free).toBeCloseTo(7500, 0);
  });

  it('uses the exact floor area of other shapes, and only furniture on that floor', () => {
    // 16 m² L; a 1 × 1 m item inside it, another in the cut-away corner.
    const inside = worldParts({ x: 100, y: 300, width: 100, depth: 100, rotation: 0, shape: RECT });
    const outside = worldParts({ x: 400, y: 100, width: 100, depth: 100, rotation: 0, shape: RECT });
    const usage = floorUsage(lShape, [...inside, ...outside]);
    expect(usage.total).toBe(160_000);
    expect(usage.free).toBeCloseTo(150_000, -1);
  });
});
