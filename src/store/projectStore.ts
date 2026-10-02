import { createStore } from 'zustand/vanilla';
import { productToItem } from '../catalog/productToItem';
import type { FurnitureProduct } from '../catalog/types';
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
import { canHostSurfaceItems, defaultHost, findHostUnder, isDesk } from '../furniture/rules';
import { footprintBox } from '../geometry/footprint';
import { anchoredResizeCenter } from '../geometry/resize';
import type { Point } from '../geometry/rect';
import { OPENING_DEFAULTS, clampOpening, createOpening, freeOpeningPlacement, openingDropTarget } from '../plan/openings';
import { snapRoomMove } from '../plan/roomSnapping';
import { NEW_ROOM_SIZE, createRoom, createRoomFromCorners, dockedRoomPosition, nextRoomName, roomAnchor, roomAt, roomForBox } from '../plan/rooms';
import { isValidOutline, moveCorner, moveWall, removeCorner, roomBounds, setWallLength, splitWall } from '../plan/shape';
import { WALL_LIMITS, defaultWalls, startsAtPlanStart, wallFrame, wrap } from '../plan/walls';
import type {
  FurnitureItem,
  Opening,
  OpeningKind,
  PlanPoint,
  ProjectData,
  ProjectDocument,
  Room,
  Settings,
  Shape,
  Wall,
} from '../types';
import { createId } from '../utils/id';
import { POSITION_LIMIT, ROOM_LIMITS } from './defaults';
import {
  type Geometry,
  type RoomGeometry,
  activeRooms,
  applyGeometry,
  applyRoomGeometry,
  bringToFront,
  cloneLayout,
  duplicateItem,
  findOpening,
  getActiveLayout,
  getActivePlan,
  layoutsSharingPlan,
  mapActiveFurniture,
  mapActiveRooms,
  mapRoom,
  nextLayoutName,
  prunePlans,
  removeItem,
  removeRoom,
  replaceRoom,
  sendBackward,
  uniqueCopyName,
  unlinkPlan,
} from './documentOps';
import { createEmptyProject } from './sampleProject';

export const HISTORY_LIMIT = 200;
/** Consecutive edits with the same key within this window form one undo step. */
const COALESCE_MS = 1000;

/** Item properties that don't affect geometry. */
export type ItemPropsPatch = Partial<
  Omit<FurnitureItem, 'id' | 'type' | 'x' | 'y' | 'width' | 'depth' | 'rotation' | 'attachedTo'>
>;

export type OpeningPatch = Partial<Omit<Opening, 'id'>>;

export interface EditorState extends ProjectData {
  /** The selected furniture item, room or opening (ids are unique across all three). */
  selectedId: string | null;
  /**
   * The room new furniture and openings go into when nothing is selected and no position is
   * given: the room last selected, or the one in the middle of the view. Not saved, not undoable.
   */
  focusRoomId: string | null;
  past: ProjectDocument[];
  future: ProjectDocument[];
  /** Document snapshot taken when a drag/rotate/resize gesture starts. */
  gesture: ProjectDocument | null;
  lastEdit: { key: string; at: number } | null;
  /** Incremented when the whole project is replaced (import, new plan) so views can reset. */
  projectRevision: number;

  select(id: string | null): void;
  focusRoom(id: string | null): void;

  addItem(item: FurnitureItem, options?: { findSpot?: boolean; preferred?: Point }): string;
  addPreset(presetId: string, at?: Point): string | null;
  /** Places a catalog product; the new item keeps its own copy of all product data. */
  addProduct(product: FurnitureProduct, at?: Point): string;
  addCustom(input: CustomItemInput): string;
  updateItem(id: string, patch: ItemPropsPatch, options?: { coalesceKey?: string }): void;
  /** Moves/rotates/resizes an item. Keeps it inside its room when that setting is on (unless `clamp: false`). */
  setGeometry(id: string, patch: Partial<Geometry>, options?: { coalesceKey?: string; clamp?: boolean }): void;
  /** Resizes from the inspector, keeping the edge nearest a wall in place. `extra` is applied in the same undo step. */
  resizeItem(id: string, size: { width?: number; depth?: number }, extra?: ItemPropsPatch): void;
  /**
   * Sets position, size and shape together, for the arm handles of L-shaped items. Like a
   * transformer resize it doesn't keep the item in its room; `setGeometry(id, {})` does that.
   */
  reshapeItem(id: string, next: Pick<Geometry, 'x' | 'y' | 'width' | 'depth'> & { shape: Shape }): void;
  rotateBy(id: string, delta: number): void;
  nudge(id: string, dx: number, dy: number): void;
  duplicateItem(id: string): void;
  deleteItem(id: string): void;
  bringToFront(id: string): void;
  sendBackward(id: string): void;
  attachTo(id: string, parentId: string | null): void;

