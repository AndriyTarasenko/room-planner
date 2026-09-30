import { projectStore, selectProjectData } from '../store';
import { ProjectFileError, parseProjectJson, serializeProject } from '../store/serialization';
import { downloadText, pickTextFile, timestampForFilename } from '../utils/files';
import { toast } from './ui/toastStore';

export function exportProject() {
  const data = selectProjectData(projectStore.getState());
  downloadText(`room-plan-${timestampForFilename()}.json`, serializeProject(data));
  toast(`Exported ${data.layouts.length} layout${data.layouts.length === 1 ? '' : 's'}`);
}

export async function importProject() {
  const file = await pickTextFile('.json,application/json');
  if (!file) return;
  try {
    const data = parseProjectJson(file.text);
    projectStore.getState().loadProject(data);
    toast(`Imported “${file.name}”. Press Ctrl+Z to go back.`);
  } catch (error) {
    const message = error instanceof ProjectFileError ? error.message : 'The file could not be read.';
    toast(`Import failed: ${message}`, 'error');
  }
}
