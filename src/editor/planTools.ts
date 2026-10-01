import type { DragEvent } from 'react';
import type { Point } from '../geometry/rect';
import { projectStore } from '../store';
import { OPENING_KINDS, type OpeningKind } from '../types';
import { useUi } from './uiStore';

/** Things the "Floor plan" tools add: a room, or an opening in a wall. */
export type PlanTool = 'room' | OpeningKind;

/** Drag type of the floor plan tools, checked by the canvas before accepting a drop. */
export const PLAN_DRAG_TYPE = 'application/x-room-planner-plan';

export function startPlanDrag(e: DragEvent, tool: PlanTool) {
  e.dataTransfer.setData(PLAN_DRAG_TYPE, tool);
  e.dataTransfer.effectAllowed = 'copy';
}

export function droppedPlanTool(data: DataTransfer): PlanTool | null {
  const tool = data.getData(PLAN_DRAG_TYPE);
  return tool === 'room' || (OPENING_KINDS as readonly string[]).includes(tool) ? (tool as PlanTool) : null;
}

/**
 * Adds a room, door, window or passage. Dropped on the canvas it goes where it was dropped
 * (openings onto the nearest wall); clicked, a room docks to the right of the plan and an
 * opening goes into a free stretch of wall in the current room.
 */
export function addPlanElement(tool: PlanTool, at?: Point): string | null {
  const s = projectStore.getState();
  if (tool === 'room') {
    const id = s.addRoom({ at });
    // A clicked room appears next to the plan, possibly off screen.
    if (!at) useUi.getState().resetView();
    return id;
  }
  return s.addOpening(tool, { at });
}
