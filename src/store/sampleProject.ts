import { createItemFromPreset } from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import type { FurnitureItem, ProjectData } from '../types';
import { createId } from '../utils/id';
import { DEFAULT_SETTINGS } from './defaults';

function place(presetId: string, x: number, y: number, overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  const preset = findPreset(presetId);
  if (!preset) throw new Error(`Unknown preset ${presetId}`);
  return { ...createItemFromPreset(preset, { x, y }), ...overrides };
}

/**
 * First-launch project: a 380 × 320 cm room with a 180 cm desk against the top wall,
 * a chair, two 27″ monitors on the desk and a sideboard along the right wall.
 */
export function createSampleProject(): ProjectData {
  // Desk: left edge 40 cm from the left wall, back against the top wall.
  const desk = place('desk-180', 130, 40);
  const monitorLeft = place('monitor-27', 99, 20, { name: 'Monitor left', attachedTo: desk.id });
  const monitorRight = place('monitor-27', 161, 20, { name: 'Monitor right', attachedTo: desk.id });
  const chair = place('office-chair', 130, 122.5);
  // Sideboard turned 90° against the right wall.
  const sideboard = place('sideboard', 357.5, 190, { rotation: 90 });

  const layoutId = createId('layout');
  return {
    room: { id: createId('room'), width: 380, depth: 320 },
    layouts: [{ id: layoutId, name: 'Layout A', furniture: [desk, chair, sideboard, monitorLeft, monitorRight] }],
    activeLayoutId: layoutId,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createEmptyProject(width: number, depth: number, settings = DEFAULT_SETTINGS): ProjectData {
  const layoutId = createId('layout');
  return {
    room: { id: createId('room'), width, depth },
    layouts: [{ id: layoutId, name: 'Layout A', furniture: [] }],
    activeLayoutId: layoutId,
    settings: { ...settings },
  };
}
