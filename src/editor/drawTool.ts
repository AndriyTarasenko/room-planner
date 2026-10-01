/**
 * The "Draw walls" tool: click to place the corners of a new room, one wall at a time. Typing
 * a number sets the exact length of the next wall; Enter or a click on the first corner
 * closes the room.
 */
import { toast } from '../components/ui/toastStore';
import type { Point } from '../geometry/rect';
import { pointAtLength } from '../plan/drawing';
import { projectStore } from '../store';
import { parseNumberInput } from '../utils/parseNumber';
import { useUi } from './uiStore';

export const isDrawing = () => useUi.getState().tool === 'draw';

export function startDrawing() {
  projectStore.getState().select(null);
  useUi.getState().setTool('draw');
}

export const stopDrawing = () => useUi.getState().setTool('select');

/** Adds the room drawn so far. Returns false (and says why) when it can't be a room yet. */
export function finishDrawing(): boolean {
  const { points } = useUi.getState().draft;
  if (points.length < 3) {
    toast('A room needs at least three corners.', 'error');
    return false;
  }
  const id = projectStore.getState().addDrawnRoom(points);
  if (!id) {
    toast('These walls cross each other or enclose too little floor. Move the last corner, or press Backspace to remove it.', 'error');
    return false;
  }
  stopDrawing();
  return true;
}

/**
 * Places a corner, or closes the room when `closes` is set. A click on the corner just
 * placed adds nothing and returns `repeat`: that is the second half of a double-click.
 */
export function placeCorner(p: Point, closes = false): 'added' | 'repeat' | 'closed' {
  const { draft, updateDraft } = useUi.getState();
  if (closes) {
    finishDrawing();
    return 'closed';
  }
  const last = draft.points[draft.points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.5) return 'repeat';
  updateDraft({ points: [...draft.points, p], typed: '' });
  return 'added';
}

/** Removes the last corner (or the last typed digit). Returns false when there was nothing to remove. */
export function undoCorner(): boolean {
  const { draft, updateDraft } = useUi.getState();
  if (draft.typed) {
    updateDraft({ typed: draft.typed.slice(0, -1) });
    return true;
  }
  if (draft.points.length === 0) return false;
  updateDraft({ points: draft.points.slice(0, -1) });
  return true;
}

/** Collects a typed length ("250", "120+30"). */
export function typeLength(key: string) {
  const { draft, updateDraft } = useUi.getState();
  if (draft.points.length === 0 || draft.typed.length >= 12) return;
  updateDraft({ typed: draft.typed + (key === ',' ? '.' : key) });
}

/**
 * Enter: with a typed length, places the next corner that far along the direction the
 * pointer shows; otherwise closes the room.
 */
export function commitDraft() {
  const { draft, updateDraft } = useUi.getState();
  if (!draft.typed) {
    finishDrawing();
    return;
  }
  const length = parseNumberInput(draft.typed);
  const last = draft.points[draft.points.length - 1];
  const next = last && draft.cursor ? pointAtLength(last, draft.cursor, length) : null;
  if (!next) {
    toast('Point where the wall should go, then type its length.', 'error');
    updateDraft({ typed: '' });
    return;
  }
  updateDraft({ points: [...draft.points, next], typed: '' });
}