  /** Adds a rectangular room: centered on `at` (docked to a nearby room), or next to the plan's rightmost room. */
  addRoom(options?: { at?: Point; name?: string; width?: number; depth?: number }): string;
  /** Adds a room drawn corner by corner. Returns null when the outline isn't a usable room (walls crossing, too small). */
  addDrawnRoom(corners: readonly PlanPoint[]): string | null;
  renameRoom(id: string, name: string): void;
  /**
   * Moves a room, or moves and resizes a rectangular one. `carry` moves its furniture (in all
   * layouts on this floor plan) along; use it when the room is moved as a whole, not when one
   * wall is dragged.
   */
  setRoomGeometry(id: string, patch: Partial<RoomGeometry>, options?: { carry?: boolean; coalesceKey?: string }): void;
  /**
   * Pushes a wall outward (negative: pulls it in), keeping the neighboring walls' directions.
   * During a gesture the distance counts from where the wall was when the gesture started.
   * Returns false when the wall can't go there (walls would cross); the room then keeps its shape.
   */
  moveRoomWall(id: string, wall: number, distance: number, options?: { coalesceKey?: string }): boolean;
  moveRoomCorner(id: string, corner: number, to: Point, options?: { coalesceKey?: string }): void;
  /** Makes a wall exactly `length` cm long by moving the next wall, so all angles stay. */
  setRoomWallLength(id: string, wall: number, length: number): void;
  /** Adds a corner `t` cm along a wall. Returns the new corner's index, or null if it can't go there. */
  splitRoomWall(id: string, wall: number, t: number): number | null;
  /** Removes a corner, joining its two walls. False when that isn't possible (a triangle, or walls would cross). */
  removeRoomCorner(id: string, corner: number): boolean;
  setWall(roomId: string, wall: number, patch: Partial<Wall>): void;
  /** Deletes a room with its furniture in all layouts on this floor plan. The last room can't be deleted. */
  deleteRoom(id: string): void;

  /** Adds a door, window or passage: onto the wall nearest to `at`, or into a free stretch of wall in `roomId` (default: the focus room). */
  addOpening(kind: OpeningKind, options?: { roomId?: string; at?: Point }): string | null;
  /** Changes an opening; it is kept within its side. */
  updateOpening(id: string, patch: OpeningPatch, options?: { coalesceKey?: string }): void;
  deleteOpening(id: string): void;

  beginGesture(): void;
  /** Ends a gesture; for dragged surface items, attaches them to the host underneath. */
  endGesture(draggedId?: string): void;

  /** Adds an empty layout on the active layout's floor plan. */
  createLayout(): void;
  /** Copies a layout's furniture, on the same floor plan or (`ownPlan`) on a copy of it. */
  duplicateLayout(id: string, options?: { ownPlan?: boolean }): void;
  /** Gives a layout its own copy of the floor plan it shares with other layouts. */
  unlinkPlan(layoutId: string): void;
  renameLayout(id: string, name: string): void;
  deleteLayout(id: string): void;
  switchLayout(id: string): void;

  /** Replaces the project with one empty room of the given size. */
  newPlan(width: number, depth: number): void;
  loadProject(data: ProjectData): void;

  undo(): void;
  redo(): void;
  updateSettings(patch: Partial<Settings>): void;
}

