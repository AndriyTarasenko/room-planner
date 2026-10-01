import { findCollisions } from '../geometry/collision';
import { frameOf, worldParts } from '../geometry/footprint';
import { clampShapeIntoPolygon, polygonLabelPoint } from '../geometry/bounds';
import { type Point, localToWorld, normalizeAngle, worldToLocal } from '../geometry/rect';
import type { Category, Clearance, FurnitureItem, Placement, Shape } from '../types';
import { createId } from '../utils/id';
import { CATEGORIES } from './categories';
import type { FurniturePreset } from './presets';
import { canCollide } from './rules';

export const EMPTY_CLEARANCE: Clearance = { enabled: false, front: 0, back: 0, left: 0, right: 0 };

export function createItemFromPreset(preset: FurniturePreset, position: Point): FurnitureItem {
  return {
    id: createId('item'),
    type: preset.type,
    name: preset.name,
    x: position.x,
    y: position.y,
    width: preset.width,
    depth: preset.depth,
    height: preset.height,
    rotation: preset.rotation ?? 0,
    category: preset.category,
    color: preset.color ?? CATEGORIES[preset.category].color,
    notes: '',
    placement: preset.placement,
    ignoreCollisions: false,
    clearance: { ...EMPTY_CLEARANCE, ...preset.clearance },
    shape: preset.shape ?? { kind: 'rect' },
    attachedTo: null,
    showDeskGuides: false,
  };
}

export interface CustomItemInput {
  name: string;
  width: number;
  depth: number;
  height: number;
  category: Category;
  placement: Placement;
  /** Rectangular or round (a circle when width and depth are equal). */
  shape: Shape;
}

export function createCustomItem(input: CustomItemInput, position: Point): FurnitureItem {
  return createItemFromPreset(
    {
      id: 'custom',
      label: input.name,
      name: input.name.trim() || 'Object',
      type: 'generic',
      category: input.category,
      width: input.width,
      depth: input.depth,
      height: input.height,
      placement: input.placement,
      shape: input.shape,
    },
    position,
  );
}

const HOST_BACK_MARGIN = 5;
const ROW_GAP = 2;

export interface HostPlacement {
  position: Point & { rotation: number };
  /** Existing items on the host that were shifted to make room. */
  moved: Map<string, Point>;
}

/**
 * Places a surface item (monitor, console) on a host such as a desk, along its back edge.
 * Items of the same type already standing in that row are re-centered together with the new
 * one, so adding two monitors gives a centered pair. Otherwise the nearest free spot on the
 * row is used; returns null when nothing fits on the host.
 */
export function placeOnHost(
  item: FurnitureItem,
  host: FurnitureItem,
  existing: readonly FurnitureItem[],
): HostPlacement | null {
  const frame = frameOf(host);
  const rowY = (depth: number) => -host.depth / 2 + depth / 2 + HOST_BACK_MARGIN;
  const rotation = host.rotation;

  // Only same-type items are re-centered (monitors with monitors); others keep their place.
  const row = existing
    .filter((i) => i.attachedTo === host.id && i.placement === 'surface' && i.type === item.type)
    .map((i) => ({ item: i, local: worldToLocal(i, frame) }))
    .filter(({ item: i, local }) => Math.abs(local.y - rowY(i.depth)) < 10)
    .sort((a, b) => a.local.x - b.local.x);

  if (row.length > 0) {
    const members = [...row.map((r) => r.item), item];
    const total = members.reduce((sum, m) => sum + m.width, 0) + ROW_GAP * (members.length - 1);
    if (total <= host.width) {
      let x = -total / 2;
      const moved = new Map<string, Point>();
      let position: HostPlacement['position'] | null = null;
      for (const m of members) {
        const p = localToWorld({ x: x + m.width / 2, y: rowY(m.depth) }, frame);
        if (m.id === item.id) position = { ...p, rotation };
        else moved.set(m.id, p);
        x += m.width + ROW_GAP;
      }
      return { position: position!, moved };
    }
  }

  // Nearest free spot along the row, scanning outward from the center in 1 cm steps.
  const maxOffset = (host.width - item.width) / 2;
  for (let d = 0; d <= maxOffset; d++) {
    for (const localX of d === 0 ? [0] : [d, -d]) {
      const p = localToWorld({ x: localX, y: rowY(item.depth) }, frame);
      const candidate = { ...item, x: p.x, y: p.y, rotation };
      const hits = findCollisions([candidate, ...existing], (a, b) => (a.id === item.id || b.id === item.id) && canCollide(a, b));
      if (hits.length === 0) return { position: { ...p, rotation }, moved: new Map() };
    }
  }
  return null;
}

/** Where a chair goes for a desk: centered in front of the desk top, facing it, 10 cm away. */
export function chairSpotForDesk(chair: FurnitureItem, desk: FurnitureItem): Point & { rotation: number } {
  const top = desk.shape.kind === 'l' ? -desk.depth / 2 + desk.shape.segment : desk.depth / 2;
  const x = desk.shape.kind === 'l' ? (desk.shape.returnSide === 'right' ? -chair.width / 2 : chair.width / 2) : 0;
  const p = localToWorld({ x, y: top + 10 + chair.depth / 2 }, frameOf(desk));
  return { ...p, rotation: normalizeAngle(desk.rotation + 180) };
}

/**
 * Finds a sensible spot for a new item in a room (its floor polygon): the requested point (or
 * the middle of the room), nudged outward in 10 cm steps until it neither collides with
 * anything nor leaves the room.
 */
export function findFreeSpot(item: FurnitureItem, room: readonly Point[], existing: readonly FurnitureItem[], preferred?: Point): Point {
  const start = preferred ?? polygonLabelPoint(room).point;
  const offset = (p: Point) => clampShapeIntoPolygon(worldParts({ ...item, ...p }), room);
  const fits = (p: Point) => {
    const candidate = { ...item, ...p };
    const off = offset(p);
    if (Math.abs(off.dx) > 1e-9 || Math.abs(off.dy) > 1e-9) return false;
    return findCollisions([candidate, ...existing], (a, b) => (a.id === item.id || b.id === item.id) && canCollide(a, b)).length === 0;
  };
  const inside = (p: Point): Point => {
    const off = offset(p);
    return { x: p.x + off.dx, y: p.y + off.dy };
  };

  const origin = inside(start);
  if (fits(origin)) return origin;
  const step = 10;
  for (let ring = 1; ring <= 40; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dy] of [
        [i, -ring],
        [i, ring],
        [-ring, i],
        [ring, i],
      ]) {
        const p = { x: origin.x + dx * step, y: origin.y + dy * step };
        if (fits(p)) return p;
      }
    }
  }
  return origin;
}
