import { describe, expect, it } from 'vitest';
import type { Point } from '../geometry/rect';
import type { Room } from '../types';
import { snapDraftPoint } from './drawing';
import { createOpening, openingAnchor } from './openings';
import { createRoom, createRoomFromCorners } from './rooms';
import {
  isValidOutline,
  moveCorner,
  moveWall,
  normalizeRoom,
  removeCorner,
  resizeRect,
  roomArea,
  roomRect,
  setWallLength,
  splitWall,
  translateRoom,
} from './shape';
import { defaultWalls, wallFrame } from './walls';

const TOP = 0;
const RIGHT = 1;
const BOTTOM = 2;

/** 380 × 320 office with a window in the top wall and a door 20 cm from the bottom-left corner. */
function office(): Room {
  return createRoom({
    width: 380,
    depth: 320,
    openings: [createOpening('window', TOP, 70, 120), { ...createOpening('door', BOTTOM, 280, 80), hinge: 'end' }],
  });
}

const where = (room: Room) => room.openings.map((o) => openingAnchor(room, o));

describe('room outlines', () => {
  it('accept simple, clockwise outlines only', () => {
    expect(isValidOutline(office().corners)).toBe(true);
    // Counter-clockwise, crossing itself, or too small to be a room.
    expect(isValidOutline([...office().corners].reverse())).toBe(false);
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(false);
    expect(isValidOutline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(false);
  });

  it('turn drawn corners clockwise and drop repeated ones', () => {
    const drawn = createRoomFromCorners([{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 0, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 0 }]);
    expect(drawn.corners).toHaveLength(4);
    expect(isValidOutline(drawn.corners)).toBe(true);
    expect(roomRect(drawn)).toEqual({ x: 0, y: 0, width: 300, depth: 200 });
  });

  it('keep doors and windows in place when the corner order is reversed', () => {
    const room = office();
    const before = where(room);
    const reversed = { ...room, corners: [...room.corners].reverse(), walls: defaultWalls(), openings: room.openings.map((o) => ({ ...o, wall: (4 - 2 - o.wall + 4) % 4, offset: wallFrame(room, o.wall).length - o.offset - o.width, hinge: o.hinge === 'start' ? ('end' as const) : ('start' as const) })) };
    const normalized = normalizeRoom(reversed);
    expect(where(normalized)).toEqual(before);
    expect(normalized.openings.map((o) => o.hinge)).toEqual(room.openings.map((o) => o.hinge));
  });

  it('resize rectangles from any side without moving doors and windows', () => {
    const room = office();
    const before = where(room);
    const wider = resizeRect(room, { x: -50, width: 430 });
    expect(roomRect(wider)).toEqual({ x: -50, y: 0, width: 430, depth: 320 });
    expect(where(wider)).toEqual(before);
  });

  it('move as a whole with their openings', () => {
    const room = translateRoom(office(), 100, 50);
    expect(roomRect(room)).toEqual({ x: 100, y: 50, width: 380, depth: 320 });
    expect(room.openings).toEqual(office().openings.map((o, i) => ({ ...o, id: room.openings[i].id })));
  });
});

describe('moving walls', () => {
  it('pushes a wall out, and the walls next to it grow along', () => {
    const room = office();
    const pushed = moveWall(room, RIGHT, 20);
    expect(roomRect(pushed)).toEqual({ x: 0, y: 0, width: 400, depth: 320 });
    // The door on the bottom wall stays 20 cm from the left corner.
    expect(where(pushed)).toEqual(where(room));
  });

  it('adds a niche or a bay when part of a split wall is moved', () => {
    const room = office();
    // Split the top wall at 200 and 300 cm, right of the window (70–190 cm).
    const twice = splitWall(splitWall(room, TOP, 300), TOP, 200);
    expect(twice.corners.slice(0, 4)).toEqual([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }, { x: 380, y: 0 }]);
    // Pull the middle part 30 cm into the room: two short walls appear at its ends.
    const niche = moveWall(twice, 1, -30);
    expect(niche.corners.slice(0, 6)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 30 },
      { x: 300, y: 30 },
      { x: 300, y: 0 },
      { x: 380, y: 0 },
    ]);
    expect(roomArea(niche)).toBe(380 * 320 - 100 * 30);
    expect(where(niche)).toEqual(where(room));
    // Pushed out instead, it becomes a bay.
    expect(roomArea(moveWall(twice, 1, 40))).toBe(380 * 320 + 100 * 40);
  });

  it('refuses shapes whose walls would cross', () => {
    const room = office();
    expect(moveWall(room, TOP, -400)).toBe(room);
    expect(moveCorner(room, 0, { x: 400, y: 400 })).toBe(room);
  });

  it('sets a wall’s length by moving the next wall, keeping the angles', () => {
    const room = office();
    expect(roomRect(setWallLength(room, TOP, 400))).toEqual({ x: 0, y: 0, width: 400, depth: 320 });
    // In an L, the first top wall grows and the notch next to it gets narrower.
    const l = createRoomFromCorners([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 400 },
      { x: 0, y: 400 },
    ]);
    const longer = setWallLength(l, 0, 320);
    expect(longer.corners.slice(1, 4)).toEqual([{ x: 320, y: 0 }, { x: 320, y: 200 }, { x: 500, y: 200 }]);
  });

  it('makes slanted walls by moving a corner', () => {
    const cut = moveCorner(office(), 1, { x: 300, y: 0 });
    expect(cut.corners[1]).toEqual({ x: 300, y: 0 });
    expect(wallFrame(cut, RIGHT).length).toBeCloseTo(Math.hypot(80, 320), 9);
  });
});

