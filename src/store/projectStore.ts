import { createStore } from 'zustand/vanilla';
import { CATEGORIES } from '../furniture/categories';
import {
  type CustomItemInput,
  chairSpotForDesk,
  createCustomItem,
  createItemFromPreset,
  findFreeSpot,
  placeOnHost,
} from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import { canHostSurfaceItems, findHostUnder, isDesk } from '../furniture/rules';
import { anchoredResizeCenter } from '../geometry/resize';
import type { Point } from '../geometry/rect';
import type { FurnitureItem, ProjectData, ProjectDocument, Settings } from '../types';
import { createId } from '../utils/id';
import { ROOM_LIMITS } from './defaults';
import {
  type Geometry,
  applyGeometry,
  bringToFront,
  cloneLayout,
  duplicateItem,
  getActiveLayout,
  mapActiveFurniture,
  nextLayoutName,
  removeItem,
  sendBackward,
  uniqueCopyName,
} from './documentOps';
import { createEmptyProject } from './sampleProject';

export const HISTORY_LIMIT = 200;
/** Consecutive edits with the same key within this window form one undo step. */
const COALESCE_MS = 1000;

/** Item properties that don't affect geometry. */
export type ItemPropsPatch = Partial<
  Omit<FurnitureItem, 'id' | 'type' | 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'attachedTo'>
>;

export interface EditorState extends ProjectData {
  selectedId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  /** Document snapshot taken when a drag/rotate/resize gesture starts. */
  gesture: ProjectDocument | null;
  lastEdit: { key: string; at: number } | null;
  /** Incremented when the whole project is replaced (import, new room) so views can reset. */
  projectRevision: number;

  select(id: string | null): void;
  setRoomSize(size: { width?: number; depth?: number }): void;

  addItem(item: FurnitureItem, options?: { findSpot?: boolean; preferred?: Point }): string;
  addPreset(presetId: string, at?: Point): string | null;
  addCustom(input: CustomItemInput): string;
  updateItem(id: string, patch: ItemPropsPatch, options?: { coalesceKey?: string }): void;
  /** Moves/rotates/resizes an item. Keeps it inside the room when that setting is on (unless `clamp: false`). */
  setGeometry(id: string, patch: Partial<Geometry>, options?: { coalesceKey?: string; clamp?: boolean }): void;
  /** Resizes from the inspector, keeping the edge nearest a wall in place. `extra` is applied in the same undo step. */
  resizeItem(id: string, size: { width?: number; depth?: number }, extra?: ItemPropsPatch): void;
  rotateBy(id: string, delta: number): void;
  nudge(id: string, dx: number, dy: number): void;
  duplicateItem(id: string): void;
  deleteItem(id: string): void;
  bringToFront(id: string): void;
  sendBackward(id: string): void;
  attachTo(id: string, parentId: string | null): void;

  beginGesture(): void;
  /** Ends a gesture; for dragged surface items, attaches them to the host underneath. */
  endGesture(draggedId?: string): void;

  createLayout(): void;
  duplicateLayout(id: string): void;
  renameLayout(id: string, name: string): void;
  deleteLayout(id: string): void;
  switchLayout(id: string): void;

  newEmptyRoom(width: number, depth: number): void;
  loadProject(data: ProjectData): void;

  undo(): void;
  redo(): void;
  updateSettings(patch: Partial<Settings>): void;
}

const docOf = (s: ProjectDocument): ProjectDocument => ({
  room: s.room,
  layouts: s.layouts,
  activeLayoutId: s.activeLayoutId,
});

const sameDoc = (a: ProjectDocument, b: ProjectDocument) =>
  a.room === b.room && a.layouts === b.layouts && a.activeLayoutId === b.activeLayoutId;

const clampRoom = (v: number) => Math.round(Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, v)) * 10) / 10;

