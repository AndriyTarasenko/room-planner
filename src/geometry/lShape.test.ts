import { describe, expect, it } from 'vitest';
import { footprintBox, frameOf, localOutline } from './footprint';
import { type LHandle, type LItem, L_HANDLES, dragLHandle, lHandleSpot, lHandleValue } from './lShape';
import { localToWorld } from './rect';

/** A 240 × 160 sofa with a chaise on the right: 95 cm seats, a 90 cm wide chaise. */
const sofa: LItem = { x: 200, y: 100, width: 240, depth: 160, rotation: 0, shape: { kind: 'l', segment: 95, returnWidth: 90, returnSide: 'right' } };
const MAX = 2000;

/** Drags `handle` of `item` by `dx`, `dy` in the item's local frame. */
function dragBy(item: LItem, handle: LHandle, dx: number, dy: number): LItem {
  const { at } = lHandleSpot(item, handle);
  return dragLHandle(item, handle, { x: at.x + dx, y: at.y + dy }, MAX);
}

describe('L-shape arm handles', () => {
  it('sit in the middle of each arm’s end and of the free part of its inner edge', () => {
    // Local frame: the box spans x −120…120, y −80…80; the chaise covers x 30…120.
    expect(lHandleSpot(sofa, 'main-end')).toMatchObject({ at: { x: -120, y: -32.5 }, axis: 'x', length: 95 });
    expect(lHandleSpot(sofa, 'main-inner')).toMatchObject({ at: { x: -45, y: 15 }, axis: 'y', length: 150 });
    expect(lHandleSpot(sofa, 'return-end')).toMatchObject({ at: { x: 75, y: 80 }, axis: 'y', length: 90 });
    expect(lHandleSpot(sofa, 'return-inner')).toMatchObject({ at: { x: 30, y: 47.5 }, axis: 'x', length: 65 });
  });

  it('lengthen the main part from its free end, keeping the corner in place', () => {
    const longer = dragBy(sofa, 'main-end', -30.4, 12);
    expect(longer.width).toBe(270);
    expect(longer.depth).toBe(160);
    expect(longer.shape).toEqual(sofa.shape);
    expect(footprintBox(longer)).toEqual({ ...footprintBox(sofa), minX: footprintBox(sofa).minX - 30 });
  });

  it('lengthen the return leg from its end, keeping the back in place', () => {
    const longer = dragBy(sofa, 'return-end', 5, 25);
    expect([longer.width, longer.depth]).toEqual([240, 185]);
    expect(footprintBox(longer)).toEqual({ ...footprintBox(sofa), maxY: footprintBox(sofa).maxY + 25 });
  });

  it('change only the depth of the arm whose inner edge is dragged', () => {
    const deeper = dragBy(sofa, 'main-inner', 0, 10);
    expect(deeper.shape).toMatchObject({ segment: 105, returnWidth: 90 });
    expect(deeper).toMatchObject({ x: sofa.x, y: sofa.y, width: 240, depth: 160 });

    const wider = dragBy(sofa, 'return-inner', -15, 0);
    expect(wider.shape).toMatchObject({ segment: 95, returnWidth: 105 });
    expect(wider).toMatchObject({ x: sofa.x, y: sofa.y, width: 240, depth: 160 });
    expect(localOutline(wider)).toContainEqual({ x: 15, y: 80 });
  });

  it('report the size each handle sets', () => {
    expect(L_HANDLES.map((h) => [h, lHandleValue(sofa, h)])).toEqual([
      ['main-end', 240],
      ['main-inner', 95],
      ['return-end', 160],
      ['return-inner', 90],
    ]);
  });

  it('stop where the shape would no longer be an L', () => {
    expect(dragBy(sofa, 'main-end', 500, 0).width).toBe(91);
    expect(dragBy(sofa, 'return-end', 0, -500).depth).toBe(96);
    expect(dragBy(sofa, 'main-inner', 0, 500).shape.segment).toBe(159);
    expect(dragBy(sofa, 'main-inner', 0, -500).shape.segment).toBe(10);
    expect(dragBy(sofa, 'return-inner', -500, 0).shape.returnWidth).toBe(239);
    expect(dragBy(sofa, 'return-inner', 500, 0).shape.returnWidth).toBe(10);
    expect(dragBy(sofa, 'main-end', -5000, 0).width).toBe(MAX);
  });

  it('mirror everything for a return on the left', () => {
    const left: LItem = { ...sofa, shape: { ...sofa.shape, returnSide: 'left' } };
    expect(lHandleSpot(left, 'main-end').at).toEqual({ x: 120, y: -32.5 });
    expect(lHandleSpot(left, 'return-inner').at).toEqual({ x: -30, y: 47.5 });
    const longer = dragBy(left, 'main-end', 30, 0);
    expect(footprintBox(longer)).toEqual({ ...footprintBox(left), maxX: footprintBox(left).maxX + 30 });
    expect(dragBy(left, 'return-inner', 15, 0).shape.returnWidth).toBe(105);
  });

  it('work in the item’s own frame when it is rotated', () => {
    const turned: LItem = { ...sofa, rotation: 90 };
    const corner = localToWorld({ x: 120, y: -80 }, frameOf(turned));
    const longer = dragBy(turned, 'main-end', -40, 0);
    expect(longer.width).toBe(280);
    expect(longer.rotation).toBe(90);
    // The outer corner where the arms meet hasn't moved.
    const after = localToWorld({ x: 140, y: -80 }, frameOf(longer));
    expect(after.x).toBeCloseTo(corner.x, 9);
    expect(after.y).toBeCloseTo(corner.y, 9);
  });
});
