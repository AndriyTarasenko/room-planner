import { describe, expect, it } from 'vitest';
import { findBuiltInProduct } from '../catalog/catalog';
import { footprintBox } from '../geometry/footprint';
import { openingAnchor } from '../plan/openings';
import { roomAt } from '../plan/rooms';
import { roomArea, roomBounds, roomRect } from '../plan/shape';
import { findOpening } from './documentOps';
import { createProjectStore, selectItems, selectProjectData } from './projectStore';
import { createEmptyProject, createSampleProject } from './sampleProject';
import { ProjectFileError, parseProjectJson, serializeProject } from './serialization';

const newStore = () => createProjectStore(createSampleProject());
const itemsOf = (store: ReturnType<typeof newStore>) => selectItems(store.getState());
const byName = (store: ReturnType<typeof newStore>, name: string) => itemsOf(store).find((i) => i.name === name)!;

describe('sample project', () => {
  it('starts with a 380 × 320 room, desk, chair, two monitors and a sideboard', () => {
    const store = newStore();
    const s = store.getState();
    expect(s.rooms).toHaveLength(1);
    expect(roomRect(s.rooms[0])).toEqual({ x: 0, y: 0, width: 380, depth: 320 });
    const types = itemsOf(store).map((i) => i.type).sort();
    expect(types).toEqual(['desk', 'monitor', 'monitor', 'office-chair', 'sideboard']);
  });
});

describe('undo / redo', () => {
  it('undoes and redoes adding and deleting items', () => {
    const store = newStore();
    const before = itemsOf(store).length;
    const id = store.getState().addPreset('wardrobe')!;
    expect(itemsOf(store)).toHaveLength(before + 1);
    expect(store.getState().selectedId).toBe(id);

    store.getState().deleteItem(id);
    expect(itemsOf(store)).toHaveLength(before);
    expect(store.getState().selectedId).toBeNull();

    store.getState().undo();
    expect(itemsOf(store)).toHaveLength(before + 1);
    store.getState().undo();
    expect(itemsOf(store)).toHaveLength(before);
    store.getState().redo();
    expect(itemsOf(store)).toHaveLength(before + 1);
  });

  it('records a whole drag gesture as one step', () => {
    const store = newStore();
    const chair = byName(store, 'Office chair');
    const s = store.getState();
    s.beginGesture();
    for (let i = 1; i <= 10; i++) store.getState().setGeometry(chair.id, { x: chair.x + i * 5 });
    store.getState().endGesture(chair.id);
    expect(byName(store, 'Office chair').x).toBe(chair.x + 50);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(byName(store, 'Office chair').x).toBe(chair.x);
  });

  it('undoes resizing and rotating', () => {
    const store = newStore();
    const desk = byName(store, 'Desk');
    store.getState().resizeItem(desk.id, { width: 200 });
    expect(byName(store, 'Desk').width).toBe(200);
    store.getState().rotateBy(desk.id, 90);
    expect(byName(store, 'Desk').rotation).toBe(90);
    store.getState().undo();
    expect(byName(store, 'Desk').rotation).toBe(0);
    store.getState().undo();
    expect(byName(store, 'Desk').width).toBe(180);
  });

  it('records sizing an L-shape’s arms as one step', () => {
    const store = createProjectStore(createEmptyProject(400, 300));
    const id = store.getState().addPreset('corner-sofa')!;
    const before = itemsOf(store).find((i) => i.id === id)!;
    const past = store.getState().past.length;
    store.getState().beginGesture();
    store.getState().reshapeItem(id, { x: before.x - 10, y: before.y, width: 280, depth: 200, shape: { kind: 'l', segment: 95, returnWidth: 95, returnSide: 'right' } });
    store.getState().reshapeItem(id, { x: before.x, y: before.y, width: 260, depth: 200, shape: { kind: 'l', segment: 95, returnWidth: 80, returnSide: 'right' } });
    store.getState().endGesture();
    expect(itemsOf(store).find((i) => i.id === id)).toMatchObject({ width: 260, shape: { returnWidth: 80 } });
    expect(store.getState().past).toHaveLength(past + 1);
    store.getState().undo();
    expect(itemsOf(store).find((i) => i.id === id)).toEqual(before);
  });

  it('merges consecutive nudges into one step', () => {
    const store = newStore();
    const chair = byName(store, 'Office chair');
    store.getState().nudge(chair.id, 1, 0);
    store.getState().nudge(chair.id, 1, 0);
    store.getState().nudge(chair.id, 1, 0);
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(byName(store, 'Office chair').x).toBe(chair.x);
  });
});

