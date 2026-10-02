import { itemIdsInRoom } from '../plan/rooms';
import { projectStore, selectActiveLayout, selectProjectData, selectRooms } from '../store';
import { ProjectFileError, parseProjectJson, serializeProject } from '../store/serialization';
import { downloadText, pickTextFile, timestampForFilename } from '../utils/files';
import { toast } from './ui/toastStore';

/** Deletes a room with its furniture (in every layout on its floor plan) and says what went with it. */
export function deleteRoom(roomId: string) {
  const s = projectStore.getState();
  const rooms = selectRooms(s);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;
  if (rooms.length <= 1) {
    toast('The plan needs at least one room.', 'error');
    return;
  }
  const { planId } = selectActiveLayout(s);
  const objects = s.layouts.filter((l) => l.planId === planId).reduce((sum, l) => sum + itemIdsInRoom(l.furniture, room).size, 0);
  s.deleteRoom(roomId);
  const withObjects = objects > 0 ? ` and ${objects} object${objects === 1 ? '' : 's'} in it` : '';
  toast(`Deleted “${room.name}”${withObjects}. Press Ctrl+Z to restore.`);
}

/** "Layout A", "Layout A and Layout C", "Layout A and 2 other layouts". */
export function layoutNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} other layouts`;
}

/** Gives a layout its own copy of the floor plan it shares, and says so. */
export function unlinkLayoutPlan(layoutId: string) {
  const s = projectStore.getState();
  const layout = s.layouts.find((l) => l.id === layoutId);
  const others = s.layouts.filter((l) => l.id !== layoutId && l.planId === layout?.planId);
  if (!layout || others.length === 0) return;
  s.unlinkPlan(layoutId);
  toast(`“${layout.name}” now has its own floor plan. Changes to it no longer show in ${layoutNames(others.map((l) => l.name))}.`);
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
