import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, type Pinch, centeredViewport, pinchView, viewToWorld } from './viewport';

const plan = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
const fit = (zoom: number) => centeredViewport(plan, 800, 600, 64, zoom);
/** The plan point under a canvas point. */
const under = (p: { x: number; y: number }, zoom: number, pan: { x: number; y: number }) =>
  viewToWorld({ x: p.x - pan.x, y: p.y - pan.y }, fit(zoom));

describe('pinchView', () => {
  it('zooms by how much the fingers spread, around the point between them', () => {
    const from: Pinch = { center: { x: 300, y: 200 }, distance: 100 };
    const to: Pinch = { center: { x: 300, y: 200 }, distance: 150 };
    const view = pinchView(from, to, 1, { x: 0, y: 0 }, fit);
    expect(view.zoom).toBeCloseTo(1.5);
    const before = under(from.center, 1, { x: 0, y: 0 });
    const after = under(to.center, view.zoom, view.pan);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('pans with the fingers when they move together', () => {
    const from: Pinch = { center: { x: 300, y: 200 }, distance: 120 };
    const to: Pinch = { center: { x: 340, y: 170 }, distance: 120 };
    const view = pinchView(from, to, 2, { x: 10, y: -5 }, fit);
    expect(view.zoom).toBe(2);
    expect(view.pan.x).toBeCloseTo(50);
    expect(view.pan.y).toBeCloseTo(-35);
  });

  it('keeps the plan point between the fingers under them while zooming and moving', () => {
    const from: Pinch = { center: { x: 420, y: 260 }, distance: 200 };
    const to: Pinch = { center: { x: 380, y: 300 }, distance: 120 };
    const pan = { x: -30, y: 12 };
    const view = pinchView(from, to, 1.2, pan, fit);
    const before = under(from.center, 1.2, pan);
    const after = under(to.center, view.zoom, view.pan);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('stops at the zoom limit without drifting', () => {
    const from: Pinch = { center: { x: 400, y: 300 }, distance: 100 };
    const to: Pinch = { center: { x: 400, y: 300 }, distance: 400 };
    const view = pinchView(from, to, MAX_ZOOM, { x: 0, y: 0 }, fit);
    expect(view.zoom).toBe(MAX_ZOOM);
    expect(view.pan.x).toBeCloseTo(0);
    expect(view.pan.y).toBeCloseTo(0);
  });
});
