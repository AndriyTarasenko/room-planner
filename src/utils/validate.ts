/** Small helpers for reading untrusted JSON (imported files, localStorage, network responses). */

export type Json = Record<string, unknown>;

export const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const str = (v: unknown, fallback: string, maxLength = 2000) => (typeof v === 'string' ? v.slice(0, maxLength) : fallback);

/** Trimmed non-empty string, or undefined. */
export function optionalStr(v: unknown, maxLength = 200): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, maxLength);
  return s || undefined;
}

export const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

export const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;

/**
 * An http(s) URL, or undefined. Links and images from files or the network go through this,
 * so a crafted `javascript:` or `data:` URL can never end up in an `href` or `src`.
 */
export function safeHttpUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 2000) return undefined;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A YYYY-MM-DD date string, or undefined. */
export function isoDate(v: unknown): string | undefined {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}
