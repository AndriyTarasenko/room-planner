import { measureTextWidth } from '../utils/measureText';

/** Canvas colors and sizes. Kept in TS because Konva draws outside the CSS cascade. */
export const CANVAS = {
  background: '#e9ebee',
  floor: '#ffffff',
  wall: '#26292e',
  /** Dashed edge of a side without a wall. */
  openSide: 'rgba(38, 41, 46, 0.5)',
  /** Door arcs, window glass, passage edges. */
  opening: 'rgba(38, 41, 46, 0.55)',
  roomName: '#55555e',
  roomMeta: '#8e8e97',
  gridMinor: 'rgba(28, 32, 40, 0.055)',
  gridMajor: 'rgba(28, 32, 40, 0.11)',
  accent: '#2f6bff',
  guide: '#ea3a74',
  danger: '#e5484d',
  warning: '#e38a09',
  dimension: '#6b7280',
  labelDark: '#1d1f23',
  pillDark: '#26292e',
} as const;

export const FONT_FAMILY = "'Inter Variable', 'Segoe UI', system-ui, sans-serif";

/** Value pills on dimension lines. */
export const PILL_FONT = 10.5;
export const PILL_H = 17;

/** Width in px of a value pill showing `text`. */
export const pillWidth = (text: string) => measureTextWidth(text, `600 ${PILL_FONT}px ${FONT_FAMILY}`) + 10;

/** Space around the plan when fitting it to the canvas, in px. */
export const CANVAS_PADDING = 64;
