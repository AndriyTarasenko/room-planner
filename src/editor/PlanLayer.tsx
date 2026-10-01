import type { Context } from 'konva/lib/Context';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import { Group, Line, Shape, Text } from 'react-konva';
import { polygonLabelPoint } from '../geometry/bounds';
import { rayToBoundary } from '../geometry/polygon';
import type { Point } from '../geometry/rect';
import { type Viewport, worldToView } from '../geometry/viewport';
import { roomArea, roomBounds, roomRect } from '../plan/shape';
import { alongWall, pointOnWall, wallFrame, wallPolygons, wallThickness } from '../plan/walls';
import { projectStore } from '../store';
import type { Room, Settings } from '../types';
import { formatArea, formatSize } from '../utils/format';
import { measureTextWidth } from '../utils/measureText';
import { toast } from '../components/ui/toastStore';
import { CANVAS, FONT_FAMILY } from './theme';

const flat = (points: readonly Point[]) => points.flatMap((p) => [p.x, p.y]);

/** Clicks select a room; drags on floors and walls pan the view (the stage is draggable). */
const selectRoom = (id: string) => () => projectStore.getState().select(id);

/**
 * Double-clicking a wall adds a corner there, so the two halves can be moved apart: that is
 * how a straight wall gets a niche, a bay or a slanted part.
 */
const splitWallAtPointer = (roomId: string, wall: number) => (e: KonvaEventObject<MouseEvent>) => {
  const s = projectStore.getState();
  const room = s.rooms.find((r) => r.id === roomId);
  const p = e.target.getParent()?.getRelativePointerPosition();
  if (!room || !p) return;
  e.cancelBubble = true;
  const t = Math.round(alongWall(wallFrame(room, wall), p));
  if (s.splitRoomWall(roomId, wall, t) === null) toast('A corner can’t go there: too close to the end of the wall.', 'error');
};

const tracePath = (ctx: Context, corners: readonly Point[]) => {
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
};

/** Floors and grids of all rooms, in plan coordinates. Clicking a floor selects its room. */
export function RoomFloors({ rooms, settings, scale }: { rooms: readonly Room[]; settings: Settings; scale: number }) {
  const grid = settings.gridSize;
  // Hide grid lines that would be denser than 5 px; major lines every metre (or 5 cells).
  const showMinor = settings.gridVisible && grid * scale >= 5;
  const major = grid >= 50 ? grid * 2 : 100;

  // Grid lines start at each room's top-left, so in a rectangle they measure distances from its walls.
  const drawLines = (room: Room, step: number, skip: number | null) => (ctx: Context, shape: KonvaShape) => {
    const b = roomBounds(room);
    const W = b.maxX - b.minX;
    const D = b.maxY - b.minY;
    ctx.beginPath();
    for (let x = step; x < W - 0.001; x += step) {
      if (skip && Math.abs(x / skip - Math.round(x / skip)) < 1e-6) continue;
      ctx.moveTo(b.minX + x, b.minY);
      ctx.lineTo(b.minX + x, b.maxY);
    }
    for (let y = step; y < D - 0.001; y += step) {
      if (skip && Math.abs(y / skip - Math.round(y / skip)) < 1e-6) continue;
      ctx.moveTo(b.minX, b.minY + y);
      ctx.lineTo(b.maxX, b.minY + y);
    }
    ctx.strokeShape(shape);
  };

  return (
    <Group>
      {rooms.map((room) => (
        <Group key={room.id}>
          <Line name="floor" points={flat(room.corners)} closed fill={CANVAS.floor} onClick={selectRoom(room.id)} onTap={selectRoom(room.id)} />
          <Group listening={false} clipFunc={roomRect(room) ? undefined : (ctx: Context) => tracePath(ctx, room.corners)}>
            {showMinor && <Shape stroke={CANVAS.gridMinor} strokeWidth={1} strokeScaleEnabled={false} sceneFunc={drawLines(room, grid, major)} />}
            {settings.gridVisible && <Shape stroke={CANVAS.gridMajor} strokeWidth={1} strokeScaleEnabled={false} sceneFunc={drawLines(room, major, null)} />}
          </Group>
        </Group>
      ))}
    </Group>
  );
}

/** Walls of all rooms, and a dashed edge where a wall is left open. */
export function RoomWalls({ rooms, scale }: { rooms: readonly Room[]; scale: number }) {
  const dash = [6 / scale, 4 / scale];
  return (
    <Group>
      {rooms.map((room) => (
        <Group key={room.id}>
          {wallPolygons(room).map(({ index, polygon }) => (
            <Line
              key={index}
              points={flat(polygon)}
              closed
              fill={CANVAS.wall}
              onClick={selectRoom(room.id)}
              onTap={selectRoom(room.id)}
              onDblClick={splitWallAtPointer(room.id, index)}
            />
          ))}
          {room.corners.map((_, i) => {
            if (wallThickness(room, i) > 0) return null;
            const f = wallFrame(room, i);
            const b = pointOnWall(f, f.length);
            return (
              <Line
                key={`open-${i}`}
                points={[f.start.x, f.start.y, b.x, b.y]}
                stroke={CANVAS.openSide}
                strokeWidth={1.5}
                strokeScaleEnabled={false}
                dash={dash}
                hitStrokeWidth={10}
                onClick={selectRoom(room.id)}
                onDblClick={splitWallAtPointer(room.id, i)}
              />
            );
          })}
        </Group>
      ))}
    </Group>
  );
}

const NAME_FONT = 12;
const META_FONT = 11;

/**
 * Room names with size and area, drawn in screen space (crisp at any zoom) between the floors
 * and the furniture, at the widest spot of the room. Lines that don't fit are left out.
 */
export function RoomLabels({ rooms, vp, hiddenId }: { rooms: readonly Room[]; vp: Viewport; hiddenId: string | null }) {
  return (
    <Group listening={false}>
      {rooms.map((room) => {
        if (room.id === hiddenId) return null;
        const { point } = polygonLabelPoint(room.corners);
        // Room for text: as far as the walls to the left and right (and above and below) of that spot.
        const reach = (dx: number, dy: number) => Math.min(rayToBoundary(point, { x: dx, y: dy }, room.corners), 1e6);
        const width = 2 * Math.min(reach(-1, 0), reach(1, 0)) * vp.scale - 12;
        const height = 2 * Math.min(reach(0, -1), reach(0, 1)) * vp.scale;
        const rect = roomRect(room);
        const meta = rect ? `${formatSize(rect.width, rect.depth)} · ${formatArea(roomArea(room))}` : formatArea(roomArea(room));
        const nameFits = measureTextWidth(room.name, `600 ${NAME_FONT}px ${FONT_FAMILY}`) <= width && height >= 20;
        const metaFits = nameFits && measureTextWidth(meta, `${META_FONT}px ${FONT_FAMILY}`) <= width && height >= 44;
        if (!nameFits) return null;
        const c = worldToView(point, vp);
        return (
          <Group key={room.id} x={c.x - width / 2} y={c.y - (metaFits ? 15 : 8)}>
            <Text width={width} align="center" text={room.name} fontFamily={FONT_FAMILY} fontSize={NAME_FONT} fontStyle="600" fill={CANVAS.roomName} />
            {metaFits && (
              <Text y={17} width={width} align="center" text={meta} fontFamily={FONT_FAMILY} fontSize={META_FONT} fill={CANVAS.roomMeta} />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
