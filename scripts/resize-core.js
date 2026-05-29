// scripts/resize-core.js
// Pure resize math. No Foundry, DOM, or browser globals — unit-tested under node:test.

/**
 * Clamp a numeric size to [min, max].
 * @param {number} value  Candidate size.
 * @param {number} min    Lower bound (also the fallback for non-finite input).
 * @param {number|null} max  Upper bound, or null/undefined for no upper bound.
 * @returns {number}
 */
export function clampSize(value, min, max) {
  if (!Number.isFinite(value)) {
    return value === Infinity && max != null ? max : min;
  }
  if (value < min) return min;
  if (max != null && value > max) return max;
  return value;
}

/**
 * Parse a CSS pixel value or bare number into a finite number.
 * @param {string|number|null|undefined} value
 * @returns {number|null}  The number, or null if it cannot be parsed.
 */
export function parsePx(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute a new size during a drag. Size grows as the pointer moves toward a
 * smaller coordinate (left for width, up for height): the resize handle sits on
 * the inner/top edge, matching the original module's behaviour.
 * @param {number} startSize     Size (px) when the drag began.
 * @param {number} startCoord    Pointer coordinate (px) when the drag began.
 * @param {number} currentCoord  Current pointer coordinate (px).
 * @param {number} min           Lower bound.
 * @param {number|null} max      Upper bound, or null for none.
 * @returns {number}  Clamped, whole-pixel size.
 */
export function computeDragSize(startSize, startCoord, currentCoord, min, max) {
  const next = Math.round(startSize + (startCoord - currentCoord));
  return clampSize(next, min, max);
}
