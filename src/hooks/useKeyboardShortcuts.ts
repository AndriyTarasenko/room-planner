import { useEffect } from 'react';
import { projectStore } from '../store';

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset']);

/** True when the key press belongs to a form field the user is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

const ARROWS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
};

/**
 * Global editor shortcuts: undo/redo, delete, escape, rotate, duplicate and arrow nudging.
 * Ignored while typing in a field or when a dialog is open.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
      const s = projectStore.getState();
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

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
      if (mod && key === 'd') {
        e.preventDefault();
        if (s.selectedId) s.duplicateItem(s.selectedId);
        return;
      }
      if (mod || e.altKey) return;

      if (key === 'escape') {
        s.select(null);
        return;
      }
      const id = s.selectedId;
      if (!id) return;
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        s.deleteItem(id);
      } else if (key === 'r') {
        e.preventDefault();
        s.rotateBy(id, e.shiftKey ? -90 : 90);
      } else if (key in ARROWS) {
        e.preventDefault();
        const [dx, dy] = ARROWS[key];
        const step = e.shiftKey ? 10 : 1;
        s.nudge(id, dx * step, dy * step);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