describe('furniture editing', () => {
  it('keeps a desk against its wall when switching widths', () => {
    const store = newStore();
    const desk = byName(store, 'Desk');
    const left = footprintBox(desk).minX;
    for (const width of [160, 200, 180]) {
      store.getState().resizeItem(desk.id, { width });
      const box = footprintBox(byName(store, 'Desk'));
      expect(box.maxX - box.minX).toBe(width);
      expect(box.minX).toBe(left);
      expect(box.minY).toBe(0);
    }
  });

  it('moves and rotates attached monitors with the desk', () => {
    const store = newStore();
    const desk = byName(store, 'Desk');
    const monitor = byName(store, 'Monitor left');
    store.getState().setGeometry(desk.id, { x: desk.x + 30, y: desk.y + 50 });
    expect(byName(store, 'Monitor left')).toMatchObject({ x: monitor.x + 30, y: monitor.y + 50 });

    store.getState().rotateBy(desk.id, 90);
    const rotated = byName(store, 'Monitor left');
    expect(rotated.rotation).toBe(90);
  });

  it('keeps items inside the room when constrained', () => {
    const store = newStore();
    const chair = byName(store, 'Office chair');
    store.getState().setGeometry(chair.id, { x: 1000 });
    expect(footprintBox(byName(store, 'Office chair')).maxX).toBeCloseTo(380, 6);

    store.getState().updateSettings({ constrainToRoom: false });
    store.getState().setGeometry(chair.id, { x: 1000 });
    expect(byName(store, 'Office chair').x).toBe(1000);
  });

  it('duplicates an item with its attached children', () => {
    const store = newStore();
    const desk = byName(store, 'Desk');
    const count = itemsOf(store).length;
    store.getState().duplicateItem(desk.id);
    expect(itemsOf(store)).toHaveLength(count + 3);
    const copyId = store.getState().selectedId!;
    expect(itemsOf(store).filter((i) => i.attachedTo === copyId)).toHaveLength(2);
  });

  it('places new monitors on a desk and attaches them', () => {
    const store = createProjectStore(createEmptyProject(380, 320));
    const deskId = store.getState().addPreset('desk-180')!;
    const m1 = store.getState().addPreset('monitor-27')!;
    const m2 = store.getState().addPreset('monitor-27')!;
    const [a, b] = [m1, m2].map((id) => itemsOf(store).find((i) => i.id === id)!);
    expect(a.attachedTo).toBe(deskId);
    expect(b.attachedTo).toBe(deskId);
    expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(61);
  });

  it('puts a new TV on the TV bench and kitchen items on the counter, not on the desk', () => {
    const store = createProjectStore(createEmptyProject(600, 400));
    const s = () => store.getState();
    s().addPreset('desk-160');
    const benchId = s().addPreset('tv-bench')!;
    const counterId = s().addPreset('kitchen-counter')!;
    s().select(null);
    const tvId = s().addPreset('tv-55')!;
    const microwaveId = s().addPreset('microwave')!;
    const wallCabinetId = s().addPreset('kitchen-wall-cabinet')!;
    const attached = (id: string) => itemsOf(store).find((i) => i.id === id)!.attachedTo;
    expect(attached(tvId)).toBe(benchId);
    expect(attached(microwaveId)).toBe(counterId);
    expect(attached(wallCabinetId)).toBe(counterId);
  });

  it('leaves a TV free-standing when there is no TV bench', () => {
    const store = createProjectStore(createEmptyProject(400, 300));
    store.getState().addPreset('desk-160');
    store.getState().select(null);
    const tvId = store.getState().addPreset('tv-55')!;
    expect(itemsOf(store).find((i) => i.id === tvId)!.attachedTo).toBeNull();
  });
});

