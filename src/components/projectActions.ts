import { itemIdsInRoom } from '../plan/rooms';
import { projectStore, selectProjectData } from '../store';
import { ProjectFileError, parseProjectJson, serializeProject } from '../store/serialization';
import { downloadText, pickTextFile, timestampForFilename } from '../utils/files';
import { toast } from './ui/toastStore';

/** Deletes a room with its furniture (in every layout) and says what went with it. */
export function deleteRoom(roomId: string) {
  const s = projectStore.getState();
  const room = s.rooms.find((r) => r.id === roomId);
  if (!room) return;
  if (s.rooms.length <= 1) {
    toast('The plan needs at least one room.', 'error');
    return;
  }
  const objects = s.layouts.reduce((sum, l) => sum + itemIdsInRoom(l.furniture, room).size, 0);
  s.deleteRoom(roomId);
  const withObjects = objects > 0 ? ` and ${objects} object${objects === 1 ? '' : 's'} in it` : '';
  toast(`Deleted “${room.name}”${withObjects}. Press Ctrl+Z to restore.`);
}

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
