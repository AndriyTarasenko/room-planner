import type Konva from 'konva';
import type { Ref } from 'react';
import { Group, Transformer } from 'react-konva';
import { frameOf } from '../geometry/footprint';
import { localToWorld, rotateVector } from '../geometry/rect';
import { type Viewport, worldToView } from '../geometry/viewport';
import type { FurnitureItem } from '../types';
import { formatNumber } from '../utils/format';
import { Pill } from './MeasurementsLayer';
import { CANVAS, PILL_H, pillWidth } from './theme';

const RESIZE_ANCHORS = ['middle-left', 'middle-right', 'top-center', 'bottom-center'];

/**
 * Handle sizes in px, bigger for a finger than for a mouse: the resize anchors, the diameter of
 * the round rotate handle, and the distance from the item's top edge to its center.
 */
const HANDLES = {
  mouse: { anchor: 8, rotate: 18, rotateOffset: 30 },
  touch: { anchor: 14, rotate: 28, rotateOffset: 40 },
};

/** Lucide's rotate-cw icon (24 × 24 units), drawn inside the rotate handle and used as its cursor. */
const ROTATE_ICON = ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'];
/** The arrow's size relative to the disc. */
const ICON_SCALE = 0.6;

// A dark arrow with a white halo, so the cursor shows on the floor and on walls alike.
const cursorSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-2 -2 28 28" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
  ROTATE_ICON.map((d) => `<path d="${d}" stroke="#fff" stroke-width="5"/>`).join('') +
  ROTATE_ICON.map((d) => `<path d="${d}" stroke="#1d1f23" stroke-width="2"/>`).join('') +
  '</svg>';
const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(cursorSvg)}") 12 12, grab`;

let iconPaths: Path2D[] | null = null;

/** A white disc with the rotate arrow, so the handle reads as "turn", not as another resize anchor. */
function drawRotateHandle(ctx: Konva.Context, shape: Konva.Shape) {
  const r = shape.width() / 2;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);

  iconPaths ??= ROTATE_ICON.map((d) => new Path2D(d));
  const s = (shape.width() * ICON_SCALE) / 24;
  const native = ctx._context;
  native.save();
  native.shadowColor = 'transparent';
  native.translate(r - 12 * s, r - 12 * s);
  native.scale(s, s);
  native.strokeStyle = CANVAS.accent;
  native.lineWidth = 1.4 / s;
  native.lineCap = 'round';
  native.lineJoin = 'round';
  for (const path of iconPaths) native.stroke(path);
  native.restore();
}

/** The handle's hit area: its disc and a little margin. */
function hitRotateHandle(ctx: Konva.Context, shape: Konva.Shape) {
  const r = shape.width() / 2;
  ctx.beginPath();
  ctx.arc(r, r, r + 3, 0, Math.PI * 2, false);
  ctx.closePath();
  ctx.fillStrokeShape(shape);
}

/** Runs on every transformer update, after Konva has reset the anchors to their defaults. */
const styleAnchor = (size: number) => (anchor: Konva.Rect) => {
  if (!anchor.hasName('rotater')) return;
  anchor.setAttrs({
    width: size,
    height: size,
    offsetX: size / 2,
    offsetY: size / 2,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowBlur: 3,
    shadowOffsetY: 1,
  });
  anchor.sceneFunc(drawRotateHandle);
  anchor.hitFunc(hitRotateHandle);
};
const STYLE_ANCHOR = { mouse: styleAnchor(HANDLES.mouse.rotate), touch: styleAnchor(HANDLES.touch.rotate) };

/**
 * Selection box of the selected furniture: edge handles resize it, the round handle above it
 * turns it freely. FurnitureNode turns the gestures into item geometry (and snaps rotations).
 */
export function ItemTransformer({ ref, resizable, touch }: { ref: Ref<Konva.Transformer>; resizable: boolean; touch: boolean }) {
  const sizes = touch ? HANDLES.touch : HANDLES.mouse;
  return (
    <Transformer
      ref={ref}
      rotateEnabled
      enabledAnchors={resizable ? RESIZE_ANCHORS : []}
      rotateAnchorOffset={sizes.rotateOffset}
      rotateAnchorCursor={ROTATE_CURSOR}
      anchorStyleFunc={touch ? STYLE_ANCHOR.touch : STYLE_ANCHOR.mouse}
      keepRatio={false}
      flipEnabled={false}
      ignoreStroke
      anchorSize={sizes.anchor}
      anchorCornerRadius={2}
      anchorStroke={CANVAS.accent}
      anchorFill="#ffffff"
      borderStroke={CANVAS.accent}
      borderStrokeWidth={1}
      padding={0}
      boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 6 || Math.abs(newBox.height) < 6 ? oldBox : newBox)}
    />
  );
}

/** The angle of an item being turned with the rotate handle, shown just beyond the handle. */
export function RotationReadout({ item, vp, touch }: { item: FurnitureItem; vp: Viewport; touch: boolean }) {
  const sizes = touch ? HANDLES.touch : HANDLES.mouse;
  const text = `${formatNumber(item.rotation)}°`;
  const edge = worldToView(localToWorld({ x: 0, y: -item.depth / 2 }, frameOf(item)), vp);
  const up = rotateVector({ x: 0, y: -1 }, item.rotation);
  // Far enough out that the pill clears the handle whichever way the item faces.
  const distance = sizes.rotateOffset + sizes.rotate / 2 + 8 + (Math.abs(up.x) * pillWidth(text)) / 2 + (Math.abs(up.y) * PILL_H) / 2;
  return (
    <Group listening={false}>
      <Pill at={{ x: edge.x + up.x * distance, y: edge.y + up.y * distance }} text={text} fill={CANVAS.accent} />
    </Group>
  );
}
