import { Group, Line, Rect, Text } from 'react-konva';
import { type MeasureLine, neighborGaps, wallMeasureLines } from '../geometry/distances';
import { footprintBox } from '../geometry/footprint';
import { type Point, isQuarterTurn } from '../geometry/rect';
import type { SnapGuide } from '../geometry/snapping';
import { type Viewport, worldToView } from '../geometry/viewport';
import { rectPolygon } from '../geometry/bounds';
import { roomForBox } from '../plan/rooms';
import { roomRect } from '../plan/shape';
import { axisWalls, pointOnWall, wallFrame } from '../plan/walls';
import type { FurnitureItem, Opening, Room } from '../types';
import { formatNumber } from '../utils/format';
import { measureTextWidth } from '../utils/measureText';
import { CANVAS, FONT_FAMILY, PILL_FONT, PILL_H, pillWidth } from './theme';

type Variant = 'wall' | 'gap' | 'host';

const VARIANT_STYLE: Record<Variant, { line: string; pill: string; dash?: number[] }> = {
  wall: { line: CANVAS.accent, pill: CANVAS.accent, dash: [4, 3] },
  host: { line: CANVAS.accent, pill: CANVAS.accent, dash: [2, 2] },
  gap: { line: CANVAS.pillDark, pill: CANVAS.pillDark },
};

export function Pill({ at, text, fill, textColor = '#fff' }: { at: Point; text: string; fill: string; textColor?: string }) {
  const w = Math.ceil(pillWidth(text));
  return (
    <Group x={Math.round(at.x - w / 2)} y={Math.round(at.y - PILL_H / 2)}>
      <Rect width={w} height={PILL_H} cornerRadius={4} fill={fill} shadowColor="#000" shadowOpacity={0.12} shadowBlur={3} shadowOffsetY={1} />
      <Text width={w} height={PILL_H} align="center" verticalAlign="middle" text={text} fontFamily={FONT_FAMILY} fontSize={PILL_FONT} fontStyle="600" fill={textColor} />
    </Group>
  );
}

/**
 * A dimension line with end ticks and a value pill. `muted` lines (a wall distance that
 * passes behind a closer neighbor) are drawn faintly with the label next to the wall.
 */
function Dimension({ line, vp, variant, muted = false }: { line: MeasureLine; vp: Viewport; variant: Variant; muted?: boolean }) {
  const a = worldToView(line.from, vp);
  const b = worldToView(line.to, vp);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return null;
  const style = VARIANT_STYLE[variant];
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const tick = 4;
  const nx = -uy * tick;
  const ny = ux * tick;
  const text = formatNumber(line.value);
  const pillW = pillWidth(text);
  const pillExtent = Math.abs(ux) > 0.5 ? pillW : PILL_H;
  // Short lines get their label just past the far end so it doesn't cover the object.
  const label =
    len <= pillExtent + 10
      ? { x: b.x + ux * (pillExtent / 2 + 6), y: b.y + uy * (pillExtent / 2 + 6) }
      : muted
        ? { x: b.x - ux * (pillExtent / 2 + 8), y: b.y - uy * (pillExtent / 2 + 8) }
        : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  return (
    <Group opacity={muted ? 0.55 : 1}>
      <Line points={[a.x, a.y, b.x, b.y]} stroke={style.line} strokeWidth={1} dash={style.dash} />
      <Line points={[a.x - nx, a.y - ny, a.x + nx, a.y + ny]} stroke={style.line} strokeWidth={1} />
      <Line points={[b.x - nx, b.y - ny, b.x + nx, b.y + ny]} stroke={style.line} strokeWidth={1} />
      <Pill at={label} text={text} fill={style.pill} />
    </Group>
  );
}

/**
 * The length of every wall of a room that isn't a rectangle, labelled just inside the room
 * next to the wall.
 */