describe('catalog products', () => {
  it('places a product as one undoable step with its own copy of the product data', () => {
    const store = createProjectStore(createEmptyProject(400, 300));
    const product = findBuiltInProduct('ikea:80483438')!;
    const id = store.getState().addProduct(product);
    const item = itemsOf(store).find((i) => i.id === id)!;
    expect(item).toMatchObject({ name: 'ALEX Desk', width: 132, depth: 58, height: 76, type: 'desk' });
    expect(item.product?.articleNumber).toBe('804.834.38');
    expect(store.getState().selectedId).toBe(id);
    store.getState().undo();
    expect(itemsOf(store)).toHaveLength(0);
  });

  it('puts a catalog chair in front of the desk, facing it', () => {
    const store = createProjectStore(createEmptyProject(400, 300));
    const deskId = store.getState().addProduct(findBuiltInProduct('ikea:59529966')!);
    const chairId = store.getState().addProduct(findBuiltInProduct('ikea:70261150')!);
    const desk = itemsOf(store).find((i) => i.id === deskId)!;
    const chair = itemsOf(store).find((i) => i.id === chairId)!;
    expect(chair.rotation).toBe(180);
    expect(chair.x).toBeCloseTo(desk.x, 6);
    expect(chair.y).toBeGreaterThan(desk.y + desk.depth / 2);
  });

  it('drops a product at the given point', () => {
    const store = createProjectStore(createEmptyProject(400, 300));
    const id = store.getState().addProduct(findBuiltInProduct('ikea:00263850')!, { x: 60, y: 20 });
    expect(itemsOf(store).find((i) => i.id === id)).toMatchObject({ x: 60, y: 20 });
  });
});

describe('layouts', () => {
  it('creates, duplicates, renames, switches and deletes layouts', () => {
    const store = newStore();
    const original = store.getState().activeLayoutId;
    store.getState().duplicateLayout(original);
    const copy = store.getState().activeLayoutId;
    expect(copy).not.toBe(original);
    expect(store.getState().layouts).toHaveLength(2);
    expect(store.getState().layouts[1].name).toBe('Layout A copy');

    // Editing the copy leaves the original untouched.
    const desk = byName(store, 'Desk');
    store.getState().resizeItem(desk.id, { width: 200 });
    store.getState().switchLayout(original);
    expect(byName(store, 'Desk').width).toBe(180);

    store.getState().renameLayout(copy, 'One 200 cm desk');
    expect(store.getState().layouts[1].name).toBe('One 200 cm desk');

    store.getState().createLayout();
    expect(store.getState().layouts).toHaveLength(3);
    expect(itemsOf(store)).toHaveLength(0);

    store.getState().deleteLayout(store.getState().activeLayoutId);
    expect(store.getState().layouts).toHaveLength(2);
  });

  it('never deletes the last layout', () => {
    const store = newStore();
    store.getState().deleteLayout(store.getState().activeLayoutId);
    expect(store.getState().layouts).toHaveLength(1);
  });

  it('remaps attachments when duplicating a layout', () => {
    const store = newStore();
    store.getState().duplicateLayout(store.getState().activeLayoutId);
    const desk = byName(store, 'Desk');
    expect(byName(store, 'Monitor left').attachedTo).toBe(desk.id);
  });
});

