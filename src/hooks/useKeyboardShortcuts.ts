import { useEffect } from 'react';
import { deleteRoom } from '../components/projectActions';
import { useShortcutsPanel } from '../components/shortcutsStore';
import { commitDraft, isDrawing, stopDrawing, typeLength, undoCorner } from '../editor/drawTool';
import { clearMeasurement, isMeasuring, stopMeasuring, toggleMeasuring } from '../editor/rulerTool';
import { useUi } from '../editor/uiStore';
import { ROTATION_STEP, stepRotation } from '../geometry/rotation';
import { roomBounds } from '../plan/shape';
import { wallFrame } from '../plan/walls';
import { projectStore, selectSelectedItem, selectSelectedOpening, selectSelectedOpeningRoom, selectSelectedRoom } from '../store';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset']);

/** True when the key press belongs to a form field the user is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

/**
 * Keys while drawing walls: Enter places a typed length or closes the room, Backspace (or
 * Ctrl+Z) takes back the last corner, Escape stops drawing, digits type a wall length.
 * Returns false for keys that keep their usual meaning.
 */
function handleDrawingKey(e: KeyboardEvent, key: string, mod: boolean): boolean {
  if (mod) return key === 'z' && !e.shiftKey && undoCorner();
  if (e.altKey) return false;
  if (key === 'escape') {
    const { draft, updateDraft } = useUi.getState();
    if (draft.typed) updateDraft({ typed: '' });
    else stopDrawing();
    return true;
  }
  if (key === 'enter') {
    commitDraft();
    return true;
  }
  if (key === 'backspace' || key === 'delete') {
    undoCorner();
    return true;
  }
  if (/^[\d.,+\-*/]$/.test(e.key)) {
    typeLength(e.key);
    return true;
  }
  return false;
}

/** Keys while measuring: Escape takes the measurement away, then stops measuring; Delete takes it away. */
function handleMeasuringKey(key: string): boolean {
  if (key === 'escape') {
    if (!clearMeasurement()) stopMeasuring();
    return true;
  }
  return (key === 'delete' || key === 'backspace') && clearMeasurement();
}

/** [ and ] by key position, so they work on any keyboard layout (and with Shift held). */
const ROTATE_KEYS: Record<string, 1 | -1> = { BracketLeft: -1, BracketRight: 1 };

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};

/**
 * Global editor shortcuts: undo/redo, delete, escape, rotate (R by 90°, [ and ] by 15°, with Shift by 1°),
 * duplicate, arrow nudging, M for the Ruler and ? for the shortcuts panel.
 * Delete and the arrows also work on a selected room (which takes its furniture along) and
 * on a door or window (which slides along its wall). Ignored while typing in a field or when
 * a dialog is open.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
      const s = projectStore.getState();
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (isDrawing() && handleDrawingKey(e, key, mod)) {
        e.preventDefault();
        return;
      }

      if (mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
        return;
      }
      if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        s.redo();
        return;
      }
      const item = selectSelectedItem(s);
      if (mod && key === 'd') {
        e.preventDefault();
        if (item) s.duplicateItem(item.id);
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        useShortcutsPanel.getState().toggle();
        return;
      }
      if (isMeasuring() && handleMeasuringKey(key)) {
        e.preventDefault();
        return;
      }
      if (key === 'm' && !isDrawing()) {
        e.preventDefault();
        toggleMeasuring();
        return;
      }

      if (key === 'escape') {
        s.select(null);
        return;
      }
      const room = selectSelectedRoom(s);
      const opening = selectSelectedOpening(s);
      if (key === 'delete' || key === 'backspace') {
        if (item) s.deleteItem(item.id);
        else if (room) deleteRoom(room.id);
        else if (opening) s.deleteOpening(opening.id);
        else return;
        e.preventDefault();
      } else if (key === 'r') {
        if (!item) return;
        e.preventDefault();
        s.rotateBy(item.id, e.shiftKey ? -90 : 90);
      } else if (e.code in ROTATE_KEYS) {
        if (!item) return;
        e.preventDefault();
        const rotation = stepRotation(item.rotation, ROTATE_KEYS[e.code], e.shiftKey ? 1 : ROTATION_STEP);
        // Quick presses in a row are one undo step.
        s.setGeometry(item.id, { rotation }, { coalesceKey: `rotate:${item.id}` });
      } else if (key in ARROWS) {
        const [dx, dy] = ARROWS[key];
        const step = e.shiftKey ? 10 : 1;
        if (item) {
          s.nudge(item.id, dx * step, dy * step);
        } else if (room) {
          const b = roomBounds(room);
          s.setRoomGeometry(room.id, { x: b.minX + dx * step, y: b.minY + dy * step }, { carry: true, coalesceKey: `nudge:${room.id}` });
        } else if (opening) {
          // Openings slide along their wall, with the arrows that point along it.
          const host = selectSelectedOpeningRoom(s);
          if (!host) return;
          const along = wallFrame(host, opening.wall).along;
          const projected = dx * along.x + dy * along.y;
          if (Math.abs(projected) < 0.3) return;
          s.updateOpening(opening.id, { offset: opening.offset + Math.sign(projected) * step }, { coalesceKey: `nudge:${opening.id}` });
        } else {
          return;
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