function WallLengths({ room, vp }: { room: Room; vp: Viewport }) {
  return (
    <Group listening={false}>
      {room.corners.map((_, i) => {
        const f = wallFrame(room, i);
        if (f.length * vp.scale < 40) return null;
        const mid = pointOnWall(f, f.length / 2);
        const at = worldToView({ x: mid.x + (f.inward.x * 16) / vp.scale, y: mid.y + (f.inward.y * 16) / vp.scale }, vp);
        return <Pill key={i} at={at} text={formatNumber(f.length)} fill={CANVAS.pillDark} />;
      })}
    </Group>
  );
}

/**
 * Interior width/depth of a rectangular room: outside its top and left walls, or, with
 * `inside` (plans with several rooms, where a neighbor may sit right behind the wall), along
 * its top and left edges inside the room. Other shapes get the length of each wall.
 */
export function RoomDimensions({ room, vp, inside = false }: { room: Room; vp: Viewport; inside?: boolean }) {
  const rect = roomRect(room);
  if (!rect) return <WallLengths room={room} vp={vp} />;
  if (inside) {
    const inset = 20 / vp.scale;
    const { x, y, width: w, depth: d } = rect;
    return (
      <Group listening={false}>
        <Dimension line={{ direction: 'top', from: { x, y: y + inset }, to: { x: x + w, y: y + inset }, value: w }} vp={vp} variant="gap" />
        <Dimension line={{ direction: 'left', from: { x: x + inset, y }, to: { x: x + inset, y: y + d }, value: d }} vp={vp} variant="gap" />
      </Group>
    );
  }
  const tl = worldToView({ x: rect.x, y: rect.y }, vp);
  const br = worldToView({ x: rect.x + rect.width, y: rect.y + rect.depth }, vp);
  const walls = axisWalls(room);
  const thickness = (axis: 'x' | 'y') => walls.find((w) => w.axis === axis && w.inward === 1)?.thickness ?? 0;
  const y = tl.y - thickness('y') * vp.scale - 16;
  const x = tl.x - thickness('x') * vp.scale - 16;
  const color = CANVAS.dimension;
  const text = (v: number) => `${formatNumber(v)} cm`;
  const font = `500 11px ${FONT_FAMILY}`;
  const wText = text(rect.width);
  const dText = text(rect.depth);
  const wW = measureTextWidth(wText, font) + 12;
  const dW = measureTextWidth(dText, font) + 12;
  const midX = (tl.x + br.x) / 2;
  const midY = (tl.y + br.y) / 2;

  return (
    <Group listening={false}>
      <Line points={[tl.x, y, midX - wW / 2, y]} stroke={color} strokeWidth={1} />
      <Line points={[midX + wW / 2, y, br.x, y]} stroke={color} strokeWidth={1} />
      <Line points={[tl.x, y - 4, tl.x, y + 4]} stroke={color} strokeWidth={1} />
      <Line points={[br.x, y - 4, br.x, y + 4]} stroke={color} strokeWidth={1} />
      <Text x={midX - wW / 2} y={y - 7} width={wW} align="center" text={wText} fontFamily={FONT_FAMILY} fontSize={11} fontStyle="500" fill={color} />

      <Line points={[x, tl.y, x, midY - dW / 2]} stroke={color} strokeWidth={1} />
      <Line points={[x, midY + dW / 2, x, br.y]} stroke={color} strokeWidth={1} />
      <Line points={[x - 4, tl.y, x + 4, tl.y]} stroke={color} strokeWidth={1} />
      <Line points={[x - 4, br.y, x + 4, br.y]} stroke={color} strokeWidth={1} />
      <Text x={x - 7} y={midY + dW / 2} width={dW} align="center" rotation={-90} text={dText} fontFamily={FONT_FAMILY} fontSize={11} fontStyle="500" fill={color} />
    </Group>
  );
}

interface SelectionProps {
  item: FurnitureItem;
  items: readonly FurnitureItem[];
  rooms: readonly Room[];
  vp: Viewport;
}

