import { describe, expect, it } from 'vitest';
import type { Shape } from '../types';
import { applyShapeChoice, canBeRound, shapeChoiceOf } from './shapeChoice';

const RECT: Shape = { kind: 'rect' };
const ROUND: Shape = { kind: 'round' };
const L: Shape = { kind: 'l', segment: 60, returnSide: 'right' };

describe('shape choice', () => {
  it('names circles, ovals and rectangles', () => {
    expect(shapeChoiceOf({ width: 90, depth: 90, shape: ROUND })).toBe('round');
    expect(shapeChoiceOf({ width: 180, depth: 100, shape: ROUND })).toBe('oval');
    expect(shapeChoiceOf({ width: 90, depth: 90, shape: RECT })).toBe('rect');
    expect(shapeChoiceOf({ width: 160, depth: 120, shape: L })).toBeNull();
  });

  it('is offered for tables, poufs, plants and plain objects, and for anything already round', () => {
    expect(canBeRound({ type: 'table', shape: RECT })).toBe(true);
    expect(canBeRound({ type: 'pouf', shape: RECT })).toBe(true);
    expect(canBeRound({ type: 'generic', shape: RECT })).toBe(true);
    expect(canBeRound({ type: 'wardrobe', shape: RECT })).toBe(false);
    expect(canBeRound({ type: 'wardrobe', shape: ROUND })).toBe(true);
    expect(canBeRound({ type: 'table', shape: L })).toBe(false);
  });

  it('makes a rectangle round within its old footprint and an oval at its old size', () => {
    expect(applyShapeChoice({ width: 160, depth: 90, shape: RECT }, 'round')).toEqual({ shape: ROUND, width: 90, depth: 90 });
    expect(applyShapeChoice({ width: 160, depth: 90, shape: RECT }, 'oval')).toEqual({ shape: ROUND, width: 160, depth: 90 });
  });

  it('extends a circle into an oval half as wide again, and back', () => {
    expect(applyShapeChoice({ width: 120, depth: 120, shape: ROUND }, 'oval')).toEqual({ shape: ROUND, width: 180, depth: 120 });
    expect(applyShapeChoice({ width: 180, depth: 120, shape: ROUND }, 'round')).toEqual({ shape: ROUND, width: 120, depth: 120 });
    expect(applyShapeChoice({ width: 180, depth: 120, shape: ROUND }, 'rect')).toEqual({ shape: RECT, width: 180, depth: 120 });
  });
});
