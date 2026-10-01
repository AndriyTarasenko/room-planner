/** Rotation snapping for the rotate handle and the rotate keys. Pure functions. */
import { type Point, normalizeAngle } from './rect';

/** Shift on the rotate handle, and the [ and ] keys, turn in steps of this many degrees. */
export const ROTATION_STEP = 15;
/** How close (in degrees) the rotate handle has to come to a snap angle to stick to it. */
export const ROTATION_SNAP_TOLERANCE = 4;

const QUARTER_AND_DIAGONALS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Drops floating noise (89.99999999 → 90) and keeps the angle in [0, 360). */
const clean = (deg: number) => normalizeAngle(Math.round(deg * 1e6) / 1e6);

/** Distance between two angles the short way round, in degrees (0–180). */
export function angleDistance(a: number, b: number): number {
  const d = normalizeAngle(a - b);
  return Math.min(d, 360 - d);
}

/**
 * Angles at which an item lines up with a room: the multiples of 45°, plus, for each slanted
 * wall, the four angles that put the item's sides parallel to that wall. `corners` is the
 * room's outline. Sorted, without duplicates.
 */
export function rotationSnapAngles(corners: readonly Point[]): number[] {
  const angles = [...QUARTER_AND_DIAGONALS];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length];
    if (a.x === b.x && a.y === b.y) return;
    const wall = normalizeAngle((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 90;
    for (let k = 0; k < 4; k++) {
      const angle = clean(wall + k * 90);
      if (!angles.some((s) => angleDistance(s, angle) < 0.01)) angles.push(angle);
    }
  });
  return angles.sort((p, q) => p - q);
}

export interface RotationSnapOptions {
  /** Round to multiples of this many degrees (the handle with Shift held). */
  step?: number;
  /** Angles the rotation sticks to when it comes within `tolerance` of one (see rotationSnapAngles). */
  targets?: readonly number[];
  tolerance?: number;
}

/**
 * Where the rotate handle puts an item turned to `raw` degrees: on the nearest `step`, else on
 * the closest target within the tolerance, else on a whole degree. Always in [0, 360).
 */
export function snapRotation(raw: number, options: RotationSnapOptions = {}): number {
  const angle = normalizeAngle(raw);
  if (options.step) return clean(Math.round(angle / options.step) * options.step);
  const tolerance = options.tolerance ?? ROTATION_SNAP_TOLERANCE;
  let best: number | null = null;
  for (const target of options.targets ?? []) {
    const d = angleDistance(angle, target);
    if (d <= tolerance && (best === null || d < angleDistance(angle, best))) best = target;
  }
  return best ?? clean(Math.round(angle));
}

/**
 * The next multiple of `step` from `rotation`, clockwise (`direction` 1) or counter-clockwise
 * (−1). An item between steps goes to the nearer one in that direction first, so odd angles
 * get back onto the steps.
 */
export function stepRotation(rotation: number, direction: 1 | -1, step = ROTATION_STEP): number {
  const units = normalizeAngle(rotation) / step;
  const nearest = Math.round(units);
  const next = Math.abs(units - nearest) < 1e-6 ? nearest + direction : direction > 0 ? Math.ceil(units) : Math.floor(units);
  return clean(next * step);
}
