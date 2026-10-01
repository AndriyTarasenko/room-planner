import type { KonvaEventObject } from 'konva/lib/Node';
import { useMemo, useRef } from 'react';
import { Circle, Group, Line, Rect } from 'react-konva';
import type { Point } from '../geometry/rect';
import { type Viewport, viewToWorld, worldToView } from '../geometry/viewport';
import { type RulerSnap, rulerTargets, snapRulerPoint } from '../plan/ruler';
import { selectItems, useEditor } from '../store';
import { formatNumber } from '../utils/format';
import { SNAP_DISTANCE_PX } from './dragLogic';
import { Pill } from './MeasurementsLayer';
import { CANVAS, PILL_H, pillWidth } from './theme';
import { useUi } from './uiStore';

/** A press that moves less than this many px before the release is a click. */
const CLICK_SLOP_PX = 4;

/**
 * Catches the pointer over the whole canvas while measuring. Dragging measures from the press
 * to the release; a click places the first end and the next click the second. The middle
 * button still pans (see RoomCanvas).
 */
export function RulerCapture({ vp, width, height }: { vp: Viewport; width: number; height: number }) {
  const pan = useUi((s) => s.pan);
  const rooms = useEditor((s) => s.rooms);
  const items = useEditor(selectItems);
  const targets = useMemo(() => rulerTargets(rooms, items), [rooms, items]);
  /** Screen position of the press that started the measurement. */
  const pressedAt = useRef<Point | null>(null);

  const snapAt = (e: KonvaEventObject<PointerEvent>, anchor: Point | null): RulerSnap | null => {
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return null;
    const { pan: current } = useUi.getState();
    const raw = viewToWorld({ x: pointer.x - current.x, y: pointer.y - current.y }, vp);
    return snapRulerPoint(raw, anchor, targets, { threshold: SNAP_DISTANCE_PX / vp.scale, snap: !e.evt.altKey });
  };

  const press = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.button !== 0) return;
    const { ruler, updateRuler } = useUi.getState();
    if (ruler.phase === 'placing') {
      const hit = snapAt(e, ruler.start);
      if (hit) updateRuler({ end: hit.point, phase: 'idle', cursor: hit });
      return;
    }
    const hit = snapAt(e, null);
    if (!hit) return;
    pressedAt.current = e.target.getStage()?.getPointerPosition() ?? null;
    updateRuler({ start: hit.point, end: hit.point, phase: 'dragging', cursor: hit });
  };

  const track = (e: KonvaEventObject<PointerEvent>) => {
    const { ruler, updateRuler } = useUi.getState();
    // The button was released outside the canvas: that measurement is done.
    const phase = ruler.phase === 'dragging' && e.evt.buttons === 0 ? 'idle' : ruler.phase;
    const hit = snapAt(e, phase === 'idle' ? null : ruler.start);
    if (!hit) return;
    updateRuler(phase === 'idle' ? { phase, cursor: hit } : { end: hit.point, cursor: hit });
  };

  const release = (e: KonvaEventObject<PointerEvent>) => {
    if (e.evt.button !== 0) return;
    const { ruler, updateRuler } = useUi.getState();
    if (ruler.phase !== 'dragging') return;
    const from = pressedAt.current;
    const at = e.target.getStage()?.getPointerPosition();
    const moved = from && at ? Math.hypot(at.x - from.x, at.y - from.y) : 0;
    // After a click, the second end follows the pointer until the next click.
    updateRuler({ phase: moved < CLICK_SLOP_PX ? 'placing' : 'idle' });
  };

  return (
    <Rect
      name="ruler-capture"
      x={-pan.x}
      y={-pan.y}
      width={width}
      height={height}
      fill="transparent"
      onPointerDown={press}
      onPointerMove={track}
      onPointerUp={release}
      onPointerLeave={() => useUi.getState().updateRuler({ cursor: null })}
    />
  );
}

/** Length of one side of the right triangle under a slanted measurement, when there is room for it. */
function LegLabel({ from, to, value, show }: { from: Point; to: Point; value: number; show: boolean }) {
  const text = formatNumber(value);
  if (!show || Math.hypot(to.x - from.x, to.y - from.y) < pillWidth(text) + 12) return null;
  return <Pill at={{ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }} text={text} fill="#ffffff" textColor={CANVAS.accent} />;
}

/** The measured line with end ticks and its length; a slanted one also shows its horizontal and vertical parts. */
function Measurement({ start, end, vp }: { start: Point; end: Point; vp: Viewport }) {
  const a = worldToView(start, vp);
  const b = worldToView(end, vp);
  const value = Math.hypot(end.x - start.x, end.y - start.y);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (value < 0.05 || len < 1) return <Circle x={a.x} y={a.y} radius={2.5} fill={CANVAS.accent} />;

  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy * 6;
  const ny = ux * 6;
  const text = `${formatNumber(value)} cm`;
  const pillW = pillWidth(text);
  const extent = Math.abs(ux) > 0.5 ? pillW : PILL_H;
  // Short measurements get their length just past the second end, clear of the line.
  const label = len <= extent + 16 ? { x: b.x + ux * (extent / 2 + 10), y: b.y + uy * (extent / 2 + 10) } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const slanted = dx >= 0.5 && dy >= 0.5;
  const corner = { x: b.x, y: a.y };
  const spanX = Math.abs(b.x - a.x);
  const spanY = Math.abs(b.y - a.y);

  return (
    <Group>
      {slanted && (
        <>
          <Line points={[a.x, a.y, corner.x, corner.y, b.x, b.y]} stroke={CANVAS.accent} strokeWidth={1} dash={[4, 3]} opacity={0.5} />
          {/* Leg lengths only where they can't cover the main label. */}
          <LegLabel from={a} to={corner} value={dx} show={spanY >= 2 * PILL_H + 8} />
          <LegLabel from={corner} to={b} value={dy} show={spanX >= pillW + pillWidth(formatNumber(dy)) + 8} />
        </>
      )}
      <Line points={[a.x, a.y, b.x, b.y]} stroke={CANVAS.accent} strokeWidth={1.5} />
      <Line points={[a.x - nx, a.y - ny, a.x + nx, a.y + ny]} stroke={CANVAS.accent} strokeWidth={1.5} />
      <Line points={[b.x - nx, b.y - ny, b.x + nx, b.y + ny]} stroke={CANVAS.accent} strokeWidth={1.5} />
      <Pill at={label} text={text} fill={CANVAS.accent} />
    </Group>
  );
}

/** The Ruler's measurement and, where the pointer would snap, a marker. Drawn in screen space. */
export function RulerOverlay({ vp }: { vp: Viewport }) {
  const { start, end, cursor } = useUi((s) => s.ruler);
  const marker = cursor && cursor.kind !== 'free' ? worldToView(cursor.point, vp) : null;
  return (
    <Group listening={false}>
      {start && end && <Measurement start={start} end={end} vp={vp} />}
      {marker && (
        <Circle
          x={marker.x}
          y={marker.y}
          radius={cursor?.kind === 'point' ? 5 : 3.5}
          fill="#ffffff"
          stroke={CANVAS.accent}
          strokeWidth={cursor?.kind === 'point' ? 2 : 1.5}
        />
      )}
    </Group>
  );
}
