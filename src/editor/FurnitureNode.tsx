import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { memo, useRef } from 'react';
import { Ellipse, Group, Line, Rect } from 'react-konva';
import { isCircle, localOutline } from '../geometry/footprint';
import { localToWorld } from '../geometry/rect';
import { ROTATION_STEP, rotationSnapAngles, snapRotation } from '../geometry/rotation';
import { roomAt } from '../plan/rooms';
import { projectStore, selectItems, selectRooms } from '../store';
import { ITEM_LIMITS } from '../store/defaults';
import type { FurnitureItem } from '../types';
import { shade } from '../utils/color';
import { FurnitureDetails } from './FurnitureDetails';
import { resolveDragPosition } from './dragLogic';
import { CANVAS } from './theme';
import { useUi } from './uiStore';

interface Props {
  item: FurnitureItem;
  /** Pixels per cm. */
  scale: number;
  selected: boolean;
  colliding: boolean;
  outside: boolean;
}

const currentItem = (id: string) => selectItems(projectStore.getState()).find((i) => i.id === id);

function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

const transformerOf = (e: KonvaEventObject<Event>) => e.currentTarget.getStage()?.findOne<Konva.Transformer>('Transformer');

function cornerRadius(item: FurnitureItem): number {
  switch (item.type) {
    case 'office-chair':
      return Math.min(item.width, item.depth) * 0.3;
    case 'monitor':
    case 'console':
      return 1;
    default:
      return Math.min(2, item.width / 4, item.depth / 4);
  }
}

