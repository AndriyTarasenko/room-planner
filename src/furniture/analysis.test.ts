import { describe, expect, it } from 'vitest';
import type { FurnitureItem, Room } from '../types';
import { analyzeLayout } from './analysis';
import { createItemFromPreset } from './factory';
import { findPreset } from './presets';

const room: Room = { id: 'r', width: 380, depth: 320 };
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
