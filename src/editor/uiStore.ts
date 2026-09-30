import { create } from 'zustand';
import type { Point } from '../geometry/rect';
import type { SnapGuide } from '../geometry/snapping';
import { clampZoom } from '../geometry/viewport';

/** Transient editor state: not saved, not undoable. */
interface UiState {
  zoom: number;
  pan: Point;
  guides: SnapGuide[];
  draggingId: string | null;
  hoveredId: string | null;
  setView(zoom: number, pan: Point): void;
  setPan(pan: Point): void;
  resetView(): void;
  setGuides(guides: SnapGuide[]): void;
  setDragging(id: string | null): void;
  setHovered(id: string | null): void;
}

export const useUi = create<UiState>()((set) => ({
  zoom: 1,
  pan: { x: 0, y: 0 },
  guides: [],
  draggingId: null,
  hoveredId: null,
  setView: (zoom, pan) => set({ zoom: clampZoom(zoom), pan }),
  setPan: (pan) => set({ pan }),
  resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
  setGuides: (guides) => set((s) => (s.guides.length === 0 && guides.length === 0 ? s : { guides })),
  setDragging: (draggingId) => set({ draggingId }),
  setHovered: (hoveredId) => set({ hoveredId }),
}));
