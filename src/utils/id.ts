let counter = 0;

/** Short unique id, e.g. `item_lz3k9a1f_4`. Unique enough for a local, single-user document. */
export function createId(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}${counter.toString(36)}`;
}
