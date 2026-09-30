let ctx: CanvasRenderingContext2D | null | undefined;

/** Text width in px for a CSS font string, using a shared offscreen canvas. */
export function measureTextWidth(text: string, font: string): number {
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!ctx) return text.length * 6.5;
  ctx.font = font;
  return ctx.measureText(text).width;
}
