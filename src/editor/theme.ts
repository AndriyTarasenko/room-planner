/** Canvas colors and sizes. Kept in TS because Konva draws outside the CSS cascade. */
export const CANVAS = {
  background: '#e9ebee',
  floor: '#ffffff',
  wall: '#26292e',
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

/** Wall thickness drawn outside the room interior, in screen px. */
export const WALL_PX = 7;

/** Space around the room when fitting it to the canvas, in px. */
export const CANVAS_PADDING = 64;
