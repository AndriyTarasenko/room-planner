import type { KonvaEventObject } from 'konva/lib/Node';
import { type ReactNode, memo } from 'react';
import { Group, Line, Rect } from 'react-konva';
import { type Point, worldToLocal } from '../geometry/rect';
import { doorSwing, openingAnchor, openingCut, resolveOpeningDrag } from '../plan/openings';
import { wallFrame } from '../plan/walls';
import { projectStore } from '../store';
import { findOpening } from '../store/documentOps';
import type { Opening, Room } from '../types';
import { SNAP_DISTANCE_PX } from './dragLogic';
import { CANVAS } from './theme';

interface Props {
  room: Room;
  opening: Opening;
  rooms: readonly Room[];
  /** Pixels per cm. */
  scale: number;
  selected: boolean;
  /** Furniture stands in this door's swing. */
  blocked: boolean;
}

const currentOpening = (id: string) => findOpening(projectStore.getState().rooms, id);

function setCursor(e: KonvaEventObject<MouseEvent>, cursor: string) {
  const container = e.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

/**
 * A door, window or passage: a gap in the wall with the usual plan symbol. Drawn in the
 * wall's own frame (x along the wall, y into the room) around the middle of the opening,
 * which is the point that gets dragged along the walls.
 */
export const OpeningNode = memo(function OpeningNode({ room, opening, rooms, scale, selected, blocked }: Props) {
  const cut = openingCut(room, opening, rooms);
  const anchor = openingAnchor(room, opening);
  const f = wallFrame(room, opening.wall);
  const rotation = (Math.atan2(f.along.y, f.along.x) * 180) / Math.PI;
  const frame = { x: anchor.x, y: anchor.y, rotation };
  const rel = (p: Point) => {
    const q = worldToLocal(p, frame);
    return [q.x, q.y];
  };
  // The gap: across the opening, and from the room's side of the wall out through it.
  const box = { x: -opening.width / 2, y: -cut.depth, width: opening.width, height: cut.depth };
  /** A line along the wall at `t` (0 = outer face, 1 = the room's face) across the wall thickness. */
  const along = (t: number) => [box.x, box.y + t * box.height, box.x + box.width, box.y + t * box.height];
  const accent = selected ? CANVAS.accent : null;
  const thin = { strokeWidth: 1, strokeScaleEnabled: false, listening: false } as const;
  // Easier to grab on thin walls or when zoomed out.
  const grab = 5 / scale;

  const s = projectStore.getState();
  const handleDragStart = () => {
    s.select(opening.id);
    s.beginGesture();
  };
  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const found = currentOpening(opening.id);
    if (!found) return;
    const placement = resolveOpeningDrag(found.room, found.opening, node.position(), SNAP_DISTANCE_PX / scale, !e.evt.altKey);
    projectStore.getState().updateOpening(opening.id, placement);
    const after = currentOpening(opening.id);
    if (after) node.position(openingAnchor(after.room, after.opening));
  };
  const handleDragEnd = () => projectStore.getState().endGesture();

  let symbol: ReactNode;
  if (opening.kind === 'window') {
    symbol = (
      <>
        <Line points={along(0)} stroke={CANVAS.wall} {...thin} />
        <Line points={along(1)} stroke={CANVAS.wall} {...thin} />
        <Line points={along(0.5)} stroke={accent ?? CANVAS.opening} {...thin} strokeWidth={1.5} />
      </>
    );
  } else if (opening.kind === 'passage') {
    const dash = [4 / scale, 3 / scale];
    symbol = (
      <>
        <Line points={along(0)} stroke={accent ?? CANVAS.opening} dash={dash} {...thin} />
        <Line points={along(1)} stroke={accent ?? CANVAS.opening} dash={dash} {...thin} />
      </>
    );
  } else {
    const swing = doorSwing(room, opening, cut.depth);
    symbol = (
      <>
        <Line points={swing.arc.flatMap(rel)} stroke={blocked ? CANVAS.warning : (accent ?? CANVAS.opening)} {...thin} strokeWidth={blocked ? 1.5 : 1} />
        <Line
          points={[...rel(swing.hinge), ...rel(swing.open)]}
          stroke={accent ?? CANVAS.wall}
          strokeWidth={2}
          strokeScaleEnabled={false}
          hitStrokeWidth={10}
        />
      </>
    );
  }

  return (
    <Group
      id={opening.id}
      x={anchor.x}
      y={anchor.y}
      rotation={rotation}
      draggable
      onMouseDown={() => s.select(opening.id)}
      onTap={() => s.select(opening.id)}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onMouseEnter={(e) => setCursor(e, 'move')}
      onMouseLeave={(e) => setCursor(e, '')}
    >
      <Rect x={box.x - grab} y={box.y - grab} width={box.width + grab * 2} height={box.height + grab * 2} fill="transparent" />
      <Rect
        {...box}
        fill={CANVAS.floor}
        stroke={accent ?? undefined}
        strokeWidth={1.5}
        strokeScaleEnabled={false}
        listening={false}
      />
      {symbol}
    </Group>
  );
});