/** A single piece of furniture: draggable, selectable, and transformable when selected. */
export const FurnitureNode = memo(function FurnitureNode({ item, scale, selected, colliding, outside }: Props) {
  const hovered = useUi((s) => s.hoveredId === item.id);
  /** A circle being resized stays a circle; decided when the gesture starts. */
  const resizingCircle = useRef(false);
  /** Angles the rotate handle sticks to: diagonals and the walls of the item's room. */
  const snapAngles = useRef<number[]>([]);

  const baseStroke = shade(item.color, 0.38);
  const stroke = colliding ? CANVAS.danger : selected ? CANVAS.accent : hovered ? shade(item.color, 0.6) : baseStroke;
  const strokeWidth = selected || colliding ? 1.5 : 1;
  const bodyProps = {
    fill: item.color,
    stroke,
    strokeWidth,
    strokeScaleEnabled: false,
    dash: outside ? [5, 3] : undefined,
    shadowColor: '#000',
    shadowOpacity: item.placement === 'surface' ? 0.18 : 0.08,
    shadowBlur: 3 / scale,
    shadowOffsetY: 1 / scale,
    shadowForStrokeEnabled: false,
  };

  const select = () => projectStore.getState().select(item.id);

  const handleDragStart = () => {
    const s = projectStore.getState();
    s.select(item.id);
    s.beginGesture();
    useUi.getState().setDragging(item.id);
  };

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const s = projectStore.getState();
    const current = currentItem(item.id);
    if (!current) return;
    const result = resolveDragPosition(current, node.position(), {
      rooms: selectRooms(s),
      items: selectItems(s),
      settings: s.settings,
      scale,
      bypassSnapping: e.evt.altKey,
    });
    node.position({ x: result.x, y: result.y });
    s.setGeometry(item.id, { x: result.x, y: result.y });
    useUi.getState().setGuides(result.guides);
  };

  const handleDragEnd = () => {
    projectStore.getState().endGesture(item.id);
    useUi.getState().setGuides([]);
    useUi.getState().setDragging(null);
  };

  const handleTransformStart = (e: KonvaEventObject<Event>) => {
    const s = projectStore.getState();
    s.select(item.id);
    s.beginGesture();
    const current = currentItem(item.id);
    resizingCircle.current = current !== undefined && isCircle(current);
    if (current && transformerOf(e)?.getActiveAnchor() === 'rotater') {
      snapAngles.current = rotationSnapAngles(roomAt(current, selectRooms(s)).corners);
      useUi.getState().setRotating(item.id);
    }
  };

  /**
   * Konva scales the node while resizing. We turn that scale into real width/depth right
   * away (rounded to whole cm, keeping the opposite edge fixed) and reset the scale, so
   * labels, details and measurements always show true dimensions.
   */
  const handleTransform = (e: KonvaEventObject<Event>) => {
    const node = e.currentTarget as Konva.Group;
    const current = currentItem(item.id);
    if (!current) return;
    const transformer = transformerOf(e);
    const anchor = transformer?.getActiveAnchor();
    const s = projectStore.getState();

    if (anchor === 'rotater') {
      // Free in whole degrees, sticking to diagonals and walls; Shift: 15° steps; Alt: no sticking.
      const keys = e.evt as Partial<MouseEvent> | undefined;
      const rotation = snapRotation(
        node.rotation(),
        keys?.shiftKey ? { step: ROTATION_STEP } : { targets: keys?.altKey ? [] : snapAngles.current },
      );
      node.rotation(rotation);
      // Konva measures the next pointer move from the box's angle, which it set to the raw one
      // and won't re-read from the node mid-gesture. Without this, small moves inside a snap
      // would keep getting pulled back, and the box would drift off the item.
      transformer?.rotation(rotation);
      node.position({ x: current.x, y: current.y });
      s.setGeometry(item.id, { rotation }, { clamp: false });
      return;
    }

    const clampSize = (v: number) => Math.min(ITEM_LIMITS.max, Math.max(ITEM_LIMITS.min, Math.round(v)));
    let width = clampSize(current.width * node.scaleX());
    let depth = clampSize(current.depth * node.scaleY());
    node.scale({ x: 1, y: 1 });
    if (resizingCircle.current) {
      // Either handle sets the diameter; the circle grows evenly on the other axis.
      const diameter = anchor === 'middle-left' || anchor === 'middle-right' ? width : depth;
      width = diameter;
      depth = diameter;
    }

    // Local-frame shift of the center that keeps the edge opposite the dragged anchor fixed.
    let lx = 0;
    let ly = 0;
    if (anchor === 'middle-left') lx = (current.width - width) / 2;
    if (anchor === 'middle-right') lx = (width - current.width) / 2;
    if (anchor === 'top-center') ly = (current.depth - depth) / 2;
    if (anchor === 'bottom-center') ly = (depth - current.depth) / 2;
    const center = localToWorld({ x: lx, y: ly }, { x: current.x, y: current.y, rotation: current.rotation });
    node.position(center);
    s.setGeometry(item.id, { ...center, width, depth }, { clamp: false });
  };

  const handleTransformEnd = () => {
    const s = projectStore.getState();
    s.setGeometry(item.id, {});
    s.endGesture();
    useUi.getState().setRotating(null);
  };

  const outline = item.shape.kind === 'l' ? localOutline(item) : null;

  return (
    <Group
      id={item.id}
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      draggable
      onMouseDown={select}
      onTap={select}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={(e) => {
        setCursor(e, 'move');
        useUi.getState().setHovered(item.id);
      }}
      onMouseLeave={(e) => {
        setCursor(e, '');
        if (useUi.getState().hoveredId === item.id) useUi.getState().setHovered(null);
      }}
    >
      {item.shape.kind === 'round' ? (
        <Ellipse {...bodyProps} radiusX={item.width / 2} radiusY={item.depth / 2} />
      ) : outline ? (
        <Line {...bodyProps} points={outline.flatMap((p) => [p.x, p.y])} closed />
      ) : (
        <Rect
          {...bodyProps}
          x={-item.width / 2}
          y={-item.depth / 2}
          width={item.width}
          height={item.depth}
          cornerRadius={cornerRadius(item)}
        />
      )}
      <FurnitureDetails item={item} />
    </Group>
  );
});
