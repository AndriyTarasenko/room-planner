import { describe, expect, it } from 'vitest';
import { createItemFromPreset } from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import { boxPolygon } from '../geometry/bounds';
import { boxOfPoints } from '../geometry/rect';
import type { Wall } from '../types';
import {
  clampOpening,
  createOpening,
  doorSwing,
  freeOpeningPlacement,
  openingCut,
  openingDropTarget,
  planExtent,
  resolveOpeningDrag,
} from './openings';
import { snapRoomEdge, snapRoomMove } from './roomSnapping';
import { createRoom, dockedRoomPosition, floorClampOffset, isBoxOnFloor, itemIdsInRoom, nextRoomName, roomAt } from './rooms';
import { defaultWalls, outerBox, planBounds, wallNames, wallPolygon } from './walls';

/** Walls top, right, bottom, left, with the given ones left open. */
const open = (walls: Wall[], ...indices: number[]): Wall[] => walls.map((w, i) => (indices.includes(i) ? { ...w, kind: 'open' as const } : w));
const TOP = 0;
const RIGHT = 1;
const BOTTOM = 2;
const LEFT = 3;

// Two rooms side by side, sharing one 12 cm wall.
const office = createRoom({ name: 'Office', width: 380, depth: 320 });
const bedroom = createRoom({ name: 'Bedroom', x: 392, y: 0, width: 300, depth: 320 });

describe('walls', () => {
  it('sit outside the interior and meet in mitered corners', () => {
    expect(wallNames(office)).toEqual(['Top', 'Right', 'Bottom', 'Left']);
    expect(wallPolygon(office, TOP)).toEqual([{ x: 0, y: 0 }, { x: 380, y: 0 }, { x: 392, y: -12 }, { x: -12, y: -12 }]);
    expect(boxOfPoints(wallPolygon(office, LEFT)!)).toEqual({ minX: -12, minY: -12, maxX: 0, maxY: 332 });
    expect(boxOfPoints(wallPolygon(office, RIGHT)!)).toEqual({ minX: 380, minY: -12, maxX: 392, maxY: 332 });
  });

  it('are left out on open sides, like the railing side of a balcony', () => {
    const balcony = createRoom({ name: 'Balcony', y: 332, width: 380, depth: 150, walls: open(defaultWalls(), BOTTOM) });
    expect(wallPolygon(balcony, BOTTOM)).toBeNull();
    // The side walls run to the end of the open side.
    expect(boxOfPoints(wallPolygon(balcony, LEFT)!)).toEqual({ minX: -12, minY: 320, maxX: 0, maxY: 482 });
    expect(outerBox(balcony).maxY).toBe(482);
    expect(planBounds([office, balcony])).toEqual({ minX: -12, minY: -12, maxX: 392, maxY: 482 });
  });

  it('follow the inner corner of an L-shaped room', () => {
    const l = createRoom({ width: 500, depth: 400 });
    l.corners = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ];
    l.walls = defaultWalls(6);
    expect(wallNames(l)).toEqual(['Top 1', 'Right 1', 'Top 2', 'Right 2', 'Bottom', 'Left']);
    // The wall along the cut-away corner ends where the two outer faces meet.
    expect(wallPolygon(l, 1)).toEqual([{ x: 300, y: 0 }, { x: 300, y: 200 }, { x: 312, y: 188 }, { x: 312, y: -12 }]);
  });
});