describe('import / export', () => {
  it('round-trips a project through JSON', () => {
    const store = newStore();
    store.getState().duplicateLayout(store.getState().activeLayoutId);
    store.getState().updateSettings({ gridSize: 25, snapToGrid: true });
    const data = selectProjectData(store.getState());
    const parsed = parseProjectJson(serializeProject(data));
    expect(parsed).toEqual(data);
  });

  it('rejects files that are not projects', () => {
    expect(() => parseProjectJson('not json')).toThrow(ProjectFileError);
    expect(() => parseProjectJson('{"format":"something-else","room":{},"layouts":[{}]}')).toThrow(ProjectFileError);
    expect(() => parseProjectJson('{"room":{"width":300,"depth":300},"layouts":[]}')).toThrow(ProjectFileError);
  });

  it('repairs missing or invalid fields', () => {
    const parsed = parseProjectJson(
      JSON.stringify({
        room: { width: '420', depth: -5 },
        layouts: [{ name: '', furniture: [{ type: 'desk', width: 'wide', x: 10, y: 20, attachedTo: 'missing' }] }],
      }),
    );
    expect(roomRect(parsed.rooms[0])).toMatchObject({ width: 420, depth: 50 });
    const [desk] = parsed.layouts[0].furniture;
    expect(desk).toMatchObject({ type: 'desk', width: 140, depth: 80, x: 10, y: 20, attachedTo: null });
    expect(parsed.layouts[0].name).toBe('Layout 1');
    expect(parsed.activeLayoutId).toBe(parsed.layouts[0].id);
  });

  it('loads an imported project as one undoable step', () => {
    const store = newStore();
    const imported = createEmptyProject(500, 400);
    store.getState().loadProject(imported);
    expect(roomRect(store.getState().rooms[0])?.width).toBe(500);
    store.getState().undo();
    expect(roomRect(store.getState().rooms[0])?.width).toBe(380);
  });
});

