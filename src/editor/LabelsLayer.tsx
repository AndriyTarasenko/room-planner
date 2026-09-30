import { Group, Text } from 'react-konva';
import { lSegment } from '../geometry/footprint';
import { localToWorld, normalizeAngle } from '../geometry/rect';
import { type Viewport, worldToView } from '../geometry/viewport';
import type { FurnitureItem } from '../types';
import { readableTextColor } from '../utils/color';
import { formatSize } from '../utils/format';
import { measureTextWidth } from '../utils/measureText';
import { FONT_FAMILY } from './theme';

const NAME_SIZE = 11;
const DIM_SIZE = 10;
const LINE_H = 13;
const PAD = 6;

/**
 * Name and dimensions of each item, drawn in screen space so text stays crisp and a
 * constant size at any zoom. Text follows the item's orientation but is never upside down,
 * and turns along the longer side when it doesn't fit across.
 */
export function LabelsLayer({ items, vp }: { items: readonly FurnitureItem[]; vp: Viewport }) {
  const hosts = new Set(items.map((i) => i.attachedTo).filter(Boolean));
  return (
    <Group listening={false}>
      {items.map((item) => (
        <ItemLabel key={item.id} item={item} vp={vp} hasItemsOnTop={hosts.has(item.id)} />
      ))}
    </Group>
  );
}

function ItemLabel({ item, vp, hasItemsOnTop }: { item: FurnitureItem; vp: Viewport; hasItemsOnTop: boolean }) {
  const name = item.name || 'Object';
  const dims = formatSize(item.width, item.depth);
  const nameFont = `500 ${NAME_SIZE}px ${FONT_FAMILY}`;
  const nameWidth = measureTextWidth(name, nameFont);

  // Area available for the label, in the item's local frame (cm).
  const areaW = item.width;
  let areaD = item.depth;
  let localCenter = { x: 0, y: 0 };
  if (item.shape.kind === 'l') {
    areaD = lSegment(item.width, item.depth, item.shape.segment);
    localCenter = { x: 0, y: -item.depth / 2 + areaD / 2 };
  }

  let along = areaW * vp.scale;
  let across = areaD * vp.scale;
  let turn = 0;
  if (nameWidth + PAD * 2 > along && across > along) {
    [along, across] = [across, along];
    turn = 90;
  }

  const lines = across >= LINE_H * 2 + 6 ? 2 : across >= LINE_H + 2 ? 1 : 0;
  if (lines === 0 || along < 22) return null;

  // Items carrying monitors get their label near the front edge, clear of what's on top.
  const blockHeight = lines * LINE_H;
  if (hasItemsOnTop && turn === 0 && item.shape.kind === 'rect') {
    const offset = item.depth / 2 - (blockHeight / 2 + 5) / vp.scale;
    if (offset > 0) localCenter = { x: 0, y: offset };
  }

  const world = localToWorld(localCenter, item);
  const pos = worldToView(world, vp);
  let rotation = normalizeAngle(item.rotation + turn);
  if (rotation > 90 && rotation <= 270) rotation -= 180;

  const colors = readableTextColor(item.color);
  const width = along - PAD * 2;
  // Single line: prefer the name if it fits, otherwise the dimensions.
  const single = nameWidth <= width ? name : dims;

  return (
    <Group x={pos.x} y={pos.y} rotation={rotation}>
      {lines === 2 ? (
        <>
          <Text
            x={-width / 2}
            y={-LINE_H}
            width={width}
            align="center"
            text={name}
            fontFamily={FONT_FAMILY}
            fontSize={NAME_SIZE}
            fontStyle="500"
            fill={colors.primary}
            wrap="none"
            ellipsis
          />
          <Text
            x={-width / 2}
            y={1}
            width={width}
            align="center"
            text={dims}
            fontFamily={FONT_FAMILY}
            fontSize={DIM_SIZE}
            fill={colors.secondary}
            wrap="none"
            ellipsis
          />
        </>
      ) : (
        <Text
          x={-width / 2}
          y={-LINE_H / 2 + 1}
          width={width}
          align="center"
          text={single}
          fontFamily={FONT_FAMILY}
          fontSize={single === name ? NAME_SIZE : DIM_SIZE}
          fontStyle={single === name ? '500' : 'normal'}
          fill={colors.primary}
          wrap="none"
          ellipsis
        />
      )}
    </Group>
  );
}