describe('rooms', () => {
  it('finds the room containing a point, or the nearest one from inside a wall', () => {
    const rooms = [office, bedroom];
    expect(roomAt({ x: 100, y: 100 }, rooms).name).toBe('Office');
    expect(roomAt({ x: 500, y: 100 }, rooms).name).toBe('Bedroom');
    expect(roomAt({ x: 383, y: 100 }, rooms).name).toBe('Office');
    expect(roomAt({ x: 389, y: 100 }, rooms).name).toBe('Bedroom');
  });

  it('counts furniture spanning an open-plan seam as standing on the floor', () => {
    const living = createRoom({ width: 300, depth: 300, walls: open(defaultWalls(), RIGHT) });
    const kitchen = createRoom({ x: 300, width: 200, depth: 300, walls: open(defaultWalls(), LEFT) });
    const across = { minX: 250, minY: 100, maxX: 350, maxY: 150 };
    expect(isBoxOnFloor(across, [living, kitchen])).toBe(true);
    expect(isBoxOnFloor(across, [living])).toBe(false);
    expect(isBoxOnFloor({ minX: 250, minY: 280, maxX: 350, maxY: 310 }, [living, kitchen])).toBe(false);
    // Through a wall into the next room is not on the floor.
    expect(isBoxOnFloor({ minX: 350, minY: 100, maxX: 420, maxY: 150 }, [office, bedroom])).toBe(false);
  });

  it('puts furniture that pokes into a wall back into the room it belongs to', () => {
    const rooms = [office, bedroom];
    const parts = (minX: number, minY: number, maxX: number, maxY: number) => [boxPolygon({ minX, minY, maxX, maxY })];
    expect(floorClampOffset(parts(330, 100, 390, 150), rooms)).toEqual({ dx: -10, dy: 0 });
    // Dragged past the middle of the wall, it goes into the bedroom.
    expect(floorClampOffset(parts(360, 100, 420, 150), rooms)).toEqual({ dx: 32, dy: 0 });
    expect(floorClampOffset(parts(10, 10, 20, 20), rooms)).toEqual({ dx: 0, dy: 0 });
  });

  it('knows which furniture is in a room, including what stands on it', () => {
    const desk = { ...createItemFromPreset(findPreset('desk-180')!, { x: 300, y: 40 }) };
    // A monitor hanging over the desk edge still belongs with the desk.
    const monitor = { ...createItemFromPreset(findPreset('monitor-27')!, { x: 385, y: 20 }), attachedTo: desk.id };
    const bed = createItemFromPreset(findPreset('wardrobe')!, { x: 500, y: 100 });
    expect([...itemIdsInRoom([desk, monitor, bed], office)]).toEqual([desk.id, monitor.id]);
    expect([...itemIdsInRoom([desk, monitor, bed], bedroom)]).toEqual([bed.id]);
  });

  it('names new rooms and docks them to the right of the plan, sharing the wall', () => {
    expect(nextRoomName([office])).toBe('Room 2');
    expect(nextRoomName([{ name: 'Room 2' }])).toBe('Room 3');
    expect(dockedRoomPosition([office, bedroom])).toEqual({ x: 704, y: 0 });
    expect(dockedRoomPosition([office], open(defaultWalls(), LEFT))).toEqual({ x: 392, y: 0 });
  });
});

