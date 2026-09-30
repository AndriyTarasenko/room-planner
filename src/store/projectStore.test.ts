import { describe, expect, it } from 'vitest';
import { footprintBox } from '../geometry/footprint';
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
    expect(s.room).toMatchObject({ width: 380, depth: 320 });
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
    expect(parsed.room.width).toBe(420);
    expect(parsed.room.depth).toBe(50);
    const [desk] = parsed.layouts[0].furniture;
    expect(desk).toMatchObject({ type: 'desk', width: 140, depth: 80, x: 10, y: 20, attachedTo: null });
    expect(parsed.layouts[0].name).toBe('Layout 1');
    expect(parsed.activeLayoutId).toBe(parsed.layouts[0].id);
  });

  it('loads an imported project as one undoable step', () => {
    const store = newStore();
    const imported = createEmptyProject(500, 400);
    store.getState().loadProject(imported);
    expect(store.getState().room.width).toBe(500);
    store.getState().undo();
    expect(store.getState().room.width).toBe(380);
  });
});
