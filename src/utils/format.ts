/** Rounds to at most one decimal and drops trailing zeros: 42, 42.5. */
export function formatNumber(value: number, decimals = 1): string {
  const f = 10 ** decimals;
  const rounded = Math.round(value * f) / f;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

export const formatCm = (value: number) => `${formatNumber(value)} cm`;

export const formatSize = (width: number, depth: number) => `${formatNumber(width)} × ${formatNumber(depth)}`;

/** Footprint size: "Ø 90" for circles, "160 × 80" for everything else. */
export const formatFootprint = (width: number, depth: number, circle: boolean) =>
  circle ? `Ø ${formatNumber(width)}` : formatSize(width, depth);

/** cm² → "12.16 m²" */
export const formatArea = (cm2: number) => `${(cm2 / 10_000).toFixed(2)} m²`;

export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** Local calendar date as YYYY-MM-DD. */
export function localDateString(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
