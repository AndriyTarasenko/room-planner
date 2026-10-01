import type { FurnitureItem } from '../types';
import { type LShape, frameOf, lArms } from './footprint';
import { type Point, localToWorld } from './rect';

/**
 * The handles of a selected L-shaped item. Dragging the end of an arm sets that arm's length
 * (the item's width for the main part, its depth for the return leg); dragging the inner edge
 * of an arm sets how deep that arm is. The outer corner where the arms meet stays put.
 */
export type LHandle = 'main-end' | 'main-inner' | 'return-end' | 'return-inner';

export const L_HANDLES: readonly LHandle[] = ['main-end', 'main-inner', 'return-end', 'return-inner'];

/** Smallest arm depth the handles and the inspector offer, in cm. */
export const L_MIN_ARM = 10;

export type LItem = Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'> & { shape: LShape };

export interface LHandleSpot {
  /** Middle of the edge the handle moves, in the item's local frame. */
  at: Point;
  /** The local axis that edge moves along. */
  axis: 'x' | 'y';
  /** Length of the edge, in cm. */
  length: number;
  /** Local direction pointing away from the arm, where there is room for a label. */
  outward: Point;
}

/** +1 for a return on the right, −1 for its mirror image on the left. */
const mirror = (shape: LShape) => (shape.returnSide === 'right' ? 1 : -1);

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function lHandleSpot(item: LItem, handle: LHandle): LHandleSpot {
  const hw = item.width / 2;
  const hd = item.depth / 2;
  const { main: s, leg: r } = lArms(item.width, item.depth, item.shape);
  const m = mirror(item.shape);
  switch (handle) {
    case 'main-end':
      return { at: { x: -hw * m, y: -hd + s / 2 }, axis: 'x', length: s, outward: { x: -m, y: 0 } };
    case 'main-inner':
      return { at: { x: (-r / 2) * m, y: -hd + s }, axis: 'y', length: item.width - r, outward: { x: 0, y: 1 } };
    case 'return-end':
      return { at: { x: (hw - r / 2) * m, y: hd }, axis: 'y', length: r, outward: { x: 0, y: 1 } };
    case 'return-inner':
      return { at: { x: (hw - r) * m, y: s / 2 }, axis: 'x', length: item.depth - s, outward: { x: -m, y: 0 } };
  }
}

/** The size a handle changes: an arm's length or depth. */
export function lHandleValue(item: LItem, handle: LHandle): number {
  const { main, leg } = lArms(item.width, item.depth, item.shape);
  switch (handle) {
    case 'main-end':
      return item.width;
    case 'return-end':
      return item.depth;
    case 'main-inner':
      return main;
    case 'return-inner':
      return leg;
  }
}

/**
 * The item after dragging one of its handles to `local`, a point in the local frame of
 * `item` as it was when the drag began. Sizes are whole centimeters and only the dragged
 * edge moves; each arm keeps at least 1 cm of the other one free, so it stays an L.
 */
export function dragLHandle(item: LItem, handle: LHandle, local: Point, maxSize: number): LItem {
  const hw = item.width / 2;
  const hd = item.depth / 2;
  const arms = lArms(item.width, item.depth, item.shape);
  const m = mirror(item.shape);
  // Worked out for a return on the right; a left return is its mirror image.
  const x = local.x * m;
  const y = local.y;
  let { width, depth } = item;
  let { main: segment, leg: returnWidth } = arms;
  let shift: Point = { x: 0, y: 0 };
  switch (handle) {
    case 'main-end':
      width = clamp(Math.round(hw - x), returnWidth + 1, maxSize);
      shift = { x: (hw - width / 2) * m, y: 0 };
      break;
    case 'return-end':
      depth = clamp(Math.round(y + hd), segment + 1, maxSize);
      shift = { x: 0, y: depth / 2 - hd };
      break;
    case 'main-inner':
      segment = clamp(Math.round(y + hd), Math.min(L_MIN_ARM, item.depth - 1), Math.max(1, item.depth - 1));
      break;
    case 'return-inner':
      returnWidth = clamp(Math.round(hw - x), Math.min(L_MIN_ARM, item.width - 1), Math.max(1, item.width - 1));
      break;
  }
  const center = localToWorld(shift, frameOf(item));
  return { ...center, rotation: item.rotation, width, depth, shape: { ...item.shape, segment, returnWidth } };
}