describe('openings', () => {
  it('cut through a neighbor’s wall that runs along the same line', () => {
    // Two 12 cm walls back to back.
    const next = createRoom({ x: 404, width: 300, depth: 320 });
    const door = createOpening('door', RIGHT, 100, 80);
    const host = { ...office, openings: [door] };
    const cut = openingCut(host, door, [host, next]);
    expect(cut.depth).toBe(24);
    expect(boxOfPoints(cut.polygon)).toEqual({ minX: 380, minY: 100, maxX: 404, maxY: 180 });
    expect(openingCut(host, door, [host]).depth).toBe(12);
    // A shared wall is one wall: the gap is as deep as it.
    expect(openingCut(host, door, [host, bedroom]).depth).toBe(12);
  });

  it('sweep a door into the room, or out through the wall', () => {
    // The bottom wall runs from right to left: 280 cm from its start is 20 cm from the left corner.
    const door = { ...createOpening('door', BOTTOM, 280, 80), hinge: 'end' as const };
    const inward = doorSwing(office, door, 12);
    expect(inward.hinge).toEqual({ x: 20, y: 320 });
    expect(inward.arc[0]).toEqual({ x: 100, y: 320 });
    expect(inward.open.x).toBeCloseTo(20, 9);
    expect(inward.open.y).toBeCloseTo(240, 9);

    const outward = doorSwing(office, { ...door, hinge: 'start', swing: 'out' }, 12);
    expect(outward.hinge).toEqual({ x: 100, y: 332 });
    expect(outward.arc[0]).toEqual({ x: 20, y: 332 });
    expect(outward.open.x).toBeCloseTo(100, 9);
    expect(outward.open.y).toBeCloseTo(412, 9);
  });

  it('stay within their wall', () => {
    const window = createOpening('window', LEFT, 300, 120);
    expect(clampOpening(window, office)).toMatchObject({ offset: 200, width: 120 });
    expect(clampOpening({ ...window, width: 500 }, office)).toMatchObject({ offset: 0, width: 320 });
    const fits = createOpening('window', TOP, 10, 100);
    expect(clampOpening(fits, office)).toBe(fits);
    // A wall that no longer exists falls back to the first one.
    expect(clampOpening({ ...fits, wall: 9 }, office)).toMatchObject({ wall: 0 });
  });

  it('slide along the wall when dragged, snapping to the corners and the center', () => {
    const door = createOpening('door', TOP, 100, 80);
    expect(resolveOpeningDrag(office, door, { x: 143.4, y: 3 }, 4)).toEqual({ wall: TOP, offset: 103, width: 80 });
    expect(resolveOpeningDrag(office, door, { x: 42, y: 0 }, 4)).toMatchObject({ offset: 0 });
    expect(resolveOpeningDrag(office, door, { x: 191, y: 0 }, 4)).toMatchObject({ offset: 150 });
    expect(resolveOpeningDrag(office, door, { x: 191, y: 0 }, 4, false)).toMatchObject({ offset: 151 });
  });

  it('move to the next wall when dragged past a corner', () => {
    const door = createOpening('door', TOP, 100, 80);
    expect(resolveOpeningDrag(office, door, { x: 378, y: 60 }, 4)).toEqual({ wall: RIGHT, offset: 20, width: 80 });
  });

  it('land on the nearest wall of the room they are dropped in', () => {
    const target = openingDropTarget([office, bedroom], { x: 500, y: 300 }, 80);
    expect(target?.room.name).toBe('Bedroom');
    // Centered on x 500, measured from the bottom wall's start at the right corner (x 692).
    expect(target?.placement).toEqual({ wall: BOTTOM, offset: 152, width: 80 });
  });

  it('sit in slanted walls too', () => {
    const room = createRoom({ width: 400, depth: 300 });
    room.corners = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 400, y: 100 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
    room.walls = defaultWalls(5);
    const door = createOpening('door', 1, 20, 80);
    const cut = openingCut(room, door, [room]);
    // Along the 45° wall, 20 cm from its top corner, 12 cm deep.
    expect(cut.polygon[0].x).toBeCloseTo(300 + 20 / Math.SQRT2, 9);
    expect(cut.polygon[0].y).toBeCloseTo(20 / Math.SQRT2, 9);
    expect(cut.depth).toBe(12);
    expect(wallNames(room)[1]).toBe('Top right');
  });

  it('widen the plan’s extent when a door swings out past the walls', () => {
    const entrance = { ...createOpening('door', BOTTOM, 270, 90), swing: 'out' as const };
    expect(planExtent([office])).toEqual(planBounds([office]));
    expect(planExtent([{ ...office, openings: [entrance] }]).maxY).toBeCloseTo(332 + 90, 9);
  });

  it('go into the longest free stretch of wall when added without a position', () => {
    const withWindow = { ...office, openings: [createOpening('window', TOP, 70, 120)] };
    expect(freeOpeningPlacement(withWindow, 80)).toEqual({ wall: BOTTOM, offset: 150, width: 80 });
    const noBottom = { ...withWindow, walls: open(defaultWalls(), BOTTOM) };
    expect(freeOpeningPlacement(noBottom, 80)).toEqual({ wall: RIGHT, offset: 120, width: 80 });
  });
});

describe('room snapping', () => {
  it('docks a room so the two share one wall', () => {
    const moving = createRoom({ x: 395, y: 3, width: 300, depth: 320 });
    expect(snapRoomMove(moving, [office], 5)).toMatchObject({ dx: -3, dy: -3 });
  });

  it('uses the thicker wall as the gap', () => {
    const walls = defaultWalls();
    walls[LEFT] = { kind: 'wall', thickness: 24 };
    const thick = createRoom({ x: 400, width: 300, depth: 320, walls });
    expect(snapRoomMove(thick, [office], 5).dx).toBe(4);
  });

  it('joins two open sides flush, for open-plan rooms', () => {
    const living = createRoom({ width: 300, depth: 300, walls: open(defaultWalls(), RIGHT) });
    const kitchen = createRoom({ x: 304, width: 200, depth: 300, walls: open(defaultWalls(), LEFT) });
    expect(snapRoomMove(kitchen, [living], 5).dx).toBe(-4);
  });

  it('snaps a dragged wall against a neighbor', () => {
    const r = snapRoomEdge(bedroom, LEFT, 395, [office], 5);
    expect(r.value).toBe(392);
    expect(r.guide).toMatchObject({ orientation: 'vertical', position: 392 });
    expect(snapRoomEdge(bedroom, LEFT, 360, [office], 5)).toEqual({ value: 360, guide: null });
  });
});
