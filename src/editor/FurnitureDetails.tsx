import type { ReactNode } from 'react';
import { Circle, Ellipse, Group, Line, Rect } from 'react-konva';
import { lArms } from '../geometry/footprint';
import type { FurnitureItem } from '../types';
import { shade, withAlpha } from '../utils/color';

interface DetailStyles {
  common: { stroke: string; strokeWidth: number; strokeScaleEnabled: false; listening: false };
  faint: DetailStyles['common'];
  color: string;
}

/** Evenly spaced dividers along a run of `length` cm: one per `module` cm, at least one part. */
function dividers(length: number, module: number): number[] {
  const parts = Math.max(1, Math.round(length / module));
  return Array.from({ length: parts - 1 }, (_, i) => (length / parts) * (i + 1));
}

/**
 * Details of L-shaped items, drawn for a return on the right (the caller mirrors them for a
 * left return). The main part runs along the back with depth `s`; the return leg is `r` wide.
 */
function lShapedDetails(item: FurnitureItem, s: number, r: number, { common, faint, color }: DetailStyles): ReactNode {
  const hw = item.width / 2;
  const hd = item.depth / 2;
  const legX = hw - r;
  switch (item.type) {
    case 'sofa': {
      // Backrest along the back, an arm at the far end of the main part and along the outer side of the return.
      const back = Math.min(s * 0.24, 22);
      const arm = Math.min(Math.min(s, r) * 0.2, 18);
      const fill = shade(color, 0.08);
      return (
        <>
          <Rect {...common} x={-hw} y={-hd} width={item.width} height={back} fill={fill} />
          <Rect {...common} x={-hw} y={-hd + back} width={arm} height={s - back} fill={fill} />
          <Rect {...common} x={hw - arm} y={-hd + back} width={arm} height={item.depth - back} fill={fill} />
          <Line {...faint} points={[legX, -hd + back, legX, -hd + s]} />
          {dividers(legX - (-hw + arm), 70).map((x) => (
            <Line key={`m${x}`} {...faint} points={[-hw + arm + x, -hd + back, -hw + arm + x, -hd + s]} />
          ))}
          {dividers(item.depth - s, 70).map((y) => (
            <Line key={`r${y}`} {...faint} points={[legX, -hd + s + y, hw - arm, -hd + s + y]} />
          ))}
        </>
      );
    }
    case 'kitchen-cabinet': {
      // Cabinet modules of about 60 cm plus the front edge along the inner side of the L.
      const run = legX + hw;
      const leg = item.depth - s;
      return (
        <>
          {[...dividers(run, 60), run].map((x) => (
            <Line key={`m${x}`} {...faint} points={[-hw + x, -hd + 2, -hw + x, -hd + s - 2]} />
          ))}
          {[0, ...dividers(leg, 60)].map((y) => (
            <Line key={`r${y}`} {...faint} points={[legX + 2, -hd + s + y, hw - 2, -hd + s + y]} />
          ))}
          <Line {...common} points={[-hw + 2, -hd + s - 3, legX + 3, -hd + s - 3, legX + 3, hd - 2]} />
        </>
      );
    }
    default:
      // Other kinds have no L-specific details; drawing their rectangular ones would spill into the notch.
      return null;
  }
}

/**
 * Foliage seen from above: an outer ring of leaves and a smaller inner one, drawn for a
 * radius of 50 and scaled to the item, so ovals get stretched leaves.
 */
function plantLeaves(rx: number, ry: number, color: string, common: DetailStyles['common']): ReactNode {
  const leaf = (key: string, angle: number, distance: number, length: number, width: number, fill: string) => {
    const a = (angle * Math.PI) / 180;
    return (
      <Ellipse key={key} {...common} x={Math.cos(a) * distance} y={Math.sin(a) * distance} radiusX={length} radiusY={width} rotation={angle} fill={fill} />
    );
  };
  return (
    <Group scaleX={rx / 50} scaleY={ry / 50}>
      {Array.from({ length: 8 }, (_, i) => leaf(`o${i}`, i * 45, 25, 21, 9, shade(color, i % 2 ? 0.16 : 0.24)))}
      {Array.from({ length: 5 }, (_, i) => leaf(`i${i}`, i * 72 + 20, 10, 12, 6, shade(color, 0.32)))}
    </Group>
  );
}