/**
 * Live distances for the selected item: to the four walls of its room, and the gap to the
 * nearest object in each direction. Items standing on a desk show distances to the desk edges instead.
 */
export function SelectionMeasurements({ item, items, rooms, vp }: SelectionProps) {
  const host = item.attachedTo ? items.find((i) => i.id === item.attachedTo) : undefined;

  if (host && host.shape.kind === 'rect' && isQuarterTurn(host.rotation) && isQuarterTurn(item.rotation)) {
    const hb = footprintBox(host);
    const lines = wallMeasureLines(item, rectPolygon({ x: hb.minX, y: hb.minY, width: hb.maxX - hb.minX, depth: hb.maxY - hb.minY })).filter(
      (l) => l.value > 0.5,
    );
    return (
      <Group listening={false}>
        {lines.map((l) => (
          <Dimension key={l.direction} line={l} vp={vp} variant="host" />
        ))}
      </Group>
    );
  }

  const box = footprintBox(item);
  const others = items
    .filter((o) => o.id !== item.id && o.attachedTo !== item.id && o.placement === item.placement)
    .map((o) => ({ id: o.id, box: footprintBox(o) }));
  const gaps = neighborGaps(box, others);
  const walls = wallMeasureLines(item, roomForBox(box, rooms).corners).filter((l) => l.value > 0.5);

  return (
    <Group listening={false}>
      {walls.map((l) => (
        <Dimension key={`w-${l.direction}`} line={l} vp={vp} variant="wall" muted={gaps.some((g) => g.direction === l.direction)} />
      ))}
      {gaps.map((g) => (
        <Dimension key={`g-${g.direction}`} line={g} vp={vp} variant="gap" />
      ))}
    </Group>
  );
}

/**
 * Where the selected door or window sits in its wall: a chain of dimensions along the
 * interior face, from the start corner to the opening, across it, and on to the end corner.
 */
export function OpeningMeasurements({ room, opening, vp }: { room: Room; opening: Opening; vp: Viewport }) {
  const f = wallFrame(room, opening.wall);
  const inset = 20 / vp.scale;
  const at = (t: number) => {
    const p = pointOnWall(f, t);
    return { x: p.x + f.inward.x * inset, y: p.y + f.inward.y * inset };
  };
  const end = opening.offset + opening.width;
  const segments: { key: string; from: number; to: number; variant: Variant }[] = [
    { key: 'before', from: 0, to: opening.offset, variant: 'wall' },
    { key: 'opening', from: opening.offset, to: end, variant: 'gap' },
    { key: 'after', from: end, to: f.length, variant: 'wall' },
  ];
  return (
    <Group listening={false}>
      {segments
        .filter((s) => s.to - s.from > 0.5)
        .map((s) => (
          <Dimension key={s.key} line={{ direction: 'left', from: at(s.from), to: at(s.to), value: s.to - s.from }} vp={vp} variant={s.variant} />
        ))}
    </Group>
  );
}

export function SnapGuides({ guides, vp }: { guides: readonly SnapGuide[]; vp: Viewport }) {
  if (guides.length === 0) return null;
  const extend = 10;
  return (
    <Group listening={false}>
      {guides.map((g, i) => {
        const pos = g.orientation === 'vertical' ? vp.originX + g.position * vp.scale : vp.originY + g.position * vp.scale;
        const start = (g.orientation === 'vertical' ? vp.originY : vp.originX) + g.start * vp.scale - extend;
        const end = (g.orientation === 'vertical' ? vp.originY : vp.originX) + g.end * vp.scale + extend;
        const points = g.orientation === 'vertical' ? [pos, start, pos, end] : [start, pos, end, pos];
        return <Line key={i} points={points} stroke={CANVAS.guide} strokeWidth={g.kind === 'wall' ? 2 : 1} />;
      })}
    </Group>
  );
}
