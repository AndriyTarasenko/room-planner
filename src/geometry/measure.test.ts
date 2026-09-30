import { describe, expect, it } from 'vitest';
import type { Shape } from '../types';
import { floorUsage } from './area';
import { clampOffsetToRoom, isBoxInsideRoom } from './bounds';
import { neighborGaps, wallDistances, wallMeasureLines } from './distances';
import { footprintBox, worldParts } from './footprint';
import { anchoredResizeCenter } from './resize';

const RECT: Shape = { kind: 'rect' };
const room = { width: 380, depth: 320 };
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

describe('wall distances', () => {
  it('measures clear distance to each wall', () => {
    expect(wallDistances(footprintBox(desk), room)).toEqual({ left: 40, right: 160, top: 0, bottom: 240 });
  });

  it('accounts for rotation', () => {
    const rotated = { ...desk, x: 100, y: 150, rotation: 90 };
    expect(wallDistances(footprintBox(rotated), room)).toEqual({ left: 60, right: 240, top: 60, bottom: 80 });
  });

  it('draws dimension lines from the item edge to the wall', () => {
    const lines = wallMeasureLines(desk, room);
    const left = lines.find((l) => l.direction === 'left')!;
    expect(left.from).toEqual({ x: 40, y: 40 });
    expect(left.to).toEqual({ x: 0, y: 40 });
    expect(left.value).toBe(40);
  });

  it('starts dimension lines at the extreme corner for free rotations', () => {
    const tilted = { ...desk, x: 190, y: 160, rotation: 30 };
    const corners = worldParts(tilted).flat();
    const minX = Math.min(...corners.map((c) => c.x));
    const left = wallMeasureLines(tilted, room).find((l) => l.direction === 'left')!;
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
    expect(anchoredResizeCenter(againstLeft, 200, 80, room)).toEqual({ x: 100, y: 40 });
    // Desk touching the right wall grows to the left.
    const againstRight = { ...desk, x: 290 };
    expect(anchoredResizeCenter(againstRight, 200, 80, room)).toEqual({ x: 280, y: 40 });
  });

  it('resizes freely rotated items around their center', () => {
    expect(anchoredResizeCenter({ ...desk, rotation: 30 }, 200, 80, room)).toEqual({ x: 130, y: 40 });
  });
});

describe('floor usage', () => {
  it('subtracts footprints from the room area', () => {
    const usage = floorUsage({ width: 100, depth: 100 }, worldParts({ x: 25, y: 25, width: 50, depth: 50, rotation: 0, shape: RECT }));
    expect(usage.total).toBe(10000);
    expect(usage.free).toBeCloseTo(7500, 0);
    expect(usage.ratio).toBeCloseTo(0.75, 3);
  });

  it('counts overlapping footprints once', () => {
    const a = worldParts({ x: 25, y: 25, width: 50, depth: 50, rotation: 0, shape: RECT });
    const usage = floorUsage({ width: 100, depth: 100 }, [...a, ...a]);
    expect(usage.free).toBeCloseTo(7500, 0);
  });
});
