import { create } from 'zustand';

const STORAGE_KEY = 'room-planner:shortcuts-open';

/** Open unless this browser remembers it being closed. */
function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

interface ShortcutsState {
  /** The keyboard shortcuts panel over the canvas is showing. */
  open: boolean;
  toggle(): void;
}

export const useShortcutsPanel = create<ShortcutsState>()((set, get) => ({
  open: load(),
  toggle: () => {
    const open = !get().open;
    set({ open });
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Private mode or full storage.
    }
  },
}));