const docOf = (s: ProjectDocument): ProjectDocument => ({
  plans: s.plans,
  layouts: s.layouts,
  activeLayoutId: s.activeLayoutId,
});

const sameDoc = (a: ProjectDocument, b: ProjectDocument) =>
  a.plans === b.plans && a.layouts === b.layouts && a.activeLayoutId === b.activeLayoutId;

const round1 = (v: number) => Math.round(v * 10) / 10;
const clampRoom = (v: number) => round1(Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, v)));
const clampPosition = (v: number) => round1(Math.min(POSITION_LIMIT, Math.max(-POSITION_LIMIT, v)));
const clampWall = (v: number) => round1(Math.min(WALL_LIMITS.max, Math.max(WALL_LIMITS.min, v)));

const sameOpening = (a: Opening, b: Opening) =>
  a.kind === b.kind && a.wall === b.wall && a.offset === b.offset && a.width === b.width && a.hinge === b.hinge && a.swing === b.swing;

/** Keeps a selection only if it still exists: an item of the active layout, or a room or opening of its floor plan. */
function validSelection(doc: ProjectDocument, id: string | null): string | null {
  if (!id) return null;
  if (getActiveLayout(doc).furniture.some((i) => i.id === id)) return id;
  const rooms = activeRooms(doc);
  if (rooms.some((r) => r.id === id)) return id;
  return findOpening(rooms, id) ? id : null;
}

