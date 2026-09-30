/** Tiny color helpers for hex colors (#rgb or #rrggbb). */

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && parseHex(value) !== null;
}

/** Mixes the color towards black (amount > 0) or white (amount < 0). */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount > 0 ? 0 : 255;
  const t = Math.abs(amount);
  return toHex(...(rgb.map((c) => c + (target - c) * t) as [number, number, number]));
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/** Relative luminance (0..1). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or light text color that stays readable on `background`. */
export function readableTextColor(background: string): { primary: string; secondary: string } {
  return luminance(background) > 0.32
    ? { primary: '#1d1f23', secondary: 'rgba(29, 31, 35, 0.62)' }
    : { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.72)' };
}
