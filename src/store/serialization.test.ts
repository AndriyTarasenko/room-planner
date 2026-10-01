import { describe, expect, it } from 'vitest';
import { findBuiltInProduct } from '../catalog/catalog';
import { productToItem } from '../catalog/productToItem';
import { parseProduct } from '../catalog/validation';
import { createOpening } from '../plan/openings';
import { openingAnchor } from '../plan/openings';
import { createRoom, createRoomFromCorners } from '../plan/rooms';
import { rectCorners, roomRect } from '../plan/shape';
import { defaultWalls } from '../plan/walls';
import { MemoryStorage } from '../testing/memoryStorage';
import { PROJECT_SCHEMA_VERSION } from '../types';
import { legacyBackupKey, loadStoredProject, STORAGE_KEY } from './persistence';
import { createSampleProject } from './sampleProject';
import { ProjectFileError, migrateProject, parseProjectJson, serializeProject } from './serialization';

/** A project file exactly as version 1 of the app exported it. */
const V1_FILE = {
  format: 'room-planner-project',
  version: 1,
  exportedAt: '2026-09-30T00:00:00.000Z',
  room: { id: 'room_1', width: 380, depth: 320 },
  layouts: [
    {
      id: 'layout_1',
      name: 'Layout A',
      furniture: [
        {
          id: 'item_1',
          type: 'sofa',
          name: 'Sofa',
          x: 150,
          y: 100,
          width: 200,
          depth: 90,
          height: 85,
          rotation: 0,
          category: 'bed',
          color: '#d8c9df',
          notes: 'old sofa',
          placement: 'floor',
          ignoreCollisions: false,
          clearance: { enabled: false, front: 60, back: 0, left: 0, right: 0 },
          shape: { kind: 'rect' },
          attachedTo: null,
          showDeskGuides: false,
        },
      ],
    },
  ],
  activeLayoutId: 'layout_1',
  settings: { gridVisible: true, snapToGrid: false, gridSize: 10 },
};

function withLocalStorage<T>(storage: Storage, run: () => T): T {
  const g = globalThis as { localStorage?: Storage };
  const previous = g.localStorage;
  g.localStorage = storage;
  try {
    return run();
  } finally {
    if (previous === undefined) delete g.localStorage;
    else g.localStorage = previous;
  }
}

