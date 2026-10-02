import type { KonvaEventObject } from 'konva/lib/Node';
import { useRef, useState } from 'react';
import { Arrow, Circle, Group, Line, Rect, Text } from 'react-konva';
import { toast } from '../components/ui/toastStore';
import type { Point } from '../geometry/rect';
import type { SnapGuide } from '../geometry/snapping';
import { cornerTargets, snapPoint, snapRoomEdge, snapRoomMove } from '../plan/roomSnapping';
import { roomAnchor } from '../plan/rooms';
import { roomBounds, translateRoom } from '../plan/shape';
import { type WallFrame, pointOnWall, wallFrame } from '../plan/walls';
import { projectStore, selectRooms } from '../store';
import type { Room } from '../types';
import { measureTextWidth } from '../utils/measureText';
import { SNAP_DISTANCE_PX } from './dragLogic';
import { CANVAS, FONT_FAMILY } from './theme';
import { useUi } from './uiStore';

interface Props {
  room: Room;
  /** Pixels per cm. */
  scale: number;
}

type Drag = { kind: 'wall' | 'corner' | 'move'; index: number } | null;

const currentRoom = (id: string) => selectRooms(projectStore.getState()).find((r) => r.id === id);
const otherRooms = (id: string) => selectRooms(projectStore.getState()).filter((r) => r.id !== id);
/** The room as it was when the current gesture started. */
const roomAtGestureStart = (id: string) => {
  const start = projectStore.getState().gesture;
  return start ? selectRooms(start).find((r) => r.id === id) : undefined;
};
const flat = (points: readonly Point[]) => points.flatMap((p) => [p.x, p.y]);

function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

/** The fixed coordinate of a horizontal or vertical wall, or null for a slanted one. */
function straightAxis(f: WallFrame): 'x' | 'y' | null {
  if (Math.abs(f.start.x - f.end.x) < 1e-9) return 'x';
  if (Math.abs(f.start.y - f.end.y) < 1e-9) return 'y';
  return null;
}

const wallCursor = (f: WallFrame) => {
  const axis = straightAxis(f);
  return axis === 'x' ? 'ew-resize' : axis === 'y' ? 'ns-resize' : 'move';
};

const angleOf = (f: WallFrame) => (Math.atan2(f.along.y, f.along.x) * 180) / Math.PI;

/**
 * Handles for the selected room: drag a wall to move it (the walls next to it keep their
 * direction, so corners stay square), drag a corner anywhere (for slanted walls), or drag the
 * name tag to move the whole room with its furniture. Double-click a wall to add a corner in
 * it, and a corner to remove it. Everything snaps to neighboring rooms; hold Alt to place freely.
 */
