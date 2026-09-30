import type { ProjectData } from '../types';
import { type EditorState, type ProjectStore, selectProjectData } from './projectStore';
import { parseProjectData, toProjectFile } from './serialization';

export const STORAGE_KEY = 'room-planner:project';
const BACKUP_KEY = 'room-planner:project:unreadable';
const SAVE_DELAY_MS = 300;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Loads the saved project, or null on first launch. Unreadable data is kept aside, not deleted. */
export function loadStoredProject(): ProjectData | null {
  const ls = storage();
  const text = ls?.getItem(STORAGE_KEY);
  if (!ls || !text) return null;
  try {
    return parseProjectData(JSON.parse(text));
  } catch (error) {
    console.warn('Saved project could not be read; starting fresh. A copy was kept under', BACKUP_KEY, error);
    try {
      ls.setItem(BACKUP_KEY, text);
    } catch {
      // Storage full; nothing more we can do.
    }
    return null;
  }
}

export function saveProject(data: ProjectData): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(toProjectFile(data)));
    return true;
  } catch (error) {
    console.error('Saving the project to localStorage failed', error);
    return false;
  }
}

const persistedChanged = (a: EditorState, b: EditorState) =>
  a.room !== b.room || a.layouts !== b.layouts || a.activeLayoutId !== b.activeLayoutId || a.settings !== b.settings;

/**
 * Saves the project shortly after it changes. Skips saving mid-drag (the gesture end
 * triggers a save) and flushes pending changes when the page is hidden or closed.
 */
export function startAutosave(store: ProjectStore): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!dirty) return;
    dirty = false;
    saveProject(selectProjectData(store.getState()));
  };

  const unsubscribe = store.subscribe((state, prev) => {
    if (persistedChanged(state, prev)) dirty = true;
    if (!dirty || state.gesture) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  });

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    flush();
    unsubscribe();
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('beforeunload', flush);
    document.removeEventListener('visibilitychange', onHide);
  };
}