describe('project schema', () => {
  it('writes the current schema version', () => {
    const file = JSON.parse(serializeProject(createSampleProject()));
    expect(file).toMatchObject({ format: 'room-planner-project', schemaVersion: PROJECT_SCHEMA_VERSION });
    expect(file.version).toBeUndefined();
  });

  it('migrates version 1 files without changing their furniture', () => {
    const migrated = migrateProject(structuredClone(V1_FILE));
    expect(migrated.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(migrated.version).toBeUndefined();

    const project = parseProjectJson(JSON.stringify(V1_FILE));
    expect(project.layouts[0].furniture[0]).toEqual(V1_FILE.layouts[0].furniture[0]);
    expect(project.rooms).toHaveLength(1);
    expect(project.rooms[0]).toMatchObject({ id: V1_FILE.room.id, openings: [] });
    expect(roomRect(project.rooms[0])).toEqual({ x: 0, y: 0, width: V1_FILE.room.width, depth: V1_FILE.room.depth });
  });

  it('treats files without any version as version 1', () => {
    const { version: _version, ...unversioned } = V1_FILE;
    expect(parseProjectJson(JSON.stringify(unversioned)).layouts[0].furniture).toHaveLength(1);
  });

  it('refuses files from a newer schema', () => {
    expect(() => parseProjectJson(JSON.stringify({ ...V1_FILE, schemaVersion: PROJECT_SCHEMA_VERSION + 1 }))).toThrow(ProjectFileError);
    expect(() => parseProjectJson(JSON.stringify({ ...V1_FILE, version: 99 }))).toThrow(/newer version/);
  });
});

describe('placed catalog products in project files', () => {
  const item = productToItem(findBuiltInProduct('ikea:80458207')!, { x: 60, y: 40 });

  it('export contains the full geometry and product details', () => {
    const project = createSampleProject();
    project.layouts[0].furniture.push(item);
    const exported = JSON.parse(serializeProject(project)).layouts[0].furniture.at(-1);
    expect(exported).toMatchObject({
      type: 'wardrobe',
      name: 'PAX Wardrobe frame',
      width: 99.8,
      depth: 58,
      height: 236.4,
      product: { catalogId: 'ikea:80458207', manufacturer: 'IKEA', articleNumber: '804.582.07' },
    });
  });

  it('import reconstructs the item exactly', () => {
    const project = createSampleProject();
    project.layouts[0].furniture.push(item);
    const restored = parseProjectJson(serializeProject(project));
    expect(restored.layouts[0].furniture.at(-1)).toEqual(item);
  });

  it('import drops unsafe or incomplete product details but keeps the furniture', () => {
    const project = createSampleProject();
    project.layouts[0].furniture.push({
      ...item,
      product: { ...item.product!, productUrl: 'javascript:alert(document.cookie)' },
    });
    const withBadLink = parseProjectJson(serializeProject(project)).layouts[0].furniture.at(-1)!;
    expect(withBadLink.product!.productUrl).toBeUndefined();
    expect(withBadLink.product!.articleNumber).toBe('804.582.07');

    const broken = JSON.parse(serializeProject(project));
    broken.layouts[0].furniture.at(-1).product = { manufacturer: 42 };
    const withoutProduct = parseProjectJson(JSON.stringify(broken)).layouts[0].furniture.at(-1)!;
    expect(withoutProduct.product).toBeUndefined();
    expect(withoutProduct).toMatchObject({ width: 99.8, depth: 58, height: 236.4 });
  });
});

/** A project file as version 2 of the app exported it: a single room without a position. */
const V2_FILE = {
  format: 'room-planner-project',
  schemaVersion: 2,
  exportedAt: '2026-09-30T00:00:00.000Z',
  room: { id: 'room_1', width: 400, depth: 300 },
  layouts: V1_FILE.layouts,
  activeLayoutId: 'layout_1',
  settings: V1_FILE.settings,
};

describe('floor plans in project files', () => {
  it('migrates a version 2 project to one room at the plan origin, keeping the furniture as it was', () => {
    const project = parseProjectJson(JSON.stringify(V2_FILE));
    expect(project.rooms).toEqual([{ id: 'room_1', name: 'Room 1', corners: rectCorners(0, 0, 400, 300), walls: defaultWalls(), openings: [] }]);
    expect(project.layouts[0].furniture[0]).toEqual(V1_FILE.layouts[0].furniture[0]);
  });

  it('round-trips rooms, walls, doors and windows', () => {
    const project = createSampleProject();
    project.rooms.push(
      createRoom({
        name: 'Balcony',
        y: 332,
        width: 380,
        depth: 140,
        walls: defaultWalls().map((w, i) => (i === 2 ? { kind: 'open', thickness: 24 } : w)),
        openings: [{ ...createOpening('door', 0, 150, 90), hinge: 'end', swing: 'out' }],
      }),
    );
    // A room of any shape: an L with a slanted wall and a window in it.
    const odd = createRoomFromCorners([
      { x: 0, y: 482 },
      { x: 200, y: 482 },
      { x: 300, y: 582 },
      { x: 300, y: 782 },
      { x: 0, y: 782 },
    ]);
    odd.openings = [createOpening('window', 1, 20, 100)];
    project.rooms.push(odd);
    expect(parseProjectJson(serializeProject(project))).toEqual(project);
  });

  it('migrates version 3 rooms to outlines, leaving doors and windows where they were', () => {
    const { room: _room, ...rest } = V2_FILE;
    const file = {
      ...rest,
      schemaVersion: 3,
      rooms: [
        {
          id: 'r',
          name: 'Office',
          x: 100,
          y: 50,
          width: 380,
          depth: 320,
          walls: { top: { kind: 'wall', thickness: 12 }, right: { kind: 'open', thickness: 12 }, bottom: { kind: 'wall', thickness: 24 }, left: { kind: 'wall', thickness: 12 } },
          openings: [
            { id: 'd', kind: 'door', side: 'bottom', offset: 20, width: 80, hinge: 'start', swing: 'in' },
            { id: 'w', kind: 'window', side: 'left', offset: 100, width: 120, hinge: 'start', swing: 'in' },
            { id: 't', kind: 'window', side: 'top', offset: 70, width: 120, hinge: 'start', swing: 'in' },
          ],
        },
      ],
    };
    const [room] = parseProjectJson(JSON.stringify(file)).rooms;
    expect(room.corners).toEqual(rectCorners(100, 50, 380, 320));
    expect(room.walls).toEqual([
      { kind: 'wall', thickness: 12 },
      { kind: 'open', thickness: 12 },
      { kind: 'wall', thickness: 24 },
      { kind: 'wall', thickness: 12 },
    ]);
    const [door, window, top] = room.openings;
    // The door was 20 cm from the bottom-left corner, hinged on its left; it still is.
    expect(door).toMatchObject({ wall: 2, offset: 280, hinge: 'end' });
    expect(openingAnchor(room, door)).toEqual({ x: 160, y: 370 });
    expect(window).toMatchObject({ wall: 3, offset: 100 });
    expect(openingAnchor(room, window)).toEqual({ x: 100, y: 210 });
    expect(top).toMatchObject({ wall: 0, offset: 70, hinge: 'start' });
  });

  it('repairs room outlines that aren’t a room', () => {
    const project = createSampleProject();
    const file = JSON.parse(serializeProject(project));
    // Counter-clockwise corners are turned around, keeping openings where they are.
    const room = file.rooms[0];
    const before = project.rooms[0].openings.map((o) => openingAnchor(project.rooms[0], o));
    const n = room.corners.length;
    room.corners = [...room.corners].reverse();
    room.walls = [...room.walls].reverse();
    room.openings = room.openings.map((o: { wall: number; offset: number; width: number; hinge: string }) => ({
      ...o,
      wall: (2 * n - 2 - o.wall) % n,
      offset: (o.wall % 2 === 0 ? 380 : 320) - o.offset - o.width,
      hinge: o.hinge === 'start' ? 'end' : 'start',
    }));
    const turned = parseProjectJson(JSON.stringify(file)).rooms[0];
    expect(turned.corners).toEqual(project.rooms[0].corners);
    expect(turned.openings.map((o) => openingAnchor(turned, o))).toEqual(before);
    // Walls crossing each other: the bounding rectangle, without openings.
    room.corners = [{ x: 0, y: 0 }, { x: 300, y: 200 }, { x: 300, y: 0 }, { x: 0, y: 200 }];
    const repaired = parseProjectJson(JSON.stringify(file)).rooms[0];
    expect(roomRect(repaired)).toEqual({ x: 0, y: 0, width: 300, depth: 200 });
    expect(repaired.openings).toEqual([]);
  });

  it('repairs invalid rooms, walls and openings', () => {
    const { room: _room, ...rest } = V2_FILE;
    const file = {
      ...rest,
      schemaVersion: 3,
      rooms: [
        {
          id: 'a',
          name: '  ',
          width: 'wide',
          depth: 20,
          walls: { top: { kind: 'hole', thickness: 500 }, left: 'x' },
          openings: [{ kind: 'gate', side: 'up', offset: 9999, width: 5 }, 'junk', { id: 'a', kind: 'window', side: 'left', offset: -5, width: 120 }],
        },
        { id: 'a', x: 'far', width: 200, depth: 200 },
      ],
    };
    const [first, second] = parseProjectJson(JSON.stringify(file)).rooms;
    expect(first).toMatchObject({ id: 'a', name: 'Room 1' });
    expect(roomRect(first)).toEqual({ x: 0, y: 0, width: 380, depth: 50 });
    expect(first.walls[0]).toEqual({ kind: 'wall', thickness: 100 });
    expect(first.walls[3]).toEqual({ kind: 'wall', thickness: 12 });
    expect(first.openings).toHaveLength(2);
    expect(first.openings[0]).toMatchObject({ kind: 'door', wall: 0, offset: 360, width: 20, hinge: 'start', swing: 'in' });
    expect(first.openings[1]).toMatchObject({ kind: 'window', wall: 3, offset: 0, width: 50 });
    // Rooms, openings and furniture share one selection, so ids are made unique.
    expect(first.openings[1].id).not.toBe('a');
    expect(second.id).not.toBe('a');
    expect(second.name).toBe('Room 2');
  });

  it('gives furniture a new id when it clashes with a room or opening', () => {
    const project = createSampleProject();
    const clash = project.rooms[0].openings[0].id;
    project.layouts[0].furniture[2].id = clash;
    const parsed = parseProjectJson(serializeProject(project));
    expect(parsed.rooms[0].openings[0].id).toBe(clash);
    expect(parsed.layouts[0].furniture[2].id).not.toBe(clash);
  });

  it('rejects a project without rooms', () => {
    expect(() => parseProjectJson(JSON.stringify({ schemaVersion: 3, rooms: [], layouts: [{}] }))).toThrow(/no rooms/);
  });
});

describe('stored projects', () => {
  it('loads a version 2 project from localStorage and keeps an untouched backup', () => {
    const storage = new MemoryStorage();
    const text = JSON.stringify(V2_FILE);
    storage.setItem(STORAGE_KEY, text);
    const project = withLocalStorage(storage, loadStoredProject);
    expect(roomRect(project!.rooms[0])).toEqual({ x: 0, y: 0, width: 400, depth: 300 });
    expect(storage.getItem(legacyBackupKey(2))).toBe(text);
  });

  it('loads a version 1 project from localStorage and keeps an untouched backup', () => {
    const storage = new MemoryStorage();
    const text = JSON.stringify(V1_FILE);
    storage.setItem(STORAGE_KEY, text);
    const project = withLocalStorage(storage, loadStoredProject);
    expect(project?.layouts[0].furniture[0].notes).toBe('old sofa');
    expect(storage.getItem(legacyBackupKey(1))).toBe(text);
  });

  it('does not back up projects already on the current schema', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, serializeProject(createSampleProject()));
    withLocalStorage(storage, loadStoredProject);
    expect(storage.length).toBe(1);
  });
});

