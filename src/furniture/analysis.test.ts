import { describe, expect, it } from 'vitest';
import { createOpening } from '../plan/openings';
import { createRoom, createRoomFromCorners } from '../plan/rooms';
import { defaultWalls } from '../plan/walls';
import type { FurnitureItem } from '../types';
import { analyzeLayout } from './analysis';
import { createItemFromPreset } from './factory';
import { findPreset } from './presets';

const room = [createRoom({ name: 'Office', width: 380, depth: 320 })];
const make = (presetId: string, x: number, y: number, overrides: Partial<FurnitureItem> = {}) => ({
  ...createItemFromPreset(findPreset(presetId)!, { x, y }),
  ...overrides,
});

describe('layout analysis rules', () => {
  it('does not treat monitors standing on a desk as collisions', () => {
    const desk = make('desk-180', 130, 40);
    const monitor = make('monitor-27', 130, 20, { attachedTo: desk.id });
    expect(analyzeLayout([desk, monitor], room).collisions).toHaveLength(0);
  });

  it('reports overlapping monitors', () => {
    const a = make('monitor-27', 130, 20);
    const b = make('monitor-27', 150, 20);
    expect(analyzeLayout([a, b], room).collisions).toHaveLength(1);
  });

  it('lets items opt out of collision warnings', () => {
    const desk = make('desk-180', 130, 40);
    const pc = make('pc-tower', 60, 40, { ignoreCollisions: true });
    expect(analyzeLayout([desk, pc], room).collisions).toHaveLength(0);
  });

  it('allows the chair inside the desk seating zone but not other furniture', () => {
    const desk = make('desk-180', 130, 40, { clearance: { enabled: true, front: 90, back: 0, left: 0, right: 0 } });
    const chair = make('office-chair', 130, 122.5);
    const shelf = make('shelf', 130, 110);
    expect(analyzeLayout([desk, chair], room).clearanceConflicts).toHaveLength(0);
    expect(analyzeLayout([desk, shelf], room).clearanceConflicts).toMatchObject([{ ownerId: desk.id, intruderId: shelf.id }]);
  });

  it('flags a wardrobe whose doors face a wall', () => {
    const facingRoom = make('wardrobe', 100, 30); // against the top wall, doors open into the room
    const facingWall = make('wardrobe', 250, 290); // against the bottom wall, doors face the wall
    const analysis = analyzeLayout([facingRoom, facingWall], room);
    expect([...analysis.wallBlockedClearanceIds]).toEqual([facingWall.id]);
    expect(analysis.issues.some((i) => i.itemId === facingWall.id && i.kind === 'clearance')).toBe(true);
  });

  it('marks items outside the room', () => {
    const desk = make('desk-180', 20, 40);
    expect([...analyzeLayout([desk], room).outsideIds]).toEqual([desk.id]);
  });

  it('computes free floor without counting surface items', () => {
    const desk = make('desk-180', 130, 40);
    const monitor = make('monitor-27', 130, 20);
    const usage = analyzeLayout([desk, monitor], room).usage;
    expect(usage.total - usage.free).toBeCloseTo(180 * 80, -1);
  });
});

describe('floor plans with several rooms and doors', () => {
  const openSide = { kind: 'open', thickness: 12 } as const;
  // 20 cm from the bottom-left corner: the bottom wall runs right to left, so 280 cm from its start.
  const door = { ...createOpening('door', 2, 280, 80), hinge: 'end' as const };
  const office = createRoom({ name: 'Office', width: 380, depth: 320, openings: [door] });

  it('flags furniture standing in a door’s swing, but not next to it', () => {
    const inSwing = make('sideboard', 100, 290);
    const beside = make('sideboard', 300, 297.5);
    const analysis = analyzeLayout([inSwing, beside], [office]);
    expect(analysis.doorConflicts).toMatchObject([{ roomId: office.id, openingId: door.id, itemId: inSwing.id }]);
    expect([...analysis.blockedDoorIds]).toEqual([door.id]);
    expect(analysis.issues.filter((i) => i.itemId === inSwing.id).map((i) => i.message)).toEqual(['Blocks the Office door']);
    expect(analysis.issues.some((i) => i.itemId === beside.id)).toBe(false);
  });

  it('ignores a door that opens outward, and items allowed to overlap', () => {
    const inSwing = make('sideboard', 100, 290);
    const outward = { ...office, openings: [{ ...door, swing: 'out' as const }] };
    expect(analyzeLayout([inSwing], [outward]).doorConflicts).toHaveLength(0);
    expect(analyzeLayout([{ ...inSwing, ignoreCollisions: true }], [office]).doorConflicts).toHaveLength(0);
  });

  it('lets furniture span two rooms joined by open sides, but not a wall', () => {
    const living = createRoom({ name: 'Living', width: 300, depth: 300, walls: defaultWalls().map((w, i) => (i === 1 ? openSide : w)) });
    const kitchen = createRoom({ name: 'Kitchen', x: 300, width: 200, depth: 300, walls: defaultWalls().map((w, i) => (i === 3 ? openSide : w)) });
    const table = make('sideboard', 300, 150);
    expect(analyzeLayout([table], [living, kitchen]).outsideIds.size).toBe(0);

    const bedroom = createRoom({ name: 'Bedroom', x: 312, width: 200, depth: 300 });
    const throughWall = make('sideboard', 306, 150);
    const analysis = analyzeLayout([throughWall], [createRoom({ name: 'Hall', width: 300, depth: 300 }), bedroom]);
    expect([...analysis.outsideIds]).toEqual([throughWall.id]);
    expect(analysis.issues.find((i) => i.kind === 'outside')?.message).toBe('Not fully inside a room');
  });

  it('knows the floor of odd-shaped rooms', () => {
    // An L: 500 × 400 without its top-right 200 × 200.
    const l = createRoomFromCorners([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ]);
    const inCorner = make('sideboard', 400, 100);
    const inside = make('sideboard', 400, 300);
    const analysis = analyzeLayout([inCorner, inside], [l]);
    expect([...analysis.outsideIds]).toEqual([inCorner.id]);
    expect(analysis.usage.total).toBe(500 * 400 - 200 * 200);

    // A cabinet turned to stand flat against a 45° wall is inside, although its bounding box isn't.
    const slanted = createRoomFromCorners([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 300 }]);
    const against = { ...make('sideboard', 0, 0), rotation: 45, width: 100, depth: 40 };
    // Center 20 cm in from the middle of the slanted wall (350, 50).
    const along = { ...against, x: 350 - 20 / Math.SQRT2, y: 50 + 20 / Math.SQRT2 };
    expect(analyzeLayout([along], [slanted]).outsideIds.size).toBe(0);
  });

  it('computes free floor per room and for the whole plan', () => {
    const bedroom = createRoom({ name: 'Bedroom', x: 392, width: 300, depth: 320 });
    const sideboard = make('sideboard', 500, 100);
    const analysis = analyzeLayout([sideboard], [office, bedroom]);
    expect(analysis.roomUsage.get(office.id)!.free).toBe(380 * 320);
    // Rasterized on a 2 cm grid, so within a few hundred cm² for a 45 cm deep item.
    expect(analysis.roomUsage.get(bedroom.id)!.free).toBeCloseTo(300 * 320 - 160 * 45, -3);
    expect(analysis.usage.total).toBe(380 * 320 + 300 * 320);
  });
});
