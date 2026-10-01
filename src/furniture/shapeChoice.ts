import { ITEM_LIMITS } from '../store/defaults';
import type { FurnitureItem, FurnitureType, Shape } from '../types';

/**
 * The outline as the inspector and the custom-object dialog offer it. A circle and an oval
 * are both `round` shapes; a circle is the one whose width and depth are equal.
 */
export type ShapeChoice = 'rect' | 'round' | 'oval';

export const SHAPE_CHOICES: readonly { value: ShapeChoice; label: string; title: string }[] = [
  { value: 'rect', label: 'Rectangle', title: 'Rectangular or square' },
  { value: 'round', label: 'Round', title: 'A circle: one diameter' },
  { value: 'oval', label: 'Oval', title: 'An ellipse with its own width and depth' },
];

/** Kinds that come in round versions: tables, poufs and stools, plants and plain objects. */
const ROUND_TYPES: ReadonlySet<FurnitureType> = new Set(['table', 'pouf', 'plant', 'generic']);

/** Whether an item can switch between rectangular and round. Round items can always switch back. */
export const canBeRound = (item: Pick<FurnitureItem, 'type' | 'shape'>) =>
  item.shape.kind === 'round' || (item.shape.kind === 'rect' && ROUND_TYPES.has(item.type));

export function shapeChoiceOf(item: Pick<FurnitureItem, 'width' | 'depth' | 'shape'>): ShapeChoice | null {
  if (item.shape.kind === 'l') return null;
  if (item.shape.kind === 'rect') return 'rect';
  return item.width === item.depth ? 'round' : 'oval';
}

/**
 * Shape and size after switching to `choice`. A rectangle keeps its size either way; making
 * something round uses its shorter side as the diameter, so it stays within its old
 * footprint; an oval made from a circle is half as wide again, like an extended round table.
 */
export function applyShapeChoice(
  item: Pick<FurnitureItem, 'width' | 'depth' | 'shape'>,
  choice: ShapeChoice,
): { shape: Shape; width: number; depth: number } {
  const { width, depth } = item;
  if (choice === 'rect') return { shape: { kind: 'rect' }, width, depth };
  if (choice === 'round') {
    const diameter = Math.min(width, depth);
    return { shape: { kind: 'round' }, width: diameter, depth: diameter };
  }
  if (width === depth) return { shape: { kind: 'round' }, width: Math.min(ITEM_LIMITS.max, Math.round(width * 1.5)), depth };
  return { shape: { kind: 'round' }, width, depth };
}