/** Details of round and oval items, which have to stay inside the ellipse. */
function roundDetails(item: FurnitureItem, { common, faint, color }: DetailStyles): ReactNode {
  const rx = item.width / 2;
  const ry = item.depth / 2;
  switch (item.type) {
    case 'table': {
      // Tabletop edge.
      const inset = Math.min(3, rx * 0.1, ry * 0.1);
      return <Ellipse {...faint} radiusX={rx - inset} radiusY={ry - inset} />;
    }
    case 'pouf':
      // Upholstered top with a button in the middle.
      return (
        <>
          <Ellipse {...faint} radiusX={rx * 0.7} radiusY={ry * 0.7} fill={shade(color, -0.14)} />
          <Circle {...common} radius={Math.min(2, rx * 0.1, ry * 0.1)} fill={shade(color, 0.25)} />
        </>
      );
    case 'plant':
      return plantLeaves(rx, ry, color, common);
    case 'generic': {
      // The cross of the rectangular object, ending on the outline.
      const k = Math.SQRT1_2;
      return (
        <>
          <Line {...faint} points={[-rx * k, -ry * k, rx * k, ry * k]} />
          <Line {...faint} points={[rx * k, -ry * k, -rx * k, ry * k]} />
        </>
      );
    }
    default:
      // Other kinds' details are drawn for rectangles and would poke out of the outline.
      return null;
  }
}

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

  if (item.shape.kind === 'l') {
    const { main, leg } = lArms(w, d, item.shape);
    const content = lShapedDetails(item, main, leg, { common, faint, color: item.color });
    return (
      content && (
        <Group listening={false} scaleX={item.shape.returnSide === 'left' ? -1 : 1}>
          {content}
        </Group>
      )
    );
  }

  if (item.shape.kind === 'round') {
    const content = roundDetails(item, { common, faint, color: item.color });
    return content && <Group listening={false}>{content}</Group>;
  }

  let content: ReactNode;
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
    case 'chair': {
      // Backrest along the back (local −y), seat in front of it.
      content = (
        <>
          <Rect {...common} x={-hw + 3} y={-hd + d * 0.2} width={w - 6} height={d * 0.74} cornerRadius={Math.min(w, d) * 0.08} fill={insetFill} />
          <Rect {...common} x={-hw + 1} y={-hd + 1} width={w - 2} height={d * 0.14} cornerRadius={d * 0.05} fill={shade(item.color, 0.15)} />
        </>
      );
      break;
    }
    case 'armchair':
    case 'sofa': {
      const armchair = item.type === 'armchair';
      const back = Math.min(d * 0.24, 22);
      const arm = Math.min(w * (armchair ? 0.17 : 0.1), 18);
      const seats = armchair ? 1 : Math.max(1, Math.round((w - arm * 2) / 70));
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
    case 'pouf': {
      // A square pouf or footstool: upholstered top with a button in the middle.
      const inset = Math.min(w, d) * 0.15;
      content = (
        <>
          <Rect {...faint} x={-hw + inset} y={-hd + inset} width={w - inset * 2} height={d - inset * 2} cornerRadius={Math.min(w, d) * 0.12} fill={insetFill} />
          <Circle {...common} radius={Math.min(2, w * 0.05, d * 0.05)} fill={shade(item.color, 0.25)} />
        </>
      );
      break;
    }
    case 'plant':
      content = plantLeaves(hw, hd, item.color, common);
      break;
    case 'bed': {
      // Frame with the mattress inside; headboard at the back (local −y), two pillows for double beds.
      const side = Math.min(7, w * 0.05);
      const head = Math.min(10, d * 0.06);
      const mx = -hw + side;
      const my = -hd + head;
      const mw = w - side * 2;
      const md = d - head - side;
      const pillows = mw >= 110 ? 2 : 1;
      const gap = 5;
      const pw = (mw - gap * (pillows + 1)) / pillows;
      const ph = Math.min(md * 0.14, 30);
      content = (
        <>
          <Rect {...faint} x={mx} y={my} width={mw} height={md} cornerRadius={3} fill={shade(item.color, -0.14)} />
          {Array.from({ length: pillows }, (_, i) => (
            <Rect key={i} {...common} x={mx + gap + i * (pw + gap)} y={my + gap} width={pw} height={ph} cornerRadius={4} fill={insetFill} />
          ))}
          <Line {...faint} points={[mx, my + md * 0.3, mx + mw, my + md * 0.3]} />
        </>
      );
      break;
    }
    case 'desk':
    case 'table': {
      // Tabletop edge.
      const inset = Math.min(3, w * 0.05, d * 0.05);
      content = <Rect {...faint} x={-hw + inset} y={-hd + inset} width={w - inset * 2} height={d - inset * 2} cornerRadius={item.type === 'table' ? 2 : 1} />;
      break;
    }
    case 'wardrobe':
    case 'sideboard':
    case 'kitchen-cabinet': {
      // Doors (kitchen: cabinet modules) and the front edge, which marks the opening side.
      const doorWidth = item.type === 'wardrobe' ? 50 : item.type === 'kitchen-cabinet' ? 60 : 40;
      content = (
        <>
          {dividers(w, doorWidth).map((x) => (
            <Line key={x} {...faint} points={[-hw + x, -hd + 2, -hw + x, hd - 2]} />
          ))}
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'sink': {
      // Basin set into the counter, tap behind it, cabinet front below.
      const bw = Math.min(w * 0.55, 50);
      const bd = Math.min(d * 0.6, 42);
      const by = -hd + (d - bd) / 2 + d * 0.04;
      content = (
        <>
          <Rect {...common} x={-bw / 2} y={by} width={bw} height={bd} cornerRadius={Math.min(bw, bd) * 0.12} fill={insetFill} />
          <Circle {...common} x={0} y={(by - hd) / 2} radius={1.5} fill={line} />
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'stove': {
      // Burners in a grid (three columns for wide ranges), oven door along the front.
      const cols = w >= 75 ? 3 : w >= 45 ? 2 : 1;
      const cellW = (w - 6) / cols;
      const cellD = (d - 8) / 2;
      const r = Math.min(cellW, cellD) * 0.32;
      content = (
        <>
          {Array.from({ length: cols * 2 }, (_, i) => {
            const x = -hw + 3 + cellW * ((i % cols) + 0.5);
            const y = -hd + 2 + cellD * (Math.floor(i / cols) + 0.5);
            return (
              <Group key={i}>
                <Circle {...common} x={x} y={y} radius={r} />
                <Circle {...faint} x={x} y={y} radius={r * 0.55} />
              </Group>
            );
          })}
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'appliance': {
      // Top panel and the door along the front.
      const inset = Math.min(3, w * 0.05, d * 0.05);
      content = (
        <>
          <Rect {...faint} x={-hw + inset} y={-hd + inset} width={w - inset * 2} height={d - inset * 2 - 4} cornerRadius={1} />
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'washer': {
      // Round drum door, the usual plan symbol for washing machines and dryers.
      const r = Math.min(w, d) * 0.32;
      content = (
        <>
          <Circle {...common} x={0} y={d * 0.04} radius={r} fill={insetFill} />
          <Circle {...faint} x={0} y={d * 0.04} radius={r * 0.65} />
          <Line {...common} points={[-hw + 2, hd - 3, hw - 2, hd - 3]} />
        </>
      );
      break;
    }
    case 'toilet': {
      // Cistern against the back wall (local −y), bowl and seat opening in front of it.
      const tank = d * 0.28;
      const bowlD = d - tank - 2;
      content = (
        <>
          <Rect {...common} x={-w * 0.45} y={-hd + 1} width={w * 0.9} height={tank - 1} cornerRadius={2} fill={shade(item.color, 0.08)} />
          <Ellipse {...common} x={0} y={-hd + tank + bowlD / 2} radiusX={w * 0.42} radiusY={bowlD / 2} fill={insetFill} />
          <Ellipse {...faint} x={0} y={-hd + tank + bowlD * 0.55} radiusX={w * 0.24} radiusY={bowlD * 0.3} />
        </>
      );
      break;
    }
    case 'washbasin': {
      // Oval basin with the tap behind it at the back (local −y).
      const rx = Math.min(w * 0.36, 26);
      const ry = Math.min(d * 0.3, 18);
      const cy = -hd + d * 0.56;
      content = (
        <>
          <Ellipse {...common} x={0} y={cy} radiusX={rx} radiusY={ry} fill={insetFill} />
          <Rect {...common} x={-1.5} y={-hd + 3} width={3} height={Math.max(2, cy - ry + hd - 5)} cornerRadius={1} fill={line} />
        </>
      );
      break;
    }
    case 'shower': {
      // Tray with the diagonal cross of floor-plan showers.
      const inset = Math.min(4, w * 0.05, d * 0.05);
      content = (
        <>
          <Rect {...common} x={-hw + inset} y={-hd + inset} width={w - inset * 2} height={d - inset * 2} cornerRadius={2} fill={insetFill} />
          <Line {...faint} points={[-hw + inset, -hd + inset, hw - inset, hd - inset]} />
          <Line {...faint} points={[hw - inset, -hd + inset, -hw + inset, hd - inset]} />
        </>
      );
      break;
    }
    case 'bathtub': {
      // Rim around a rounded basin, drain at the tap end (local −x).
      const rim = Math.min(7, w * 0.08, d * 0.1);
      const iw = w - rim * 2;
      const id = d - rim * 2;
      content = (
        <>
          <Rect {...common} x={-hw + rim} y={-hd + rim} width={iw} height={id} cornerRadius={Math.min(iw, id) * 0.3} fill={insetFill} />
          <Circle {...common} x={-hw + rim + Math.min(12, iw * 0.12)} y={0} radius={Math.min(2.5, id * 0.06)} />
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
    case 'monitor':
    case 'tv': {
      // Thin panel along the back, stand neck and foot in front of it.
      const panel = Math.max(2, Math.min(d * 0.2, 4));
      const footW = item.type === 'tv' ? w * 0.4 : Math.min(w * 0.42, 26);
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
    case 'sit-stand-desk': {
      // Tabletop edge plus the height control panel at the front right.
      const inset = Math.min(3, w * 0.05, d * 0.05);
      content = (
        <>
          <Rect {...faint} x={-hw + inset} y={-hd + inset} width={w - inset * 2} height={d - inset * 2} cornerRadius={1} />
          {w >= 40 && <Rect {...common} x={hw - 22} y={hd - 5} width={12} height={4} cornerRadius={1} fill={shade(item.color, 0.25)} />}
        </>
      );
      break;
    }
    default:
      content = null;
  }
  return <Group listening={false}>{content}</Group>;
}
