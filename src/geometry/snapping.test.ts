import { describe, expect, it } from 'vitest';
import { snapBox, snapValue } from './snapping';
import { centeredViewport, fitScale, panForZoom, viewToWorld, worldToView } from './viewport';

const room = { width: 380, depth: 320 };
const base = { room, threshold: 5, walls: true, targets: [], grid: null };

describe('grid snapping', () => {
  it('rounds to the nearest grid step', () => {
    expect(snapValue(14, 10)).toBe(10);
    expect(snapValue(15, 10)).toBe(20);
    expect(snapValue(37, 25)).toBe(25);
    expect(snapValue(12.4, 5)).toBe(10);
  });

  it('snaps the top-left edge of a box to the grid', () => {
    const r = snapBox({ minX: 43, minY: 101, maxX: 223, maxY: 181 }, { ...base, walls: false, grid: 10 });
    expect(r.dx).toBe(-3);
    expect(r.dy).toBe(-1);
    expect(r.guides).toEqual([]);
  });
});

describe('wall snapping', () => {
  it('snaps to a wall within the threshold and returns a guide', () => {
    const r = snapBox({ minX: 3, minY: 100, maxX: 183, maxY: 180 }, base);
    expect(r.dx).toBe(-3);
    expect(r.dy).toBe(0);
    expect(r.guides).toEqual([{ orientation: 'vertical', position: 0, start: 0, end: 320, kind: 'wall' }]);
  });

  it('snaps the far edge to the opposite wall', () => {
    const r = snapBox({ minX: 200, minY: 236, maxX: 300, maxY: 316 }, base);
    expect(r.dy).toBe(4);
    expect(r.guides[0]).toMatchObject({ orientation: 'horizontal', position: 320 });
  });

  it('does nothing outside the threshold', () => {
    const r = snapBox({ minX: 10, minY: 100, maxX: 190, maxY: 180 }, base);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('prefers edge snapping over grid snapping on the same axis', () => {
    const r = snapBox({ minX: 2, minY: 101, maxX: 182, maxY: 181 }, { ...base, grid: 25 });
    expect(r.dx).toBe(-2);
    // No edge near on y, so the grid applies there.
    expect(r.dy).toBe(-1);
  });
});

describe('object snapping', () => {
  const desk = { id: 'desk', box: { minX: 40, minY: 0, maxX: 220, maxY: 80 } };

  it('snaps edge-to-edge next to another object', () => {
    // Sideboard 3 cm right of the desk snaps flush against it.
    const r = snapBox({ minX: 223, minY: 0, maxX: 383, maxY: 45 }, { ...base, walls: false, targets: [desk] });
    expect(r.dx).toBe(-3);
    expect(r.guides[0]).toMatchObject({ orientation: 'vertical', position: 220, kind: 'object' });
  });

  it('aligns centers', () => {
    // Monitor 61 cm wide, center at 128 vs desk center 130.
    const r = snapBox({ minX: 97.5, minY: 10, maxX: 158.5, maxY: 30 }, { ...base, walls: false, targets: [desk] });
    expect(r.dx).toBeCloseTo(2, 9);
  });

  it('ignores objects that are far away', () => {
    const far = { id: 'far', box: { minX: 1000, minY: 1000, maxX: 1100, maxY: 1100 } };
    const r = snapBox({ minX: 998, minY: 500, maxX: 1010, maxY: 510 }, { ...base, walls: false, targets: [far], objectRange: 100 });
    expect(r.dx).toBe(0);
  });

  it('picks the closest candidate', () => {
    const r = snapBox({ minX: 222, minY: 200, maxX: 262, maxY: 240 }, { ...base, walls: false, targets: [desk, { id: 'b', box: { minX: 223, minY: 150, maxX: 300, maxY: 190 } }] });
    expect(r.dx).toBe(1);
  });
});

describe('coordinate conversion', () => {
  it('fits the room inside the canvas preserving proportions', () => {
    // 1000×800 canvas with 50 px padding: min(900/380, 700/320) = 2.1875
    expect(fitScale(room, 1000, 800, 50)).toBeCloseTo(2.1875, 6);
  });

  it('centers the room and round-trips coordinates', () => {
    const vp = centeredViewport(room, 1000, 800, 50);
    expect(vp.originY).toBeCloseTo(50, 6);
    expect(vp.originX).toBeCloseTo((1000 - 380 * vp.scale) / 2, 6);
    const p = { x: 123.4, y: 56.7 };
    const back = viewToWorld(worldToView(p, vp), vp);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const before = centeredViewport(room, 1000, 800, 50, 1);
    const after = centeredViewport(room, 1000, 800, 50, 2);
    const anchor = { x: 300, y: 200 };
    const pan = { x: 10, y: -20 };
    const worldBefore = viewToWorld({ x: anchor.x - pan.x, y: anchor.y - pan.y }, before);
    const newPan = panForZoom(anchor, pan, before, after);
    const worldAfter = viewToWorld({ x: anchor.x - newPan.x, y: anchor.y - newPan.y }, after);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
  });
});
