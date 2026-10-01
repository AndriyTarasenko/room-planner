import type { Context } from 'konva/lib/Context';
import { Arc, Circle, Group, Line, Rect, Text } from 'react-konva';
import type { LayoutAnalysis } from '../furniture/analysis';
import { isDesk } from '../furniture/rules';
import { clearanceZones } from '../geometry/clearance';
import { lSegment } from '../geometry/footprint';
import type { Point } from '../geometry/rect';
import type { FurnitureItem, Room } from '../types';
import { withAlpha } from '../utils/color';
import { CANVAS, FONT_FAMILY } from './theme';

const flat = (poly: Point[]) => poly.flatMap((p) => [p.x, p.y]);

/** Translucent clearance areas under the furniture. Amber when something stands in them. */
export function ClearanceZones({ items, analysis, rooms }: { items: readonly FurnitureItem[]; analysis: LayoutAnalysis; rooms: readonly Room[] }) {
  // Clipped to the floors: the part behind a wall is meaningless, and amber already says it's blocked.
  const clipToFloors = (ctx: Context) => {
    for (const r of rooms) {
      r.corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
    }
  };
  return (
    <Group listening={false} clipFunc={clipToFloors}>
      {items.flatMap((item) => {
        const blocked = analysis.blockedClearanceIds.has(item.id);
        const color = blocked ? CANVAS.warning : CANVAS.accent;
        return clearanceZones(item).map((zone) => (
          <Line
            key={`${item.id}-${zone.side}`}
            points={flat(zone.polygon)}
            closed
            fill={withAlpha(color, blocked ? 0.1 : 0.055)}
            stroke={withAlpha(color, blocked ? 0.75 : 0.45)}
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[4, 3]}
          />
        ));
      })}
    </Group>
  );
}

/** Overlap regions: red for physical collisions, amber for clearance intrusions and blocked doors. */
export function ConflictRegions({ analysis }: { analysis: LayoutAnalysis }) {
  return (
    <Group listening={false}>
      {analysis.clearanceConflicts.flatMap((c, i) =>
        c.regions.map((poly, j) => (
          <Line key={`c${i}-${j}`} points={flat(poly)} closed fill={withAlpha(CANVAS.warning, 0.28)} />
        )),
      )}
      {analysis.doorConflicts.flatMap((c, i) =>
        c.regions.map((poly, j) => (
          <Line key={`d${i}-${j}`} points={flat(poly)} closed fill={withAlpha(CANVAS.warning, 0.28)} />
        )),
      )}
      {analysis.collisions.flatMap((c, i) =>
        c.regions.map((poly, j) => (
          <Line
            key={`x${i}-${j}`}
            points={flat(poly)}
            closed
            fill={withAlpha(CANVAS.danger, 0.3)}
            stroke={CANVAS.danger}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
        )),
      )}
    </Group>
  );
}

/**
 * Simple ergonomic hints for desks: where monitors go, the comfortable reach area and
 * where the chair sits. Deliberately rough; no scoring.
 */
export function DeskGuides({ items, scale }: { items: readonly FurnitureItem[]; scale: number }) {
  const desks = items.filter((i) => isDesk(i) && i.showDeskGuides);
  if (desks.length === 0) return null;
  const stroke = { stroke: withAlpha(CANVAS.accent, 0.7), strokeWidth: 1, strokeScaleEnabled: false, dash: [3, 3] };
  const fill = withAlpha(CANVAS.accent, 0.07);
  const font = { fontFamily: FONT_FAMILY, fontSize: 10 / scale, fill: withAlpha(CANVAS.accent, 0.95), fontStyle: '500' } as const;

  return (
    <Group listening={false}>
      {desks.map((desk) => {
        // For L-desks, use the main top along the back edge.
        const depth = desk.shape.kind === 'l' ? lSegment(desk.width, desk.depth, desk.shape.segment) : desk.depth;
        const hw = desk.width / 2;
        const top = -desk.depth / 2;
        const front = top + depth;
        const monitorDepth = Math.min(28, depth * 0.4);
        const reach = Math.min(50, depth * 0.7, hw);
        const chairR = 30;
        return (
          <Group key={desk.id} x={desk.x} y={desk.y} rotation={desk.rotation}>
            <Rect {...stroke} x={-hw + 6} y={top + 3} width={desk.width - 12} height={monitorDepth} fill={fill} />
            <Text {...font} x={-hw + 10} y={top + 6} text="Monitors" />
            <Arc {...stroke} x={0} y={front} innerRadius={0} outerRadius={reach} angle={180} rotation={180} fill={fill} />
            <Text {...font} x={-reach} y={front - reach + 4 / scale} width={reach * 2} align="center" text="Reach" />
            <Circle {...stroke} x={0} y={front + chairR + 8} radius={chairR} fill={fill} />
            <Text {...font} x={-chairR} y={front + chairR + 8 - 5 / scale} width={chairR * 2} align="center" text="Chair" />
          </Group>
        );
      })}
    </Group>
  );
}
