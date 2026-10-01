import { describe, expect, it } from 'vitest';
import { createItemFromPreset } from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import type { Point } from '../geometry/rect';
import { createOpening } from './openings';
import { createRoom } from './rooms';
import { rulerTargets, snapRulerPoint } from './ruler';

// A 380 × 320 room with 12 cm walls, a door in the top wall from 100 to 180, a 180 × 80
// desk spanning x 100–280 and y 80–160, and a 120 cm round table centered at (190, 250).
const room = createRoom({ width: 380, depth: 320, openings: [createOpening('door', 0, 100, 80)] });
const desk = createItemFromPreset(findPreset('desk-180')!, { x: 190, y: 120 });
const table = createItemFromPreset(findPreset('round-dining-table-120')!, { x: 190, y: 250 });
const targets = rulerTargets([room], [desk, table]);
const opts = { threshold: 5, snap: true };
const snap = (raw: Point, anchor: Point | null = null, o = opts) => snapRulerPoint(raw, anchor, targets, o);
const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

describe('ruler targets', () => {
  it('include room, wall and jamb corners, furniture corners and round centers', () => {
    expect(targets.points).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: -12, y: -12 },
        { x: 100, y: 0 },
        { x: 180, y: -12 },
        { x: 100, y: 80 },
        { x: 280, y: 160 },
        { x: 190, y: 250 },
        { x: 130, y: 250 },
      ]),
    );
  });

  it('take only the center and extremes of round furniture as corners', () => {
    const roundPoints = rulerTargets([], [table]).points;
    expect(roundPoints).toHaveLength(5);
  });
});

describe('snapping a ruler end', () => {
  it('prefers a nearby corner', () => {
    expect(snap({ x: 2, y: 3 })).toEqual({ point: { x: 0, y: 0 }, kind: 'point' });
    expect(snap({ x: 128, y: 251 })).toEqual({ point: { x: 130, y: 250 }, kind: 'point' });
  });

  it('lands on a wall face at a whole centimeter', () => {
    expect(snap({ x: 50.4, y: 2 })).toEqual({ point: { x: 50, y: 0 }, kind: 'edge' });
    expect(snap({ x: 50.6, y: -10 })).toEqual({ point: { x: 51, y: -12 }, kind: 'edge' });
    // Zoomed far in, the snap distance is under half a centimeter; the rounding must not push the point out of reach.
    expect(snap({ x: 50.4, y: 0.3 }, null, { threshold: 0.4, snap: true })).toEqual({ point: { x: 50, y: 0 }, kind: 'edge' });
  });

  it('locks near-horizontal and near-vertical measurements to the axis, stopping on edges it crosses', () => {
    expect(snap({ x: 97, y: 123 }, { x: 0, y: 120 })).toEqual({ point: { x: 100, y: 120 }, kind: 'edge' });
    expect(snap({ x: 302, y: 50.4 }, { x: 300, y: 0 })).toEqual({ point: { x: 300, y: 50 }, kind: 'free' });
    expect(snap({ x: 40.6, y: 121 }, { x: 0, y: 120 })).toEqual({ point: { x: 41, y: 120 }, kind: 'free' });
  });

  it('stops on the outline of round furniture', () => {
    const hit = snap({ x: 133, y: 231 }, { x: 0, y: 230 });
    expect(hit.kind).toBe('edge');
    expect(hit.point.y).toBe(230);
    expect(hit.point.x).toBeCloseTo(190 - Math.sqrt(60 ** 2 - 20 ** 2), 0);
  });

  it('measures whole centimeters in any direction when nothing is near', () => {
    const anchor = { x: 300, y: 200 };
    const hit = snap({ x: 330.3, y: 240.2 }, anchor);
    expect(hit.kind).toBe('free');
    expect(length(anchor, hit.point)).toBeCloseTo(50, 9);
    expect(snap({ x: 300.4, y: 199.6 })).toEqual({ point: { x: 300, y: 200 }, kind: 'free' });
  });

  it('ignores corners and edges with snapping off (Alt)', () => {
    const off = { threshold: 5, snap: false };
    expect(snap({ x: 2, y: 3 }, null, off)).toEqual({ point: { x: 2, y: 3 }, kind: 'free' });
    const hit = snap({ x: 3, y: 4.1 }, { x: 0, y: 0 }, off);
    expect(length({ x: 0, y: 0 }, hit.point)).toBeCloseTo(5, 9);
  });
});
