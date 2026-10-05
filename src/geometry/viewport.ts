import { type Box, type Point, boxHeight, boxWidth } from './rect';

/**
 * Maps plan coordinates (cm) to canvas coordinates (px):
 * view = origin + world * scale.
 */
export interface Viewport {
  scale: number;
  originX: number;
  originY: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 8;

/** Pixels per centimeter that make `bounds` fit inside the canvas with `padding` px on each side. */
export function fitScale(bounds: Box, viewWidth: number, viewHeight: number, padding: number): number {
  const availableW = Math.max(1, viewWidth - padding * 2);
  const availableH = Math.max(1, viewHeight - padding * 2);
  return Math.max(0.01, Math.min(availableW / Math.max(1, boxWidth(bounds)), availableH / Math.max(1, boxHeight(bounds))));
}

/** Viewport with `bounds` (usually the whole floor plan) centered, scaled by `zoom` relative to the fit scale. */
export function centeredViewport(
  bounds: Box,
  viewWidth: number,
  viewHeight: number,
  padding: number,
  zoom = 1,
): Viewport {
  const scale = fitScale(bounds, viewWidth, viewHeight, padding) * zoom;
  return {
    scale,
    originX: (viewWidth - boxWidth(bounds) * scale) / 2 - bounds.minX * scale,
    originY: (viewHeight - boxHeight(bounds) * scale) / 2 - bounds.minY * scale,
  };
}

export function worldToView(p: Point, vp: Viewport): Point {
  return { x: vp.originX + p.x * vp.scale, y: vp.originY + p.y * vp.scale };
}

export function viewToWorld(p: Point, vp: Viewport): Point {
  return { x: (p.x - vp.originX) / vp.scale, y: (p.y - vp.originY) / vp.scale };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Pan offset (added to the centered viewport) that keeps `anchor` (canvas px)
 * pointing at the same world point when zoom changes from `before` to `after`.
 */
export function panForZoom(anchor: Point, pan: Point, before: Viewport, after: Viewport): Point {
  const world = viewToWorld({ x: anchor.x - pan.x, y: anchor.y - pan.y }, before);
  const projected = worldToView(world, after);
  return { x: anchor.x - projected.x, y: anchor.y - projected.y };
}

/** Two fingers on the canvas: the point between them (canvas px) and how far apart they are. */
export interface Pinch {
  center: Point;
  distance: number;
}

/**
 * Zoom and pan after the fingers of a pinch move from `from` to `to`: the plan grows as much
 * as the fingers spread, and the plan point between them follows them. `fit(zoom)` is the
 * centered viewport at that zoom.
 */
export function pinchView(from: Pinch, to: Pinch, zoom: number, pan: Point, fit: (zoom: number) => Viewport): { zoom: number; pan: Point } {
  const next = clampZoom(zoom * (to.distance / Math.max(1, from.distance)));
  const zoomed = panForZoom(from.center, pan, fit(zoom), fit(next));
  return { zoom: next, pan: { x: zoomed.x + to.center.x - from.center.x, y: zoomed.y + to.center.y - from.center.y } };
}

/**
 * Stage scale and position that make a plan drawn for `drawn` look as it would drawn for
 * `target` with the stage at `pan`. A pinch moves the drawing this way and redraws the plan
 * for the new view only when it ends.
 */
export function stageTransformFor(drawn: Viewport, target: Viewport, pan: Point): { scale: number; x: number; y: number } {
  const scale = target.scale / drawn.scale;
  return { scale, x: pan.x + target.originX - drawn.originX * scale, y: pan.y + target.originY - drawn.originY * scale };
}
