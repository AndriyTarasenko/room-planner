import { createItemFromPreset } from '../furniture/factory';
import { findPreset } from '../furniture/presets';
import { createOpening } from '../plan/openings';
import { createRoom } from '../plan/rooms';
import type { FurnitureItem, ProjectData } from '../types';
import { createId } from '../utils/id';
import { DEFAULT_SETTINGS } from './defaults';

function place(presetId: string, x: number, y: number, overrides: Partial<FurnitureItem> = {}): FurnitureItem {
  const preset = findPreset(presetId);
  if (!preset) throw new Error(`Unknown preset ${presetId}`);
  return { ...createItemFromPreset(preset, { x, y }), ...overrides };
}

/**
 * First-launch project: a 380 × 320 cm office with a window behind a 180 cm desk against the
 * top wall, a chair, two 27″ monitors on the desk, a sideboard along the right wall and a
 * door in the bottom-left corner.
 */
export function createSampleProject(): ProjectData {
  // Desk: left edge 40 cm from the left wall, back against the top wall.
  const desk = place('desk-180', 130, 40);
  const monitorLeft = place('monitor-27', 99, 20, { name: 'Monitor left', attachedTo: desk.id });
  const monitorRight = place('monitor-27', 161, 20, { name: 'Monitor right', attachedTo: desk.id });
  const chair = place('office-chair', 130, 122.5);
  // Sideboard turned 90° against the right wall.
  const sideboard = place('sideboard', 357.5, 190, { rotation: 90 });

  const room = createRoom({
    name: 'Office',
    width: 380,
    depth: 320,
    // Walls are top, right, bottom, left. The bottom wall runs right to left, so the door
    // 20 cm from the bottom-left corner is 280 cm from its start, with the hinge at its end.
    openings: [createOpening('window', 0, 70, 120), { ...createOpening('door', 2, 280, 80), hinge: 'end' }],
  });
  const layoutId = createId('layout');
  const planId = createId('plan');
  return {
    plans: [{ id: planId, rooms: [room] }],
    layouts: [{ id: layoutId, name: 'Layout A', planId, furniture: [desk, chair, sideboard, monitorLeft, monitorRight] }],
    activeLayoutId: layoutId,
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** A project with one empty room of the given size, at the plan origin. */
export function createEmptyProject(width: number, depth: number, settings = DEFAULT_SETTINGS): ProjectData {
  const layoutId = createId('layout');
  const planId = createId('plan');
  return {
    plans: [{ id: planId, rooms: [createRoom({ name: 'Room 1', width, depth })] }],
    layouts: [{ id: layoutId, name: 'Layout A', planId, furniture: [] }],
    activeLayoutId: layoutId,
    settings: { ...settings },
  };
}
