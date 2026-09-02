/**
 * A rendered progress width must always be a valid percentage. `(current / total) * 100` is `NaN`
 * for `0/0` and `Infinity` for `n/0`, and both are invalid CSS/style widths — extracted as a pure
 * function so it clamps consistently everywhere it is used, and so it can be tested without
 * rendering.
 */
export function missionProgressPercent(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (current / total) * 100));
}
