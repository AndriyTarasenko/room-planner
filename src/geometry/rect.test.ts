import { describe, expect, it } from 'vitest';
import {
  boxesOverlap,
  isQuarterTurn,
  localToWorld,
  normalizeAngle,
  rectAABB,
  rectCorners,
  rotatedSize,
  worldToLocal,
} from './rect';
import { footprintBox, localOutline, localParts, worldParts } from './footprint';
import { polygonArea } from './polygon';

describe('angles', () => {
  it('normalizes angles into [0, 360)', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
  });

  it('detects quarter turns', () => {
    expect(isQuarterTurn(0)).toBe(true);
    expect(isQuarterTurn(90)).toBe(true);
    expect(isQuarterTurn(-270)).toBe(true);
    expect(isQuarterTurn(45)).toBe(false);
    expect(isQuarterTurn(89.5)).toBe(false);
  });
});

describe('rotated dimensions', () => {
  it('keeps dimensions at 0° and swaps them at 90°', () => {
    expect(rotatedSize(180, 80, 0)).toEqual({ width: 180, depth: 80 });
    expect(rotatedSize(180, 80, 90)).toEqual({ width: 80, depth: 180 });
    expect(rotatedSize(180, 80, 270)).toEqual({ width: 80, depth: 180 });
    expect(rotatedSize(180, 80, 180)).toEqual({ width: 180, depth: 80 });
  });

  it('grows the bounding box at 45°', () => {
    const s = rotatedSize(100, 100, 45);
    expect(s.width).toBeCloseTo(141.421, 2);
    expect(s.depth).toBeCloseTo(141.421, 2);
  });

  it('computes exact corners for quarter turns', () => {
    const corners = rectCorners({ cx: 100, cy: 50, width: 180, depth: 80, rotation: 90 });
    expect(rectAABB({ cx: 100, cy: 50, width: 180, depth: 80, rotation: 90 })).toEqual({
      minX: 60,
      minY: -40,
      maxX: 140,
      maxY: 140,
    });
    // Local top-left (-90, -40) rotated 90° clockwise ends up at the top-right.
    expect(corners[0]).toEqual({ x: 140, y: -40 });
  });

  it('round-trips between local and world coordinates', () => {
    const frame = { x: 120, y: 80, rotation: 33 };
    const p = { x: 17, y: -42 };
    const back = worldToLocal(localToWorld(p, frame), frame);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
});

describe('footprints', () => {
  const rect = { x: 100, y: 100, width: 180, depth: 80, rotation: 0, shape: { kind: 'rect' as const } };

  it('uses the item center as position', () => {
    expect(footprintBox(rect)).toEqual({ minX: 10, minY: 60, maxX: 190, maxY: 140 });
  });

  it('builds L-shapes from two rectangles covering the outline', () => {
    const l = { ...rect, width: 160, depth: 120, shape: { kind: 'l' as const, segment: 60, returnSide: 'right' as const } };
    const parts = localParts(l);
    expect(parts).toHaveLength(2);
    const area = parts.reduce((s, p) => s + polygonArea(p), 0);
    expect(area).toBe(160 * 60 + 60 * 60);
    expect(localOutline(l)).toHaveLength(6);
    expect(footprintBox(l)).toEqual({ minX: 20, minY: 40, maxX: 180, maxY: 160 });
    expect(worldParts(l)).toHaveLength(2);
  });

  it('box overlap ignores touching edges', () => {
    const a = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    expect(boxesOverlap(a, { minX: 10, minY: 0, maxX: 20, maxY: 10 })).toBe(false);
    expect(boxesOverlap(a, { minX: 9, minY: 0, maxX: 20, maxY: 10 })).toBe(true);
  });
});
