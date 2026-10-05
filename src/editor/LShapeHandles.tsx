import type { KonvaEventObject } from 'konva/lib/Node';
import { useRef, useState } from 'react';
import { Group, Rect } from 'react-konva';
import { frameOf } from '../geometry/footprint';
import { type LHandle, type LItem, L_HANDLES, dragLHandle, lHandleSpot, lHandleValue } from '../geometry/lShape';
import { localToWorld, rotateVector, worldToLocal } from '../geometry/rect';
import { projectStore, selectItems } from '../store';
import { ITEM_LIMITS } from '../store/defaults';
import { formatNumber } from '../utils/format';
import { Pill } from './MeasurementsLayer';
import { CANVAS, pillWidth } from './theme';

interface Props {
  item: LItem & { id: string };
  /** Pixels per cm. */
  scale: number;
  /** Bigger handles for a finger. */
  touch: boolean;
}

function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

/** Resize cursor for an edge that moves along a direction at `angle` degrees on screen. */
function resizeCursor(angle: number): string {
  const a = ((angle % 180) + 180) % 180;
  if (a < 22.5 || a >= 157.5) return 'ew-resize';
  if (a < 67.5) return 'nwse-resize';
  if (a < 112.5) return 'ns-resize';
  return 'nesw-resize';
}

const currentItem = (id: string) => selectItems(projectStore.getState()).find((i) => i.id === id);

/**
 * Handles for the selected L-shaped item, one on each arm's end and one on each arm's inner
 * edge, so both parts of the L can be sized separately (the transformer only offers the
 * bounding box). Sizes are whole centimeters; the dragged value is shown next to the handle.
 */
export function LShapeHandles({ item, scale, touch }: Props) {
  const px = (v: number) => v / scale;
  const [drag, setDrag] = useState<LHandle | null>(null);
  /** The item as it was when the drag began: handle positions are measured in its frame. */
  const start = useRef<LItem | null>(null);

  const begin = (handle: LHandle) => () => {
    const current = currentItem(item.id);
    if (current?.shape.kind !== 'l') return;
    start.current = { ...current, shape: current.shape };
    setDrag(handle);
    projectStore.getState().beginGesture();
  };

  const move = (handle: LHandle) => (e: KonvaEventObject<DragEvent>) => {
    const base = start.current;
    if (!base) return;
    const node = e.target;
    const next = dragLHandle(base, handle, worldToLocal(node.position(), frameOf(base)), ITEM_LIMITS.max);
    projectStore.getState().reshapeItem(item.id, next);
    // Keep the handle on its edge: it only moves along one axis, and stops where the arm does.
    node.position(localToWorld(lHandleSpot(next, handle).at, frameOf(next)));
  };

  const end = () => {
    start.current = null;
    setDrag(null);
    const s = projectStore.getState();
    // Back inside the room if the drag pushed the item through a wall, as after any resize.
    s.setGeometry(item.id, {});
    s.endGesture();
  };

  const w = px(touch ? 32 : 26);
  const h = px(touch ? 12 : 8);
  const frame = frameOf(item);

  return (
    <Group>
      {L_HANDLES.map((handle) => {
        if (drag && drag !== handle) return null;
        const spot = lHandleSpot(item, handle);
        // Edges too short to grab on screen get no handle (the inspector still sizes them).
        if (!drag && spot.length * scale < 20) return null;
        const at = localToWorld(spot.at, frame);
        // The pill lies along the edge, which runs across the axis the edge moves on.
        const along = item.rotation + (spot.axis === 'x' ? 90 : 0);
        const length = Math.max(px(6), Math.min(w, px(spot.length * scale - 8)));
        return (
          <Rect
            key={handle}
            name="l-shape-handle"
            x={at.x}
            y={at.y}
            rotation={along}
            offsetX={length / 2}
            offsetY={h / 2}
            width={length}
            height={h}
            cornerRadius={px(3)}
            fill="#ffffff"
            stroke={CANVAS.accent}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            hitStrokeWidth={touch ? 24 : 12}
            draggable
            onDragStart={begin(handle)}
            onDragMove={move(handle)}
            onDragEnd={end}
            onMouseEnter={(e) => setCursor(e, resizeCursor(along + 90))}
            onMouseLeave={(e) => setCursor(e, '')}
          />
        );
      })}
      {drag && <ValuePill item={item} handle={drag} scale={scale} />}
    </Group>
  );
}

/** The size being dragged, just outside the moving edge, at a constant screen size. */
function ValuePill({ item, handle, scale }: { item: LItem; handle: LHandle; scale: number }) {
  const spot = lHandleSpot(item, handle);
  const at = localToWorld(spot.at, frameOf(item));
  const text = `${formatNumber(lHandleValue(item, handle))} cm`;
  const dir = rotateVector(spot.outward, item.rotation);
  // Far enough out that the pill clears the handle whichever way the edge faces.
  const distance = 14 + (Math.abs(dir.x) * pillWidth(text)) / 2 + Math.abs(dir.y) * 10;
  return (
    <Group x={at.x} y={at.y} scaleX={1 / scale} scaleY={1 / scale} listening={false}>
      <Pill at={{ x: dir.x * distance, y: dir.y * distance }} text={text} fill={CANVAS.accent} />
    </Group>
  );
}
