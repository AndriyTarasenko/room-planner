import Konva from 'konva';
import { type RefObject, useEffect } from 'react';
import type { Point } from '../geometry/rect';
import { type Pinch, type Viewport, centeredViewport, pinchView, stageTransformFor } from '../geometry/viewport';
import { canvasPadding } from './theme';
import { useUi } from './uiStore';

const NATIVE_TOUCH_EVENTS = ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const;

function pinchOf(pointers: Map<number, Point>): Pinch | null {
  const [a, b] = pointers.values();
  if (!a || !b) return null;
  return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

/**
 * Two fingers on the canvas pinch to zoom and move together to pan. From the moment the second
 * finger lands until the last one lifts, Konva sees none of the gesture, so nothing under the
 * fingers is dragged, tapped, drawn or measured. A pan, drag or measurement the first finger
 * already started gives way to the pinch.
 *
 * While the fingers move, the stage itself is scaled and moved, so the plan isn't rendered
 * again for every step; the view is saved (and the plan redrawn for it) when a finger lifts.
 */
export function usePinchZoom(containerRef: RefObject<HTMLElement | null>, stageRef: RefObject<Konva.Stage | null>) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    /** Fingers on the canvas, in canvas px. */
    const pointers = new Map<number, Point>();
    let pinching = false;
    let last: Pinch | null = null;
    /** The view the fingers have moved to, and the viewport the plan is still drawn for. */
    let preview: { zoom: number; pan: Point; drawn: Viewport } | null = null;

    const local = (e: PointerEvent): Point => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const begin = () => {
      pinching = true;
      last = pinchOf(pointers);
      const stage = stageRef.current;
      if (stage) {
        for (const tr of stage.find<Konva.Transformer>('Transformer')) if (tr.isTransforming()) tr.stopTransform();
        for (const node of stage.find((n: Konva.Node) => n.isDragging())) node.stopDrag();
        if (stage.isDragging()) stage.stopDrag();
      }
      const { ruler, updateRuler } = useUi.getState();
      if (ruler.phase === 'dragging') updateRuler({ start: null, end: null, phase: 'idle' });
    };

    const zoomTo = (next: Pinch) => {
      const from = last;
      last = next;
      const { zoom, pan, fitBox, liveBox } = useUi.getState();
      const box = fitBox ?? liveBox;
      const stage = stageRef.current;
      if (!from || !box || !stage) return;
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const fit = (z: number) => centeredViewport(box, width, height, canvasPadding(width, height), z);
      preview ??= { zoom, pan, drawn: fit(zoom) };
      const view = pinchView(from, next, preview.zoom, preview.pan, fit);
      preview = { ...preview, ...view };
      const t = stageTransformFor(preview.drawn, fit(view.zoom), view.pan);
      stage.scale({ x: t.scale, y: t.scale });
      stage.position({ x: t.x, y: t.y });
      stage.batchDraw();
    };

    /** Saves the previewed view; the plan is then drawn for it at its true scale. */
    const commit = () => {
      if (!preview) return;
      const { zoom, pan } = preview;
      preview = null;
      const stage = stageRef.current;
      if (stage) {
        stage.scale({ x: 1, y: 1 });
        stage.position(pan);
        stage.batchDraw();
      }
      useUi.getState().setView(zoom, pan);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.set(e.pointerId, local(e));
      if (!pinching && pointers.size === 2) begin();
      if (pinching) e.stopPropagation();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      if (!pinching) return;
      e.stopPropagation();
      const next = pinchOf(pointers);
      if (next) zoomTo(next);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.delete(e.pointerId);
      if (!pinching) return;
      e.stopPropagation();
      commit();
      // With one finger left the view holds still; a second finger pinches again.
      last = pinchOf(pointers);
    };
    // Touch events come after their pointer events. The pinch ends with the last finger's
    // touchend, which Konva must not see either (it would be a tap).
    const touch = (e: TouchEvent) => {
      if (!pinching) return;
      e.stopPropagation();
      if (e.touches.length === 0) {
        commit();
        pinching = false;
      }
    };

    // Capture on the container runs before Konva's listeners on its canvas and on the window.
    el.addEventListener('pointerdown', down, true);
    el.addEventListener('pointermove', move, true);
    el.addEventListener('pointerup', up, true);
    el.addEventListener('pointercancel', up, true);
    for (const type of NATIVE_TOUCH_EVENTS) el.addEventListener(type, touch, true);
    return () => {
      commit();
      el.removeEventListener('pointerdown', down, true);
      el.removeEventListener('pointermove', move, true);
      el.removeEventListener('pointerup', up, true);
      el.removeEventListener('pointercancel', up, true);
      for (const type of NATIVE_TOUCH_EVENTS) el.removeEventListener(type, touch, true);
    };
  }, [containerRef, stageRef]);
}
