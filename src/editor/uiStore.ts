import { create } from 'zustand';
import type { Box, Point } from '../geometry/rect';
import type { SnapGuide } from '../geometry/snapping';
import { clampZoom } from '../geometry/viewport';

/** `select` is the normal editor; `draw` places the corners of a new room with each click. */
export type EditorTool = 'select' | 'draw';

/** A room being drawn wall by wall. */
export interface Draft {
  /** Corners placed so far. */
  points: Point[];
  /** Where the next corner would go (snapped), or null when the pointer isn't over the canvas. */
  cursor: Point | null;
  /** The pointer is on the first corner, so a click closes the room. */
  closing: boolean;
  /** Digits typed for the exact length of the next wall. */
  typed: string;
}

const EMPTY_DRAFT: Draft = { points: [], cursor: null, closing: false, typed: '' };

/** Transient editor state: not saved, not undoable. */
interface UiState {
  zoom: number;
  pan: Point;
  /**
   * The plan area the view is fitted to. Null follows the plan as it changes; zooming,
   * panning or dragging a room freezes it, so the view doesn't jump while you work.
   */
  fitBox: Box | null;
  /** Current bounds of the plan, kept here so view actions can freeze them. */
  liveBox: Box | null;
  guides: SnapGuide[];
  draggingId: string | null;
  hoveredId: string | null;
  tool: EditorTool;
  draft: Draft;
  /** A wall of the selected room pointed at in the inspector, highlighted on the plan. */
  hoveredWall: { roomId: string; wall: number } | null;
  setView(zoom: number, pan: Point): void;
  setPan(pan: Point): void;
  /** Fits the whole plan into the view again. */
  resetView(): void;
  freezeView(): void;
  setLiveBox(box: Box): void;
  setGuides(guides: SnapGuide[]): void;
  setDragging(id: string | null): void;
  setHovered(id: string | null): void;
  /** Switches tools; any unfinished drawing is discarded. */
  setTool(tool: EditorTool): void;
  updateDraft(patch: Partial<Draft>): void;
  setHoveredWall(wall: { roomId: string; wall: number } | null): void;
}

export const useUi = create<UiState>()((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  fitBox: null,
  liveBox: null,
  guides: [],
  draggingId: null,
  hoveredId: null,
  tool: 'select',
  draft: EMPTY_DRAFT,
  hoveredWall: null,
  setView: (zoom, pan) => set((s) => ({ zoom: clampZoom(zoom), pan, fitBox: s.fitBox ?? s.liveBox })),
  setPan: (pan) => set((s) => ({ pan, fitBox: s.fitBox ?? s.liveBox })),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 }, fitBox: null }),
  freezeView: () => set((s) => (s.fitBox || !s.liveBox ? s : { fitBox: s.liveBox })),
  setLiveBox: (liveBox) => set({ liveBox }),
  setGuides: (guides) => set((s) => (s.guides.length === 0 && guides.length === 0 ? s : { guides })),
  setDragging: (draggingId) => set({ draggingId }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setTool: (tool) => set({ tool, draft: EMPTY_DRAFT, guides: [] }),
  updateDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  setHoveredWall: (hoveredWall) => set({ hoveredWall }),
}));
