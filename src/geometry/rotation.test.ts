import { describe, expect, it } from 'vitest';
import { angleDistance, rotationSnapAngles, snapRotation, stepRotation } from './rotation';

const rectangle = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 0, y: 300 },
];
// The left wall runs from (100, 300) up to (0, 0): slanted by atan(1/3) ≈ 18.43° from vertical.
const slanted = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 300 },
  { x: 100, y: 300 },
];
const SLANT = 71.565051;

describe('angleDistance', () => {
  it('measures the short way round', () => {
    expect(angleDistance(350, 10)).toBe(20);
    expect(angleDistance(10, 350)).toBe(20);
    expect(angleDistance(0, 180)).toBe(180);
    expect(angleDistance(-30, 330)).toBe(0);
  });
});

describe('rotationSnapAngles', () => {
  it('are the quarter turns and diagonals in a rectangular room', () => {
    expect(rotationSnapAngles(rectangle)).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
  });

  it('add the four angles that line an item up with each slanted wall', () => {
    const angles = rotationSnapAngles(slanted);
    expect(angles).toHaveLength(12);
    for (const expected of [SLANT, SLANT + 90, SLANT + 180, SLANT + 270]) {
      expect(angles.some((a) => Math.abs(a - expected) < 1e-5)).toBe(true);
    }
  });

  it('list a direction shared by parallel walls once', () => {
    // A parallelogram: both slanted walls run at the same angle.
    const parallelogram = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 400, y: 300 },
      { x: 100, y: 300 },
    ];
    expect(rotationSnapAngles(parallelogram)).toHaveLength(12);
  });
});

describe('snapRotation', () => {
  const targets = rotationSnapAngles(slanted);

  it('rounds to whole degrees and keeps angles in [0, 360)', () => {
    expect(snapRotation(12.4)).toBe(12);
    expect(snapRotation(-30.2)).toBe(330);
    expect(snapRotation(359.6)).toBe(0);
    expect(snapRotation(725)).toBe(5);
  });

  it('sticks to a snap angle within the tolerance, and only then', () => {
    expect(snapRotation(46.6, { targets })).toBe(45);
    expect(snapRotation(357, { targets })).toBe(0);
    expect(snapRotation(73, { targets })).toBeCloseTo(SLANT, 5);
    expect(snapRotation(76, { targets })).toBe(76);
    expect(snapRotation(37.4, { targets })).toBe(37);
  });

  it('prefers the closest snap angle', () => {
    expect(snapRotation(2, { targets: [0, 3] })).toBe(3);
    expect(snapRotation(1, { targets: [0, 3] })).toBe(0);
  });

  it('moves in fixed steps when a step is given, ignoring snap angles', () => {
    expect(snapRotation(37, { step: 15 })).toBe(30);
    expect(snapRotation(38, { step: 15 })).toBe(45);
    expect(snapRotation(353, { step: 15 })).toBe(0);
    expect(snapRotation(73, { step: 15, targets })).toBe(75);
  });
});

describe('stepRotation', () => {
  it('turns by one step from an angle on a step', () => {
    expect(stepRotation(0, 1)).toBe(15);
    expect(stepRotation(0, -1)).toBe(345);
    expect(stepRotation(45, 1)).toBe(60);
    expect(stepRotation(345, 1)).toBe(0);
    expect(stepRotation(30.0000001, 1)).toBe(45);
  });

  it('goes to the next step in that direction from an angle between steps', () => {
    expect(stepRotation(37, 1)).toBe(45);
    expect(stepRotation(37, -1)).toBe(30);
    expect(stepRotation(SLANT, -1, 1)).toBe(71);
    expect(stepRotation(SLANT, 1, 1)).toBe(72);
  });
});