describe('floor plan', () => {
  const roomOf = (store: ReturnType<typeof newStore>, id: string) => store.getState().rooms.find((r) => r.id === id)!;
  const itemById = (store: ReturnType<typeof newStore>, id: string) => itemsOf(store).find((i) => i.id === id)!;

  it('adds a room next to the plan, sharing a wall, as one undo step', () => {
    const store = newStore();
    const id = store.getState().addRoom();
    expect(roomOf(store, id).name).toBe('Room 2');
    expect(roomRect(roomOf(store, id))).toEqual({ x: 392, y: 0, width: 300, depth: 300 });
    expect(store.getState().selectedId).toBe(id);
    store.getState().undo();
    expect(store.getState().rooms).toHaveLength(1);
    expect(store.getState().selectedId).toBeNull();
  });

  it('docks a room dropped near another one', () => {
    const store = newStore();
    // Proposed at x 410, y 5: docks against the office's right wall and lines up with its top.
    const id = store.getState().addRoom({ at: { x: 560, y: 155 } });
    expect(roomRect(roomOf(store, id))).toMatchObject({ x: 392, y: 0 });
  });

  it('puts new furniture into the selected room', () => {
    const store = newStore();
    const bedroom = store.getState().addRoom();
    const wardrobe = itemById(store, store.getState().addPreset('wardrobe')!);
    expect(roomAt(wardrobe, store.getState().rooms).id).toBe(bedroom);
  });

  it('moves a room together with its furniture, in every layout', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    const desk = byName(store, 'Desk');
    const monitor = byName(store, 'Monitor left');
    store.getState().duplicateLayout(store.getState().activeLayoutId);
    store.getState().setRoomGeometry(office.id, { x: 100, y: 50 }, { carry: true });
    expect(byName(store, 'Desk')).toMatchObject({ x: desk.x + 100, y: desk.y + 50 });
    expect(byName(store, 'Monitor left')).toMatchObject({ x: monitor.x + 100, y: monitor.y + 50 });
    store.getState().switchLayout(store.getState().layouts[0].id);
    expect(byName(store, 'Desk')).toMatchObject({ x: desk.x + 100, y: desk.y + 50 });
    // Doors and windows are part of the room.
    expect(store.getState().rooms[0].openings).toEqual(office.openings);
  });

  it('does not pick up other furniture while a room is dragged across it', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    const desk = byName(store, 'Desk');
    store.getState().addRoom();
    const wardrobe = itemById(store, store.getState().addPreset('wardrobe', { x: 500, y: 100 })!);
    const s = store.getState();
    const pastBefore = s.past.length;
    s.beginGesture();
    for (const x of [100, 300, 450, 700]) store.getState().setRoomGeometry(office.id, { x }, { carry: true });
    store.getState().endGesture();
    expect(itemById(store, wardrobe.id)).toMatchObject({ x: wardrobe.x, y: wardrobe.y });
    expect(byName(store, 'Desk').x).toBe(desk.x + 700);
    expect(store.getState().past).toHaveLength(pastBefore + 1);
    store.getState().undo();
    expect(roomBounds(roomOf(store, office.id)).minX).toBe(0);
    expect(byName(store, 'Desk').x).toBe(desk.x);
  });

  it('keeps furniture, doors and windows in place when a wall is dragged', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    const window = office.openings.find((o) => o.kind === 'window')!;
    const desk = byName(store, 'Desk');
    store.getState().setRoomGeometry(office.id, { x: -50, width: 430 });
    const after = roomOf(store, office.id);
    expect(after.openings.find((o) => o.id === window.id)!.offset).toBe(window.offset + 50);
    expect(byName(store, 'Desk')).toMatchObject({ x: desk.x, y: desk.y });
  });

  it('keeps openings inside a room that gets smaller', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    store.getState().setRoomGeometry(office.id, { width: 100 });
    const window = roomOf(store, office.id).openings.find((o) => o.kind === 'window')!;
    expect(window).toMatchObject({ offset: 0, width: 100 });
  });

  it('deletes a room with its furniture, and undo restores both', () => {
    const store = newStore();
    const bedroom = store.getState().addRoom();
    const wardrobe = store.getState().addPreset('wardrobe')!;
    store.getState().deleteRoom(bedroom);
    expect(store.getState().rooms).toHaveLength(1);
    expect(itemsOf(store).some((i) => i.id === wardrobe)).toBe(false);
    expect(itemsOf(store)).toHaveLength(5);
    store.getState().undo();
    expect(store.getState().rooms).toHaveLength(2);
    expect(itemsOf(store).some((i) => i.id === wardrobe)).toBe(true);
  });

  it('never deletes the last room', () => {
    const store = newStore();
    store.getState().deleteRoom(store.getState().rooms[0].id);
    expect(store.getState().rooms).toHaveLength(1);
    expect(store.getState().past).toHaveLength(0);
  });

  it('switches walls off and on, keeping their thickness', () => {
    const store = newStore();
    const id = store.getState().rooms[0].id;
    store.getState().setWall(id, 2, { thickness: 30 });
    store.getState().setWall(id, 2, { kind: 'open' });
    expect(roomOf(store, id).walls[2]).toEqual({ kind: 'open', thickness: 30 });
    store.getState().setWall(id, 2, { kind: 'wall' });
    expect(roomOf(store, id).walls[2]).toEqual({ kind: 'wall', thickness: 30 });
    store.getState().setWall(id, 0, { thickness: 9999 });
    expect(roomOf(store, id).walls[0].thickness).toBe(100);
  });

  it('adds, edits and deletes doors and windows', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    store.getState().select(office.id);
    const id = store.getState().addOpening('door')!;
    expect(store.getState().selectedId).toBe(id);
    expect(findOpening(store.getState().rooms, id)?.room.id).toBe(office.id);

    store.getState().updateOpening(id, { wall: 3, offset: 10_000, hinge: 'end', swing: 'out' });
    expect(findOpening(store.getState().rooms, id)?.opening).toMatchObject({ wall: 3, offset: 240, width: 80, hinge: 'end', swing: 'out' });

    store.getState().deleteOpening(id);
    expect(findOpening(store.getState().rooms, id)).toBeNull();
    expect(store.getState().selectedId).toBeNull();
    store.getState().undo();
    expect(findOpening(store.getState().rooms, id)).not.toBeNull();
  });

  it('drops a window onto the nearest wall', () => {
    const store = newStore();
    const id = store.getState().addOpening('window', { at: { x: 370, y: 100 } })!;
    expect(findOpening(store.getState().rooms, id)?.opening).toMatchObject({ kind: 'window', wall: 1, offset: 40, width: 120 });
  });

  it('keeps an opening moved to the opposite wall at the same distance from the left corner', () => {
    const store = newStore();
    const window = store.getState().rooms[0].openings.find((o) => o.kind === 'window')!;
    // Top wall, 70 cm from the left corner; the bottom wall runs right to left.
    store.getState().updateOpening(window.id, { wall: 2 });
    const moved = findOpening(store.getState().rooms, window.id)!;
    expect(openingAnchor(moved.room, moved.opening)).toEqual({ x: 130, y: 320 });
    expect(moved.opening.hinge).toBe('end');
  });

  it('adds a room drawn wall by wall, as one undo step', () => {
    const store = newStore();
    const l = [
      { x: 400, y: 0 },
      { x: 700, y: 0 },
      { x: 700, y: 200 },
      { x: 900, y: 200 },
      { x: 900, y: 400 },
      { x: 400, y: 400 },
    ];
    const id = store.getState().addDrawnRoom(l)!;
    expect(roomOf(store, id)).toMatchObject({ name: 'Room 2', corners: l });
    expect(roomArea(roomOf(store, id))).toBe(500 * 400 - 200 * 200);
    expect(store.getState().selectedId).toBe(id);
    store.getState().undo();
    expect(store.getState().rooms).toHaveLength(1);
    // Walls crossing each other aren't a room.
    const pastBefore = store.getState().past.length;
    expect(store.getState().addDrawnRoom([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBeNull();
    expect(store.getState().past).toHaveLength(pastBefore);
  });

  it('reshapes a room: a niche pulled into a split wall is one undo step', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    // The bottom wall runs from right to left: corners at x 180, then at x 280.
    expect(store.getState().splitRoomWall(office.id, 2, 200)).toBe(3);
    expect(store.getState().splitRoomWall(office.id, 2, 100)).toBe(3);
    const split = roomOf(store, office.id);
    expect(split.corners).toHaveLength(6);
    const pastBefore = store.getState().past.length;
    store.getState().beginGesture();
    // Dragging: every step counts from where the wall was, so the niche is only added once.
    expect(store.getState().moveRoomWall(office.id, 3, -10)).toBe(true);
    expect(store.getState().moveRoomWall(office.id, 3, -30)).toBe(true);
    // Pulled right through the room: refused, the last good shape stays.
    expect(store.getState().moveRoomWall(office.id, 3, -400)).toBe(false);
    store.getState().endGesture();
    const niche = roomOf(store, office.id);
    expect(niche.corners).toHaveLength(8);
    expect(roomArea(niche)).toBe(380 * 320 - 100 * 30);
    expect(store.getState().past).toHaveLength(pastBefore + 1);
    store.getState().undo();
    expect(roomOf(store, office.id).corners).toEqual(split.corners);
  });

  it('sets wall lengths and removes corners', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    store.getState().setRoomWallLength(office.id, 0, 400);
    expect(roomRect(roomOf(store, office.id))).toEqual({ x: 0, y: 0, width: 400, depth: 320 });
    const corner = store.getState().splitRoomWall(office.id, 1, 100)!;
    expect(store.getState().removeRoomCorner(office.id, corner)).toBe(true);
    expect(roomOf(store, office.id).corners).toHaveLength(4);
    store.getState().moveRoomCorner(office.id, 1, { x: 300, y: 0 });
    expect(roomOf(store, office.id).corners[1]).toEqual({ x: 300, y: 0 });
    expect(roomRect(roomOf(store, office.id))).toBeNull();
  });

  it('keeps a selected room selected across undo and layout switches', () => {
    const store = newStore();
    const office = store.getState().rooms[0];
    store.getState().select(office.id);
    store.getState().setRoomGeometry(office.id, { width: 400 });
    store.getState().undo();
    expect(store.getState().selectedId).toBe(office.id);
    store.getState().createLayout();
    store.getState().select(office.id);
    store.getState().switchLayout(store.getState().layouts[0].id);
    expect(store.getState().selectedId).toBe(office.id);
  });
});