/** The room a selection belongs to. */
function roomOfSelection(doc: ProjectDocument, id: string | null): string | null {
  if (!id) return null;
  const rooms = activeRooms(doc);
  const item = getActiveLayout(doc).furniture.find((i) => i.id === id);
  if (item) return roomForBox(footprintBox(item), rooms)?.id ?? null;
  if (rooms.some((r) => r.id === id)) return id;
  return findOpening(rooms, id)?.room.id ?? null;
}

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
    const rooms = () => activeRooms(get());
    const findRoom = (id: string) => rooms().find((r) => r.id === id);
    const roomsForClamp = () => (get().settings.constrainToRoom ? rooms() : null);
    /** Where new things go when no position is given: the selection's room, else the focus room. */
    const targetRoom = (): Room => {
      const s = get();
      const id = roomOfSelection(s, s.selectedId) ?? s.focusRoomId;
      return rooms().find((r) => r.id === id) ?? rooms()[0];
    };
    const defaultSpot = () => roomAnchor(targetRoom());

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
        focusRoomId: null,
        projectRevision: s.projectRevision + 1,
      });
    };

    /**
     * Adds a new item. Surface items (monitors…) go onto a host: the one under the drop point,
     * the selected one, or a default one (see `defaultHost`). Everything else, and surface
     * items without a host, go to the nearest free spot.
     */
    const placeNewItem = (item: FurnitureItem, at?: Point): string => {
      const s = get();
      const list = items();
      if (item.placement === 'surface') {
        const selected = s.selectedId ? list.find((i) => i.id === s.selectedId) : undefined;
        const host =
          (at ? findHostUnder(item, list) : null) ??
          (selected && canHostSurfaceItems(selected) ? selected : null) ??
          defaultHost(item, list);
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
      focusRoomId: null,
      past: [],
      future: [],
      gesture: null,
      lastEdit: null,
      projectRevision: 0,

      select: (id) => {
        const s = get();
        const selectedId = validSelection(s, id);
        set({ selectedId, focusRoomId: roomOfSelection(s, selectedId) ?? s.focusRoomId });
      },

      focusRoom: (id) => {
        if (id !== get().focusRoomId) set({ focusRoomId: id });
      },

      addItem: (item, options = {}) => {
        const s = get();
        let placed = item;
        if (options.findSpot !== false) {
          const room = options.preferred ? roomAt(options.preferred, activeRooms(s)) : targetRoom();
          placed = { ...item, ...findFreeSpot(item, room.corners, items(), options.preferred) };
        }
        commit((doc) => mapActiveFurniture(doc, (list) => [...list, placed]), { select: placed.id });
        return placed.id;
      },

      addPreset: (presetId, at) => {
        const preset = findPreset(presetId);
        if (!preset) return null;
        return placeNewItem(createItemFromPreset(preset, at ?? defaultSpot()), at);
      },

      addProduct: (product, at) => placeNewItem(productToItem(product, at ?? defaultSpot()), at),

      addCustom: (input) => placeNewItem(createCustomItem(input, defaultSpot())),

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
              applyGeometry(list, id, patch, options.clamp === false ? null : roomsForClamp()),
            ),
          { coalesceKey: options.coalesceKey },
        ),

      resizeItem: (id, size, extra = {}) => {
        const item = findItem(id);
        if (!item) return;
        const width = size.width ?? item.width;
        const depth = size.depth ?? item.depth;
        if (width === item.width && depth === item.depth && Object.keys(extra).length === 0) return;
        const center = anchoredResizeCenter(item, width, depth, roomForBox(footprintBox(item), rooms()).corners);
        let shape = extra.shape ?? item.shape;
        if (shape.kind === 'l') {
          shape = {
            ...shape,
            segment: Math.min(shape.segment, Math.max(1, depth - 1)),
            returnWidth: Math.min(shape.returnWidth, Math.max(1, width - 1)),
          };
        }
        commit((doc) =>
          mapActiveFurniture(doc, (list) =>
            applyGeometry(
              list.map((i) => (i.id === id ? { ...i, ...extra, shape } : i)),
              id,
              { width, depth, ...center },
              roomsForClamp(),
            ),
          ),
        );
      },

      reshapeItem: (id, { shape, ...geometry }) =>
        commit((doc) =>
          mapActiveFurniture(doc, (list) =>
            applyGeometry(
              list.map((i) => (i.id === id ? { ...i, shape } : i)),
              id,
              geometry,
              null,
            ),
          ),
        ),

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
              return applyGeometry(result.items, newId, {}, rooms());
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

      addRoom: (options = {}) => {
        const plan = rooms();
        const width = clampRoom(options.width ?? NEW_ROOM_SIZE.width);
        const depth = clampRoom(options.depth ?? NEW_ROOM_SIZE.depth);
        const walls = defaultWalls();
        let position: Point;
        if (options.at) {
          const proposed = createRoom({ width, depth, walls, x: Math.round(options.at.x - width / 2), y: Math.round(options.at.y - depth / 2) });
          const snap = snapRoomMove(proposed, plan, 40);
          const b = roomBounds(proposed);
          position = { x: b.minX + snap.dx, y: b.minY + snap.dy };
        } else {
          position = dockedRoomPosition(plan, walls);
        }
        const room = createRoom({
          name: options.name ?? nextRoomName(plan),
          width,
          depth,
          walls,
          x: clampPosition(position.x),
          y: clampPosition(position.y),
        });
        commit((doc) => mapActiveRooms(doc, (list) => [...list, room]), { select: room.id });
        set({ focusRoomId: room.id });
        return room.id;
      },

      addDrawnRoom: (corners) => {
        const room = createRoomFromCorners(corners, { name: nextRoomName(rooms()) });
        if (!isValidOutline(room.corners)) return null;
        commit((doc) => mapActiveRooms(doc, (list) => [...list, room]), { select: room.id });
        set({ focusRoomId: room.id });
        return room.id;
      },

      renameRoom: (id, name) => {
        const trimmed = name.trim().slice(0, 80);
        if (!trimmed) return;
        commit((doc) => mapRoom(doc, id, (room) => (room.name === trimmed ? room : { ...room, name: trimmed })));
      },

      setRoomGeometry: (id, patch, options = {}) =>
        commit(
          (doc) => {
            const clean: Partial<RoomGeometry> = {};
            if (patch.width !== undefined) clean.width = clampRoom(patch.width);
            if (patch.depth !== undefined) clean.depth = clampRoom(patch.depth);
            if (patch.x !== undefined) clean.x = clampPosition(patch.x);
            if (patch.y !== undefined) clean.y = clampPosition(patch.y);
            return applyRoomGeometry(doc, get().gesture ?? doc, id, clean, options.carry ?? false);
          },
          { coalesceKey: options.coalesceKey },
        ),

      moveRoomWall: (id, wall, distance, options = {}) => {
        const gesture = get().gesture;
        const current = findRoom(id);
        // Within a gesture, start from the room as it was, so a pushed-out bay is only added once.
        const base = (gesture && activeRooms(gesture).find((r) => r.id === id)) ?? current;
        if (!current || !base) return false;
        const next = moveWall(base, wall, distance);
        // An impossible shape (walls crossing) keeps the last good one.
        if (next === base && Math.abs(distance) > 1e-9) return false;
        commit((doc) => replaceRoom(doc, doc, next, false), { coalesceKey: options.coalesceKey });
        return true;
      },

      moveRoomCorner: (id, corner, to, options = {}) => {
        const room = findRoom(id);
        if (!room) return;
        commit((doc) => replaceRoom(doc, doc, moveCorner(room, corner, to), false), { coalesceKey: options.coalesceKey });
      },

      setRoomWallLength: (id, wall, length) => {
        const room = findRoom(id);
        if (!room) return;
        commit((doc) => replaceRoom(doc, doc, setWallLength(room, wall, length), false));
      },

      splitRoomWall: (id, wall, t) => {
        const room = findRoom(id);
        if (!room) return null;
        const next = splitWall(room, wall, t);
        if (next === room) return null;
        commit((doc) => replaceRoom(doc, doc, next, false), { select: id });
        return wrap(wall, room.corners.length) + 1;
      },

      removeRoomCorner: (id, corner) => {
        const room = findRoom(id);
        if (!room) return false;
        const next = removeCorner(room, corner);
        if (next === room) return false;
        return commit((doc) => replaceRoom(doc, doc, next, false));
      },

      setWall: (roomId, index, patch) =>
        commit((doc) =>
          mapRoom(doc, roomId, (room) => {
            const wall = room.walls[index];
            if (!wall) return room;
            const kind = patch.kind ?? wall.kind;
            const thickness = patch.thickness === undefined ? wall.thickness : clampWall(patch.thickness);
            if (kind === wall.kind && thickness === wall.thickness) return room;
            return { ...room, walls: room.walls.map((w, i) => (i === index ? { kind, thickness } : w)) };
          }),
        ),

      deleteRoom: (id) => {
        if (!commit((doc) => removeRoom(doc, id))) return;
        const s = get();
        set({
          selectedId: validSelection(s, s.selectedId),
          focusRoomId: s.focusRoomId === id ? null : s.focusRoomId,
        });
      },

      addOpening: (kind, options = {}) => {
        const width = OPENING_DEFAULTS[kind].width;
        let room: Room | undefined;
        let opening: Opening;
        if (options.at) {
          const target = openingDropTarget(rooms(), options.at, width);
          if (!target) return null;
          room = target.room;
          opening = createOpening(kind, target.placement.wall, target.placement.offset, target.placement.width);
        } else {
          room = (options.roomId && findRoom(options.roomId)) || targetRoom();
          if (!room) return null;
          const placement = freeOpeningPlacement(room, width);
          opening = createOpening(kind, placement.wall, placement.offset, placement.width);
        }
        const roomId = room.id;
        commit((doc) => mapRoom(doc, roomId, (r) => ({ ...r, openings: [...r.openings, opening] })), { select: opening.id });
        set({ focusRoomId: roomId });
        return opening.id;
      },

      updateOpening: (id, patch, options = {}) =>
        commit(
          (doc) => {
            const found = findOpening(activeRooms(doc), id);
            if (!found) return doc;
            return mapRoom(doc, found.room.id, (room) => {
              let merged: Opening = { ...found.opening, ...patch, id };
              // Moved to a wall running the other way on the plan: keep its distance from the
              // left (or top) end and its hinge on the same side, as seen on the plan.
              if (patch.wall !== undefined && patch.wall !== found.opening.wall && room.corners[patch.wall]) {
                const from = wallFrame(room, found.opening.wall);
                const to = wallFrame(room, patch.wall);
                if (startsAtPlanStart(from) !== startsAtPlanStart(to)) {
                  const plain = startsAtPlanStart(from) ? merged.offset : from.length - merged.offset - merged.width;
                  if (patch.offset === undefined) merged = { ...merged, offset: to.length - plain - merged.width };
                  if (patch.hinge === undefined) merged = { ...merged, hinge: merged.hinge === 'start' ? 'end' : 'start' };
                }
              }
              const next = clampOpening(merged, room);
              if (sameOpening(next, found.opening)) return room;
              return { ...room, openings: room.openings.map((o) => (o.id === id ? next : o)) };
            });
          },
          { coalesceKey: options.coalesceKey },
        ),

      deleteOpening: (id) =>
        commit(
          (doc) => {
            const found = findOpening(activeRooms(doc), id);
            if (!found) return doc;
            return mapRoom(doc, found.room.id, (room) => ({ ...room, openings: room.openings.filter((o) => o.id !== id) }));
          },
          { select: get().selectedId === id ? null : get().selectedId },
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
        const s = get();
        const layout = { id: createId('layout'), name: nextLayoutName(s.layouts), planId: getActivePlan(s).id, furniture: [] };
        commit((doc) => ({ ...doc, layouts: [...doc.layouts, layout], activeLayoutId: layout.id }), { select: null });
      },

      duplicateLayout: (id, options = {}) => {
        const s = get();
        const source = s.layouts.find((l) => l.id === id);
        if (!source) return;
        const copy = cloneLayout(source, uniqueCopyName(source.name, s.layouts));
        const idx = s.layouts.indexOf(source);
        commit(
          (doc) => {
            const next = {
              ...doc,
              layouts: [...doc.layouts.slice(0, idx + 1), copy, ...doc.layouts.slice(idx + 1)],
              activeLayoutId: copy.id,
            };
            return options.ownPlan ? unlinkPlan(next, copy.id) : next;
          },
          { select: null },
        );
      },

      unlinkPlan: (layoutId) => commit((doc) => unlinkPlan(doc, layoutId)),

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
        commit((doc) => prunePlans({ ...doc, layouts: remaining, activeLayoutId }), {
          select: s.activeLayoutId === id ? null : s.selectedId,
        });
      },

      switchLayout: (id) => {
        const s = get();
        if (id === s.activeLayoutId || !s.layouts.some((l) => l.id === id)) return;
        // Switching views is not an edit, so it is not recorded; undo restores the layout
        // that was active when a change happened. Rooms and openings stay selected when the
        // other layout has them too (it shares the floor plan, or has a copy of it).
        const next = { ...docOf(s), activeLayoutId: id };
        set({ activeLayoutId: id, selectedId: validSelection(next, s.selectedId), lastEdit: null });
      },

      newPlan: (width, depth) => replaceProject(createEmptyProject(clampRoom(width), clampRoom(depth), get().settings)),

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
/** Rooms of the active layout's floor plan. */
export const selectRooms = (s: ProjectDocument) => activeRooms(s);
/** Names of the other layouts on the active layout's floor plan (a new array: select it with `useShallow`). */
export const selectPlanSharedWith = (s: EditorState) => layoutsSharingPlan(s, s.activeLayoutId).map((l) => l.name);
export const selectSelectedItem = (s: EditorState) =>
  s.selectedId ? (getActiveLayout(s).furniture.find((i) => i.id === s.selectedId) ?? null) : null;
export const selectSelectedRoom = (s: EditorState) => (s.selectedId ? (activeRooms(s).find((r) => r.id === s.selectedId) ?? null) : null);
export const selectSelectedOpening = (s: EditorState) => (s.selectedId ? (findOpening(activeRooms(s), s.selectedId)?.opening ?? null) : null);
/** The room that owns the selected opening. */
export const selectSelectedOpeningRoom = (s: EditorState) => (s.selectedId ? (findOpening(activeRooms(s), s.selectedId)?.room ?? null) : null);
export const selectProjectData = (s: EditorState): ProjectData => ({ ...docOf(s), settings: s.settings });