describe('L-shaped furniture in project files', () => {
  const sofa = () => productToItem(findBuiltInProduct('generic:sofa-chaise')!, { x: 150, y: 120 });

  it('round-trips arms of different depths', () => {
    const project = createSampleProject();
    const item = { ...sofa(), shape: { kind: 'l' as const, segment: 95, returnWidth: 80, returnSide: 'left' as const } };
    project.layouts[0].furniture.push(item);
    expect(parseProjectJson(serializeProject(project)).layouts[0].furniture.at(-1)).toEqual(item);
  });

  it('gives files from before the arms were sized separately a return as deep as the main part', () => {
    const project = createSampleProject();
    project.layouts[0].furniture.push({ ...sofa(), shape: { kind: 'l', segment: 95, returnSide: 'right' } as never });
    const restored = parseProjectJson(serializeProject(project)).layouts[0].furniture.at(-1)!;
    expect(restored.shape).toEqual({ kind: 'l', segment: 95, returnWidth: 95, returnSide: 'right' });
  });

  it('keeps the return of saved products, defaulting it to the main depth', () => {
    const raw = { id: 'custom:l', manufacturer: 'Custom', productName: 'Desk', category: 'desk', kind: 'l-desk', width: 160, depth: 120, height: 75 };
    expect(parseProduct({ ...raw, shape: { kind: 'l', segment: 70, returnWidth: 50, returnSide: 'left' } }, 'user')?.shape).toEqual({
      kind: 'l',
      segment: 70,
      returnWidth: 50,
      returnSide: 'left',
    });
    expect(parseProduct({ ...raw, shape: { kind: 'l', segment: 70 } }, 'user')?.shape).toEqual({ kind: 'l', segment: 70, returnWidth: 70, returnSide: 'right' });
  });
});

