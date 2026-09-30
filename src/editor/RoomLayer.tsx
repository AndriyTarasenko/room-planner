import type { Context } from 'konva/lib/Context';
import type { Shape as KonvaShape } from 'konva/lib/Shape';
import { Group, Rect, Shape } from 'react-konva';
import type { Room, Settings } from '../types';
import { CANVAS, WALL_PX } from './theme';

interface Props {
  room: Room;
  settings: Settings;
  /** Pixels per cm. */
  scale: number;
}

/** Floor, grid and walls, drawn in room coordinates (cm). */
export function RoomLayer({ room, settings, scale }: Props) {
  const wall = WALL_PX / scale;
  const { width: W, depth: D } = room;
  const grid = settings.gridSize;
  // Hide grid lines that would be denser than 5 px; major lines every metre (or 5 cells).
  const showMinor = settings.gridVisible && grid * scale >= 5;
  const major = grid >= 50 ? grid * 2 : 100;

  const drawLines = (step: number, skip: number | null) => (ctx: Context, shape: KonvaShape) => {
    ctx.beginPath();
    for (let x = step; x < W - 0.001; x += step) {
      if (skip && Math.abs(x / skip - Math.round(x / skip)) < 1e-6) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, D);
    }
    for (let y = step; y < D - 0.001; y += step) {
      if (skip && Math.abs(y / skip - Math.round(y / skip)) < 1e-6) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.strokeShape(shape);
  };

  return (
    <Group>
      <Rect name="floor" x={0} y={0} width={W} height={D} fill={CANVAS.floor} />
      {showMinor && (
        <Shape
          listening={false}
          stroke={CANVAS.gridMinor}
          strokeWidth={1}
          strokeScaleEnabled={false}
          sceneFunc={drawLines(grid, major)}
        />
      )}
      {settings.gridVisible && (
        <Shape
          listening={false}
          stroke={CANVAS.gridMajor}
          strokeWidth={1}
          strokeScaleEnabled={false}
          sceneFunc={drawLines(major, null)}
        />
      )}
      {/* Walls sit outside the interior so furniture can touch them at 0 cm. */}
      <Group listening={false}>
        <Rect x={-wall} y={-wall} width={W + wall * 2} height={wall} fill={CANVAS.wall} />
        <Rect x={-wall} y={D} width={W + wall * 2} height={wall} fill={CANVAS.wall} />
        <Rect x={-wall} y={0} width={wall} height={D} fill={CANVAS.wall} />
        <Rect x={W} y={0} width={wall} height={D} fill={CANVAS.wall} />
      </Group>
    </Group>
  );
}