export function createProjectStore(initial: ProjectData) {
  return createStore<EditorState>()((set, get) => {
    /**
     * Applies a document change and records history. Inside a gesture only the live
     * state changes; the gesture's start snapshot becomes one undo step at the end.
     */
    const commit = (
      mutate: (doc: ProjectDocument) => ProjectDocument,
      options: { coalesceKey?: string; select?: string | null } = {},
    ): boolean => {
      const s = get();
      const before = docOf(s);
      const after = mutate(before);
      if (after === before || sameDoc(before, after)) {
        if (options.select !== undefined) set({ selectedId: options.select });
        return false;
      }
      const patch: Partial<EditorState> = docOf(after);
      if (options.select !== undefined) patch.selectedId = options.select;
      if (!s.gesture) {
        const now = Date.now();
        const key = options.coalesceKey;
        const merge = key !== undefined && s.lastEdit?.key === key && now - s.lastEdit.at < COALESCE_MS;
        if (!merge) patch.past = [...s.past, before].slice(-HISTORY_LIMIT);
        patch.future = [];
        patch.lastEdit = key ? { key, at: now } : null;
      }
      set(patch);
      return true;
    };

    const items = () => getActiveLayout(get()).furniture;
    const findItem = (id: string) => items().find((i) => i.id === id);
    const roomForClamp = () => (get().settings.constrainToRoom ? get().room : null);

    /** Keeps the selection only if the item exists in the active layout of `doc`. */
    const validSelection = (doc: ProjectDocument, id: string | null) =>
      id && getActiveLayout(doc).furniture.some((i) => i.id === id) ? id : null;

    const replaceProject = (data: ProjectData) => {
      const s = get();
      set({
        ...docOf(data),
        settings: { ...data.settings },
        past: [...s.past, docOf(s)].slice(-HISTORY_LIMIT),
        future: [],
        gesture: null,
        lastEdit: null,
        selectedId: null,
        projectRevision: s.projectRevision + 1,
      });
    };

    /**
     * Adds a new item. Surface items (monitors…) go onto a host: the one under the drop point,
     * the selected one, or the first desk. Everything else goes to the nearest free spot.
     */
    const placeNewItem = (item: FurnitureItem, at?: Point): string => {
      const s = get();
      const list = items();
      if (item.placement === 'surface') {
        const selected = s.selectedId ? list.find((i) => i.id === s.selectedId) : undefined;
        const host =
          (at ? findHostUnder(item, list) : null) ??
          (selected && canHostSurfaceItems(selected) ? selected : null) ??
          list.find((i) => isDesk(i)) ??
          null;
        const placement = !host
          ? null
          : at
            ? { position: { ...at, rotation: host.rotation }, moved: new Map<string, Point>() }
            : placeOnHost(item, host, list);
        if (host && placement) {
          const placed = { ...item, ...placement.position, attachedTo: host.id };
          commit(
            (doc) =>
              mapActiveFurniture(doc, (current) => [
                ...current.map((i) => {
                  const p = placement.moved.get(i.id);
                  return p ? { ...i, x: p.x, y: p.y } : i;
                }),
                placed,
              ]),
            { select: placed.id },
          );
          return placed.id;
        }
      }
      if (item.category === 'seating' && item.type === 'office-chair' && !at) {
        // A new chair goes in front of the selected (or first) desk, facing it.
        const selected = s.selectedId ? list.find((i) => i.id === s.selectedId) : undefined;
        const desk = selected && isDesk(selected) ? selected : list.find((i) => isDesk(i));
        if (desk) {
          const spot = chairSpotForDesk(item, desk);
          return get().addItem({ ...item, rotation: spot.rotation }, { preferred: spot });
        }
      }
      return get().addItem(item, { preferred: at });
    };

    return {
      ...initial,
      selectedId: null,
      past: [],
      future: [],
      gesture: null,
      lastEdit: null,
      projectRevision: 0,

      select: (id) => set({ selectedId: validSelection(get(), id) }),

      setRoomSize: ({ width, depth }) =>
        commit((doc) => {
          const w = width === undefined ? doc.room.width : clampRoom(width);
          const d = depth === undefined ? doc.room.depth : clampRoom(depth);
          if (w === doc.room.width && d === doc.room.depth) return doc;
          return { ...doc, room: { ...doc.room, width: w, depth: d } };
        }),

      addItem: (item, options = {}) => {
        const s = get();
        let placed = item;
        if (options.findSpot !== false) {
          placed = { ...item, ...findFreeSpot(item, s.room, items(), options.preferred) };
        }
        commit((doc) => mapActiveFurniture(doc, (list) => [...list, placed]), { select: placed.id });
        return placed.id;
      },

      addPreset: (presetId, at) => {
        const preset = findPreset(presetId);
        if (!preset) return null;
        const s = get();
        return placeNewItem(createItemFromPreset(preset, at ?? { x: s.room.width / 2, y: s.room.depth / 2 }), at);
      },

      addCustom: (input) => {
        const s = get();
        return placeNewItem(createCustomItem(input, { x: s.room.width / 2, y: s.room.depth / 2 }));
      },

      updateItem: (id, patch, options = {}) =>
        commit(
          (doc) =>
          mapActiveFurniture(doc, (list) =>
            list.map((item) => {
              if (item.id !== id) return item;
              const next: FurnitureItem = { ...item, ...patch };
              // Items still using their category's color follow a category change.
              if (patch.category && patch.color === undefined && item.color === CATEGORIES[item.category].color) {
                next.color = CATEGORIES[patch.category].color;
              }
              if (patch.placement === 'floor') next.attachedTo = null;
              return next;
            }),
          ),
          { coalesceKey: options.coalesceKey },
        ),

      setGeometry: (id, patch, options = {}) =>
        commit(
          (doc) =>
            mapActiveFurniture(doc, (list) =>
              applyGeometry(list, id, patch, options.clamp === false ? null : roomForClamp()),
            ),
          { coalesceKey: options.coalesceKey },
        ),

      resizeItem: (id, size, extra = {}) => {
        const item = findItem(id);
        if (!item) return;
        const width = size.width ?? item.width;
        const depth = size.depth ?? item.depth;
        if (width === item.width && depth === item.depth && Object.keys(extra).length === 0) return;
        const center = anchoredResizeCenter(item, width, depth, get().room);
        let shape = item.shape;
        if (shape.kind === 'l') {
          shape = { ...shape, segment: Math.min(shape.segment, Math.max(1, Math.min(width, depth) - 1)) };
        }
        commit((doc) =>
          mapActiveFurniture(doc, (list) =>
            applyGeometry(
              list.map((i) => (i.id === id ? { ...i, ...extra, shape } : i)),
              id,
              { width, depth, ...center },
              roomForClamp(),
            ),
          ),
        );
      },

      rotateBy: (id, delta) => {
        const item = findItem(id);
        if (item) get().setGeometry(id, { rotation: item.rotation + delta });
      },

      nudge: (id, dx, dy) => {
        const item = findItem(id);
        if (item) get().setGeometry(id, { x: item.x + dx, y: item.y + dy }, { coalesceKey: `nudge:${id}` });
      },

      duplicateItem: (id) => {
        let newId: string | null = null;
        commit((doc) =>
          mapActiveFurniture(doc, (list) => {
            const result = duplicateItem(list, id, 20, 20);
            newId = result.newId;
            if (newId && get().settings.constrainToRoom) {
              return applyGeometry(result.items, newId, {}, get().room);
            }
            return result.items;
          }),
        );
        if (newId) set({ selectedId: newId });
      },

      deleteItem: (id) =>
        commit((doc) => mapActiveFurniture(doc, (list) => removeItem(list, id)), {
          select: get().selectedId === id ? null : get().selectedId,
        }),

      bringToFront: (id) => commit((doc) => mapActiveFurniture(doc, (list) => bringToFront(list, id))),
      sendBackward: (id) => commit((doc) => mapActiveFurniture(doc, (list) => sendBackward(list, id))),

      attachTo: (id, parentId) =>
        commit((doc) =>
          mapActiveFurniture(doc, (list) =>
            list.map((i) => (i.id === id && i.id !== parentId ? { ...i, attachedTo: parentId } : i)),
          ),
        ),

      beginGesture: () => {
        if (!get().gesture) set({ gesture: docOf(get()), lastEdit: null });
      },

      endGesture: (draggedId) => {
        if (draggedId) {
          const item = findItem(draggedId);
          if (item && item.placement === 'surface') {
            const host = findHostUnder(item, items());
            const attachedTo = host?.id ?? null;
            if (attachedTo !== item.attachedTo) {
              commit((doc) =>
                mapActiveFurniture(doc, (list) => list.map((i) => (i.id === draggedId ? { ...i, attachedTo } : i))),
              );
            }
          }
        }
        const s = get();
        const start = s.gesture;
        if (!start) return;
        if (sameDoc(start, docOf(s))) {
          set({ gesture: null });
          return;
        }
        set({ gesture: null, past: [...s.past, start].slice(-HISTORY_LIMIT), future: [], lastEdit: null });
      },

      createLayout: () => {
        const layout = { id: createId('layout'), name: nextLayoutName(get().layouts), furniture: [] };
        commit((doc) => ({ ...doc, layouts: [...doc.layouts, layout], activeLayoutId: layout.id }), { select: null });
      },

      duplicateLayout: (id) => {
        const s = get();
        const source = s.layouts.find((l) => l.id === id);
        if (!source) return;
        const copy = cloneLayout(source, uniqueCopyName(source.name, s.layouts));
        const idx = s.layouts.indexOf(source);
        commit(
          (doc) => ({
            ...doc,
            layouts: [...doc.layouts.slice(0, idx + 1), copy, ...doc.layouts.slice(idx + 1)],
            activeLayoutId: copy.id,
          }),
          { select: null },
        );
      },

      renameLayout: (id, name) => {
        const trimmed = name.trim().slice(0, 80);
        if (!trimmed) return;
        commit((doc) => {
          const layout = doc.layouts.find((l) => l.id === id);
          if (!layout || layout.name === trimmed) return doc;
          return { ...doc, layouts: doc.layouts.map((l) => (l.id === id ? { ...l, name: trimmed } : l)) };
        });
      },

      deleteLayout: (id) => {
        const s = get();
        if (s.layouts.length <= 1) return;
        const idx = s.layouts.findIndex((l) => l.id === id);
        if (idx < 0) return;
        const remaining = s.layouts.filter((l) => l.id !== id);
        const activeLayoutId = s.activeLayoutId === id ? remaining[Math.max(0, idx - 1)].id : s.activeLayoutId;
        commit((doc) => ({ ...doc, layouts: remaining, activeLayoutId }), {
          select: s.activeLayoutId === id ? null : s.selectedId,
        });
      },

      switchLayout: (id) => {
        const s = get();
        if (id === s.activeLayoutId || !s.layouts.some((l) => l.id === id)) return;
        // Switching views is not an edit, so it is not recorded; undo restores the layout
        // that was active when a change happened.
        set({ activeLayoutId: id, selectedId: null, lastEdit: null });
      },

      newEmptyRoom: (width, depth) => replaceProject(createEmptyProject(clampRoom(width), clampRoom(depth), get().settings)),

      loadProject: (data) => replaceProject(data),

      undo: () => {
        const s = get();
        if (s.gesture || s.past.length === 0) return;
        const previous = s.past[s.past.length - 1];
        set({
          ...previous,
          past: s.past.slice(0, -1),
          future: [docOf(s), ...s.future].slice(0, HISTORY_LIMIT),
          lastEdit: null,
          selectedId: validSelection(previous, s.selectedId),
        });
      },

      redo: () => {
        const s = get();
        if (s.gesture || s.future.length === 0) return;
        const next = s.future[0];
        set({
          ...next,
          past: [...s.past, docOf(s)].slice(-HISTORY_LIMIT),
          future: s.future.slice(1),
          lastEdit: null,
          selectedId: validSelection(next, s.selectedId),
        });
      },

      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
    };
  });
}

export type ProjectStore = ReturnType<typeof createProjectStore>;

export const selectActiveLayout = (s: EditorState) => getActiveLayout(s);
export const selectItems = (s: EditorState) => getActiveLayout(s).furniture;
export const selectSelectedItem = (s: EditorState) =>
  s.selectedId ? (getActiveLayout(s).furniture.find((i) => i.id === s.selectedId) ?? null) : null;
export const selectProjectData = (s: EditorState): ProjectData => ({ ...docOf(s), settings: s.settings });
