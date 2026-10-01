import type { KonvaEventObject } from 'konva/lib/Node';
import { useRef } from 'react';
import { Circle, Group, Line, Rect } from 'react-konva';
import type { Point } from '../geometry/rect';
import { type Viewport, viewToWorld, worldToView } from '../geometry/viewport';
import { pointAtLength, snapDraftPoint } from '../plan/drawing';
import { projectStore } from '../store';
import { parseNumberInput } from '../utils/parseNumber';
import { formatNumber } from '../utils/format';
import { SNAP_DISTANCE_PX } from './dragLogic';
import { finishDrawing, placeCorner } from './drawTool';
import { Pill } from './MeasurementsLayer';
import { CANVAS } from './theme';
import { type Draft, useUi } from './uiStore';

const flat = (points: readonly Point[]) => points.flatMap((p) => [p.x, p.y]);

/** Where the next corner goes: the typed length along the pointer's direction, or the pointer itself. */
function nextCorner(draft: Draft): Point | null {
  const last = draft.points[draft.points.length - 1];
  if (!draft.cursor) return null;
  if (draft.typed && last) return pointAtLength(last, draft.cursor, parseNumberInput(draft.typed)) ?? draft.cursor;
  return draft.cursor;
}

/**
 * Catches clicks over the whole canvas while drawing, so they place corners instead of
 * selecting what is underneath. Dragging still pans the view (the stage is draggable).
 */
export function DraftCapture({ vp, width, height }: { vp: Viewport; width: number; height: number }) {
  const pan = useUi((s) => s.pan);
  /** What the last click did. Konva reports any two quick clicks as a double-click, even far apart. */
  const lastClick = useRef<ReturnType<typeof placeCorner> | null>(null);

  const snapAt = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    const { pan: current, draft } = useUi.getState();
    const raw = viewToWorld({ x: pointer.x - current.x, y: pointer.y - current.y }, vp);
    const { rooms, settings } = projectStore.getState();
    const alt = 'altKey' in e.evt && e.evt.altKey;
    return snapDraftPoint(raw, draft.points, rooms, {
      threshold: SNAP_DISTANCE_PX / vp.scale,
      snap: !alt,
      grid: settings.snapToGrid ? settings.gridSize : null,
    });
  };

  const track = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const snap = snapAt(e);
    if (!snap) return;
    useUi.getState().updateDraft({ cursor: snap.point, closing: snap.closes });
    useUi.getState().setGuides(snap.guides);
  };

  const place = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button !== 0) return;
    const snap = snapAt(e);
    if (!snap) return;
    const { draft } = useUi.getState();
    // With a length typed, a click places the corner at that length.
    const target = draft.typed ? nextCorner({ ...draft, cursor: snap.point }) : snap.point;
    if (target) lastClick.current = placeCorner(target, snap.closes && !draft.typed);
  };

  // A double-click finishes the room only when both clicks hit the same spot.
  const finish = () => {
    if (lastClick.current === 'repeat' && useUi.getState().draft.points.length >= 3) finishDrawing();
  };

  const leave = () => {
    useUi.getState().updateDraft({ cursor: null, closing: false });
    useUi.getState().setGuides([]);
  };

  return (
    <Rect
      name="draft-capture"
      x={-pan.x}
      y={-pan.y}
      width={width}
      height={height}
      fill="transparent"
      onMouseMove={track}
      onTouchMove={track}
      onClick={place}
      onTap={place}
      onDblClick={finish}
      onMouseLeave={leave}
    />
  );
}

/** The room being drawn, in plan coordinates: walls placed so far, the next one, and the corners. */
export function DraftOutline({ scale }: { scale: number }) {
  const draft = useUi((s) => s.draft);
  const next = nextCorner(draft);
  const { points } = draft;
  if (points.length === 0 && !next) return null;
  const preview = next ? [...points, next] : points;
  const r = 4 / scale;
  return (
    <Group listening={false}>
      {preview.length >= 3 && <Line points={flat(preview)} closed fill={CANVAS.accent} opacity={0.07} />}
      {points.length >= 2 && <Line points={flat(points)} stroke={CANVAS.accent} strokeWidth={2} strokeScaleEnabled={false} lineJoin="round" />}
      {next && points.length > 0 && (
        <Line points={flat([points[points.length - 1], next])} stroke={CANVAS.accent} strokeWidth={2} strokeScaleEnabled={false} dash={[6 / scale, 4 / scale]} />
      )}
      {next && points.length >= 2 && !draft.closing && (
        <Line points={flat([next, points[0]])} stroke={CANVAS.accent} strokeWidth={1} strokeScaleEnabled={false} opacity={0.35} dash={[3 / scale, 4 / scale]} />
      )}
      {points.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={i === 0 && draft.closing ? r * 2 : r}
          fill={i === 0 && draft.closing ? CANVAS.accent : '#ffffff'}
          stroke={CANVAS.accent}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      ))}
      {next && !draft.closing && <Circle x={next.x} y={next.y} radius={r * 0.8} fill={CANVAS.accent} />}
    </Group>
  );
}

/** Wall lengths of the room being drawn, in screen space. */
export function DraftLabels({ vp }: { vp: Viewport }) {
  const draft = useUi((s) => s.draft);
  const next = nextCorner(draft);
  const walls: { a: Point; b: Point; text: string; current: boolean }[] = [];
  for (let i = 1; i < draft.points.length; i++) {
    const a = draft.points[i - 1];
    const b = draft.points[i];
    walls.push({ a, b, text: formatNumber(Math.hypot(b.x - a.x, b.y - a.y)), current: false });
  }
  const last = draft.points[draft.points.length - 1];
  if (last && next) {
    const length = Math.hypot(next.x - last.x, next.y - last.y);
    const text = draft.typed ? `${draft.typed} cm ↵` : draft.closing ? 'Close room' : `${formatNumber(length)} cm`;
    if (length > 0.5 || draft.typed) walls.push({ a: last, b: next, text, current: true });
  }
  return (
    <Group listening={false}>
      {walls.map((w, i) => {
        const a = worldToView(w.a, vp);
        const b = worldToView(w.b, vp);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (!w.current && len < 40) return null;
        // Beside the wall, on its left as drawn.
        const nx = len > 0 ? (b.y - a.y) / len : 0;
        const ny = len > 0 ? -(b.x - a.x) / len : -1;
        const at = { x: (a.x + b.x) / 2 + nx * 14, y: (a.y + b.y) / 2 + ny * 14 };
        return <Pill key={i} at={at} text={w.text} fill={w.current ? CANVAS.accent : CANVAS.pillDark} />;
      })}
    </Group>
  );
}
