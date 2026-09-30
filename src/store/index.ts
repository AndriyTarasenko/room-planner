import { useStore } from 'zustand';
import { loadStoredProject, saveProject, startAutosave } from './persistence';
import { type EditorState, createProjectStore } from './projectStore';
import { createSampleProject } from './sampleProject';

function initialProject() {
  const stored = loadStoredProject();
  if (stored) return stored;
  // First launch: save the sample right away so ids stay stable across reloads.
  const sample = createSampleProject();
  saveProject(sample);
  return sample;
}

/** The application's single store: the saved project, or the sample room on first launch. */
export const projectStore = createProjectStore(initialProject());

startAutosave(projectStore);

// Handy for debugging and browser automation during development.
if (import.meta.env.DEV) (window as unknown as { __roomPlanner: typeof projectStore }).__roomPlanner = projectStore;

export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(projectStore, selector);
}

export * from './projectStore';