describe('round furniture in project files', () => {
  it('round-trips round and oval items and the new kinds', () => {
    const project = createSampleProject();
    const table = productToItem(findBuiltInProduct('generic:round-dining-table-90')!, { x: 100, y: 100 });
    const pouf = productToItem(findBuiltInProduct('generic:pouf')!, { x: 200, y: 100 });
    const plant = productToItem(findBuiltInProduct('generic:plant')!, { x: 300, y: 100 });
    project.layouts[0].furniture.push(table, pouf, { ...plant, width: 60, depth: 40 });
    const restored = parseProjectJson(serializeProject(project)).layouts[0].furniture.slice(-3);
    expect(restored).toEqual([table, pouf, { ...plant, width: 60, depth: 40 }]);
    expect(restored.map((i) => [i.type, i.shape.kind])).toEqual([
      ['table', 'round'],
      ['pouf', 'round'],
      ['plant', 'round'],
    ]);
  });

  it('keeps round shapes of saved products', () => {
    const product = parseProduct(
      { id: 'custom:1', manufacturer: 'Custom', productName: 'Stool', category: 'chair', kind: 'pouf', width: 35, depth: 35, height: 45, shape: { kind: 'round' } },
      'user',
    );
    expect(product?.shape).toEqual({ kind: 'round' });
    expect(product?.kind).toBe('pouf');
  });
});