describe('adding and removing corners', () => {
  it('splits a wall and moves the openings beyond the split onto the new wall', () => {
    const room = office();
    const split = splitWall(room, TOP, 250);
    expect(split.corners).toHaveLength(5);
    expect(split.corners[1]).toEqual({ x: 250, y: 0 });
    // The window (70–190) stays on the first part; the door's wall is now the fourth one.
    expect(split.openings.map((o) => o.wall)).toEqual([0, 3]);
    expect(where(split)).toEqual(where(room));
  });

  it('does not split through a door or window, or right at a corner', () => {
    const room = office();
    // 100 cm is inside the window (70–190): the corner goes to its nearer edge.
    expect(splitWall(room, TOP, 100).corners[1]).toEqual({ x: 70, y: 0 });
    expect(splitWall(room, TOP, 0.5)).toBe(room);
  });

  it('joins two walls again when their corner is removed', () => {
    const room = office();
    const split = splitWall(room, RIGHT, 100);
    const joined = removeCorner(split, 2);
    expect(joined.corners).toEqual(room.corners);
    expect(where(joined)).toEqual(where(room));
  });

  it('keeps at least three corners and never lets walls cross', () => {
    const triangle = createRoomFromCorners([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 300 }]);
    expect(removeCorner(triangle, 0)).toBe(triangle);
  });
});

describe('drawing walls', () => {
  const opts = { threshold: 5, snap: true, grid: null };
  const placed: Point[] = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }];

  it('keeps walls straight or at 45°, in whole centimeters', () => {
    expect(snapDraftPoint({ x: 150.4, y: 3 }, [{ x: 0, y: 0 }], [], opts)).toMatchObject({ point: { x: 150, y: 0 }, closes: false });
    const diagonal = snapDraftPoint({ x: 102, y: 99 }, [{ x: 0, y: 0 }], [], opts).point;
    expect(diagonal.x).toBeCloseTo(diagonal.y, 9);
    // Without snapping (Alt), only whole centimeters.
    expect(snapDraftPoint({ x: 150.4, y: 3.2 }, [{ x: 0, y: 0 }], [], { ...opts, snap: false }).point).toEqual({ x: 150, y: 3 });
  });

  it('closes the room at the first corner', () => {
    expect(snapDraftPoint({ x: 3, y: 4 }, placed, [], opts)).toEqual({ point: { x: 0, y: 0 }, guides: [], closes: true });
  });

  it('snaps onto the corners of existing rooms, and lines up with them', () => {
    const existing = createRoom({ x: 400, y: 0, width: 200, depth: 200 });
    // The outer corner of its top-left wall joint.
    expect(snapDraftPoint({ x: 390, y: -10 }, [{ x: 0, y: 300 }], [existing], opts).point).toEqual({ x: 388, y: -12 });
    // Heading right from (0, 300), stop in line with the room's left face.
    const lined = snapDraftPoint({ x: 401, y: 301 }, [{ x: 0, y: 300 }], [existing], opts);
    expect(lined.point).toEqual({ x: 400, y: 300 });
    expect(lined.guides[0]).toMatchObject({ orientation: 'vertical', position: 400 });
  });

  it('turns into a room with default walls', () => {
    const room = createRoomFromCorners([...placed, { x: 0, y: 200 }]);
    expect(room.walls).toEqual(defaultWalls(4));
    expect(roomRect(room)).toEqual({ x: 0, y: 0, width: 300, depth: 200 });
  });
});
