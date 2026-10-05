import { create } from 'zustand';

/**
 * The panels of the mobile layout. The first four open from the bottom bar; `details` is the
 * inspector of the selection, opened from the selection card.
 */
export type SheetId = 'furniture' | 'plan' | 'overview' | 'view' | 'details';

interface SheetState {
  /** The sheet showing over the canvas, if any. */
  open: SheetId | null;
  /** Pulled up to the top bar instead of its usual height. */
  expanded: boolean;
  show(sheet: SheetId): void;
  /** Opens the sheet, or closes it when it is already showing. */
  toggle(sheet: SheetId): void;
  setExpanded(expanded: boolean): void;
  close(): void;
}

export const useSheet = create<SheetState>()((set, get) => ({
  open: null,
  expanded: false,
  show: (open) => set((s) => (s.open === open ? s : { open, expanded: false })),
  toggle: (sheet) => (get().open === sheet ? get().close() : get().show(sheet)),
  setExpanded: (expanded) => set({ expanded }),
  close: () => set({ open: null, expanded: false }),
}));
