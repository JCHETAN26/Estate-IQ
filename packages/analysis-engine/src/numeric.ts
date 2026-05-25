/**
 * Numeric helpers shared across the analysis engine and the API
 * services that wrap it.
 *
 * All money math in EstateIQ rounds to 2 decimal places (cents).
 * Percent metrics (cap rate, CoC, rent-to-price) round to 3 decimal
 * places so a basis-point difference is still visible. Bookings /
 * counts that are reported with one decimal use round1.
 *
 * Pure functions, no I/O.
 */

/** Round to one decimal place. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Round to two decimal places (cents). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Round to three decimal places (basis points on a percent). */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Clamp a number into [min, max]. NaN coerces to `min`.
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Clamp to [0, 100] — the standard percent range used in this engine. */
export function clampPct(value: number): number {
  return clamp(value, 0, 100);
}