export function RoomHandles({ room, scale }: Props) {
  const threshold = SNAP_DISTANCE_PX / scale;
  const px = (v: number) => v / scale;
  const [drag, setDrag] = useState<Drag>(null);
  /** How far the dragged wall has actually moved: an impossible shape keeps the last good one. */
  const applied = useRef(0);
  const hoveredWall = useUi((s) => (s.hoveredWall?.roomId === room.id ? s.hoveredWall.wall : null));

  const begin = (next: Drag) => () => {
    setDrag(next);
    applied.current = 0;
    projectStore.getState().beginGesture();
    // Keep the view still while the plan's outline changes under the pointer.
    useUi.getState().freezeView();
  };
  const end = () => {
    setDrag(null);
    projectStore.getState().endGesture();
    useUi.getState().setGuides([]);
  };

  // While a wall is dragged, its handle stays tied to the wall as it was when the drag began:
  // pushing out a bay adds walls, which renumbers them.
  const base = (drag?.kind === 'wall' && roomAtGestureStart(room.id)) || room;

  const handleWallMove = (index: number) => (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const s = projectStore.getState();
    const start = roomAtGestureStart(room.id);
    if (!start) return;
    const f = wallFrame(start, index);
    const out = { x: -f.inward.x, y: -f.inward.y };
    const mid = pointOnWall(f, f.length / 2);
    const p = node.position();
    let distance = (p.x - mid.x) * out.x + (p.y - mid.y) * out.y;
    let guides: SnapGuide[] = [];
    const axis = straightAxis(f);
    if (axis && !e.evt.altKey) {
      const at = axis === 'x' ? mid.x : mid.y;
      const sign = axis === 'x' ? out.x : out.y;
      const snap = snapRoomEdge(start, index, at + distance * sign, otherRooms(room.id), threshold);
      if (snap.guide) {
        distance = (snap.value - at) * sign;
        guides = [snap.guide];
      }
    }
    if (guides.length === 0) distance = Math.round(distance);
    if (s.moveRoomWall(room.id, index, distance)) applied.current = distance;
    node.position({ x: mid.x + out.x * applied.current, y: mid.y + out.y * applied.current });
    useUi.getState().setGuides(guides);
  };

  const handleCornerMove = (index: number) => (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const r = currentRoom(room.id);
    if (!r) return;
    const p = node.position();
    let point = { x: Math.round(p.x), y: Math.round(p.y) };
    let guides: SnapGuide[] = [];
    if (!e.evt.altKey) {
      const targets = [...cornerTargets(otherRooms(room.id)), ...r.corners.filter((_, k) => k !== index)];
      const snap = snapPoint(p, targets, threshold);
      guides = snap.guides;
      point = {
        x: guides.some((g) => g.orientation === 'vertical') ? snap.point.x : point.x,
        y: guides.some((g) => g.orientation === 'horizontal') ? snap.point.y : point.y,
      };
    }
    projectStore.getState().moveRoomCorner(room.id, index, point);
    const after = currentRoom(room.id);
    if (after) node.position(after.corners[index]);
    useUi.getState().setGuides(guides);
  };

  const handleMove = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const r = currentRoom(room.id);
    if (!r) return;
    const anchor = roomAnchor(r);
    const b = roomBounds(r);
    let dx = node.x() - anchor.x;
    let dy = node.y() - anchor.y;
    let guides: SnapGuide[] = [];
    if (!e.evt.altKey) {
      const snap = snapRoomMove(translateRoom(r, dx, dy), otherRooms(room.id), threshold);
      dx += snap.dx;
      dy += snap.dy;
      guides = snap.guides;
    }
    let x = b.minX + dx;
    let y = b.minY + dy;
    // Whole centimeters, except where a snap put the room exactly against a neighbor.
    if (!guides.some((g) => g.orientation === 'vertical')) x = Math.round(x);
    if (!guides.some((g) => g.orientation === 'horizontal')) y = Math.round(y);
    projectStore.getState().setRoomGeometry(room.id, { x, y }, { carry: true });
    const after = currentRoom(room.id);
    if (after) node.position(roomAnchor(after));
    useUi.getState().setGuides(guides);
  };

  const splitAt = (index: number) => () => {
    const f = wallFrame(room, index);
    if (projectStore.getState().splitRoomWall(room.id, index, Math.round(f.length / 2)) === null) {
      toast('This wall is too short to add a corner.', 'error');
    }
  };
  const removeAt = (index: number) => () => {
    if (!projectStore.getState().removeRoomCorner(room.id, index)) {
      toast(room.corners.length <= 3 ? 'A room needs at least three corners.' : 'Removing this corner would make walls cross.', 'error');
    }
  };

  // Name tag, in screen pixels.
  const label = room.name;
  const font = `600 12px ${FONT_FAMILY}`;
  const textW = Math.min(160, Math.ceil(measureTextWidth(label, font)));
  const tagH = 26;
  const tagW = 10 + 14 + 6 + textW + 12;
  const center = roomAnchor(room);
  const icon = { x: px(-tagW / 2 + 10 + 7), y: 0 };
  const arrow = { stroke: '#fff', fill: '#fff', strokeWidth: 1.3, strokeScaleEnabled: false, pointerLength: px(3), pointerWidth: px(3.5), listening: false } as const;
  const reach = px(6);
  const highlighted = hoveredWall !== null && hoveredWall < room.corners.length ? wallFrame(room, hoveredWall) : null;

  return (
    <Group>
      <Line points={flat(room.corners)} closed stroke={CANVAS.accent} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
      {highlighted && (
        <Line
          points={[highlighted.start.x, highlighted.start.y, highlighted.end.x, highlighted.end.y]}
          stroke={CANVAS.accent}
          strokeWidth={5}
          strokeScaleEnabled={false}
          lineCap="round"
          opacity={0.6}
          listening={false}
        />
      )}
      {base.corners.map((_, index) => {
        if (drag && !(drag.kind === 'wall' && drag.index === index)) return null;
        const f = wallFrame(base, index);
        // Walls too short to grab on screen only get their corner handles.
        if (!drag && f.length * scale < 44) return null;
        const at = pointOnWall(f, f.length / 2);
        const w = px(30);
        const h = px(9);
        return (
          <Rect
            key={`wall-${index}`}
            name="room-edge-handle"
            x={at.x}
            y={at.y}
            rotation={angleOf(f)}
            offsetX={w / 2}
            offsetY={h / 2}
            width={w}
            height={h}
            cornerRadius={px(3)}
            fill="#ffffff"
            stroke={CANVAS.accent}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            hitStrokeWidth={12}
            draggable
            onDragStart={begin({ kind: 'wall', index })}
            onDragMove={handleWallMove(index)}
            onDragEnd={end}
            onDblClick={splitAt(index)}
            onMouseEnter={(e) => setCursor(e, wallCursor(f))}
            onMouseLeave={(e) => setCursor(e, '')}
          />
        );
      })}
      {room.corners.map((p, index) =>
        drag && !(drag.kind === 'corner' && drag.index === index) ? null : (
          <Circle
            key={`corner-${index}`}
            name="room-corner-handle"
            x={p.x}
            y={p.y}
            radius={px(4.5)}
            fill="#ffffff"
            stroke={CANVAS.accent}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            hitStrokeWidth={14}
            draggable
            onDragStart={begin({ kind: 'corner', index })}
            onDragMove={handleCornerMove(index)}
            onDragEnd={end}
            onDblClick={removeAt(index)}
            onMouseEnter={(e) => setCursor(e, 'move')}
            onMouseLeave={(e) => setCursor(e, '')}
          />
        ),
      )}
      {(!drag || drag.kind === 'move') && (
        <Group
          name="room-move-handle"
          x={center.x}
          y={center.y}
          draggable
          onDragStart={begin({ kind: 'move', index: 0 })}
          onDragMove={handleMove}
          onDragEnd={end}
          onMouseEnter={(e) => setCursor(e, 'move')}
          onMouseLeave={(e) => setCursor(e, '')}
        >
          <Rect
            x={px(-tagW / 2)}
            y={px(-tagH / 2)}
            width={px(tagW)}
            height={px(tagH)}
            cornerRadius={px(tagH / 2)}
            fill={CANVAS.accent}
            shadowColor="#000"
            shadowOpacity={0.18}
            shadowBlur={px(4)}
            shadowOffsetY={px(1)}
          />
          <Arrow {...arrow} points={[icon.x, icon.y, icon.x - reach, icon.y]} />
          <Arrow {...arrow} points={[icon.x, icon.y, icon.x + reach, icon.y]} />
          <Arrow {...arrow} points={[icon.x, icon.y, icon.x, icon.y - reach]} />
          <Arrow {...arrow} points={[icon.x, icon.y, icon.x, icon.y + reach]} />
          <Text
            x={px(-tagW / 2 + 30)}
            y={px(-7)}
            width={px(textW + 2)}
            text={label}
            fontFamily={FONT_FAMILY}
            fontSize={px(12)}
            fontStyle="600"
            fill="#ffffff"
            wrap="none"
            ellipsis
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
