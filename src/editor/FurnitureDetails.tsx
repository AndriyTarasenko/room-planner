import type { ReactNode } from 'react';
import { Circle, Group, Line, Rect } from 'react-konva';
import type { FurnitureItem } from '../types';
import { shade, withAlpha } from '../utils/color';

/**
 * Schematic top-down details (chair backrest, bed pillows, wardrobe doors…) drawn in the
 * item's local frame. Everything stays inside the footprint so the transformer box matches it.
 */
export function FurnitureDetails({ item }: { item: FurnitureItem }) {
  const w = item.width;
  const d = item.depth;
  const hw = w / 2;
  const hd = d / 2;
  const line = shade(item.color, 0.45);
  const soft = withAlpha(shade(item.color, 0.5), 0.35);
  const common = { stroke: line, strokeWidth: 1, strokeScaleEnabled: false, listening: false } as const;
  const faint = { ...common, stroke: soft } as const;
  const insetFill = shade(item.color, -0.25);

  // Too small for details to stay readable (and inside the footprint).
  if (w < 8 || d < 8) return null;

  let content: ReactNode = null;
  switch (item.type) {
    case 'office-chair': {
      // Seat plus backrest; the backrest marks the back of the chair (local −y).
      const seatW = w * 0.72;
      content = (
        <>
          <Rect {...common} x={-seatW / 2} y={-hd + d * 0.26} width={seatW} height={d * 0.62} cornerRadius={Math.min(w, d) * 0.16} fill={insetFill} />
          <Rect {...common} x={-w * 0.36} y={-hd + d * 0.05} width={w * 0.72} height={d * 0.16} cornerRadius={d * 0.08} fill={shade(item.color, 0.15)} />
        </>
      );
      break;
    }
    case 'sofa': {
      const back = Math.min(d * 0.24, 22);
      const arm = Math.min(w * 0.1, 18);
      const seats = Math.max(1, Math.round((w - arm * 2) / 70));
      const seatW = (w - arm * 2) / seats;
      content = (
        <>
          <Rect {...common} x={-hw} y={-hd} width={w} height={back} fill={shade(item.color, 0.08)} />
          <Rect {...common} x={-hw} y={-hd + back} width={arm} height={d - back} fill={shade(item.color, 0.08)} />
          <Rect {...common} x={hw - arm} y={-hd + back} width={arm} height={d - back} fill={shade(item.color, 0.08)} />
          {Array.from({ length: seats - 1 }, (_, i) => (
            <Line key={i} {...faint} points={[-hw + arm + seatW * (i + 1), -hd + back, -hw + arm + seatW * (i + 1), hd]} />
          ))}
        </>
      );
      break;
    }
    case 'bed': {
      // Head at the back (local −y), two pillows for double beds.
      const pillows = w >= 120 ? 2 : 1;
      const gap = 6;
      const pw = (w - gap * (pillows + 1)) / pillows;
      const ph = Math.min(d * 0.14, 30);
      content = (
        <>
          {Array.from({ length: pillows }, (_, i) => (
            <Rect key={i} {...common} x={-hw + gap + i * (pw + gap)} y={-hd + gap} width={pw} height={ph} cornerRadius={4} fill={insetFill} />
          ))}
          <Line {...faint} points={[-hw, -hd + d * 0.32, hw, -hd + d * 0.32]} />
        </>
      );
      break;
    }
    case 'wardrobe':
    case 'sideboard': {
      const doorWidth = item.type === 'wardrobe' ? 50 : 40;
      const doors = Math.max(1, Math.round(w / doorWidth));
      content = (
        <>
          {Array.from({ length: doors - 1 }, (_, i) => {
            const x = -hw + (w / doors) * (i + 1);
            return <Line key={i} {...faint} points={[x, -hd + 2, x, hd - 2]} />;
          })}
          {/* Front edge marks the opening side. */}
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'shelf': {
      const cells = Math.max(1, Math.round(w / 38));
      content = Array.from({ length: cells - 1 }, (_, i) => {
        const x = -hw + (w / cells) * (i + 1);
        return <Line key={i} {...faint} points={[x, -hd + 1.5, x, hd - 1.5]} />;
      });
      break;
    }
    case 'monitor': {
      // Thin panel along the back, stand neck and foot in front of it.
      const panel = Math.max(2, Math.min(d * 0.2, 4));
      const footW = Math.min(w * 0.42, 26);
      const footD = d * 0.5;
      content = (
        <>
          <Rect {...common} stroke={undefined} x={-hw} y={-hd} width={w} height={panel} fill={shade(item.color, -0.35)} />
          <Rect {...faint} x={-2} y={-hd + panel} width={4} height={d * 0.2} fill={shade(item.color, -0.2)} />
          <Rect {...faint} x={-footW / 2} y={hd - footD - 1} width={footW} height={footD} cornerRadius={2} fill={shade(item.color, -0.12)} />
        </>
      );
      break;
    }
    case 'pc-tower':
      content = (
        <>
          <Line {...faint} stroke={withAlpha('#ffffff', 0.25)} points={[-hw + 3, hd - 4, hw - 3, hd - 4]} />
          <Circle {...common} stroke={undefined} x={0} y={hd - 8} radius={Math.min(w, d) * 0.08} fill={withAlpha('#ffffff', 0.55)} />
        </>
      );
      break;
    case 'console':
      content = <Line {...faint} stroke={withAlpha('#ffffff', 0.3)} points={[0, -hd + 2, 0, hd - 2]} />;
      break;
    case 'generic':
      content = (
        <>
          <Line {...faint} points={[-hw, -hd, hw, hd]} />
          <Line {...faint} points={[hw, -hd, -hw, hd]} />
        </>
      );
      break;
    case 'sit-stand-desk':
      // Height control panel at the front right.
      if (w >= 40) {
        content = <Rect {...common} x={hw - 22} y={hd - 5} width={12} height={4} cornerRadius={1} fill={shade(item.color, 0.25)} />;
      }
      break;
    default:
      content = null;
  }
  return <Group listening={false}>{content}</Group>;
}
