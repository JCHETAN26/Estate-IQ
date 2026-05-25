/**
 * Rental yield helpers.
 *
 * Three classic screening metrics:
 *   - Rent-to-price (annualized): annual rent / price * 100
 *   - Gross rent multiplier (GRM): price / annual rent
 *   - 1% rule: monthly rent >= 1% of price
 *
 * Pure functions, no I/O.
 */

import { round2, round3 } from "@estate-iq/analysis-engine";
import type { YieldMetrics } from "@estate-iq/shared";

export function computeYieldMetrics(monthlyRent: number, listPrice: number): YieldMetrics {
  const safeRent = Math.max(0, monthlyRent);
  const safePrice = Math.max(0, listPrice);
  const annualRent = safeRent * 12;

  const rentToPricePct = safePrice > 0 ? round3((annualRent / safePrice) * 100) : 0;
  const grossRentMultiplier = annualRent > 0 ? round2(safePrice / annualRent) : 0;
  const meetsOnePercentRule = safePrice > 0 && safeRent / safePrice >= 0.01;

  return { rentToPricePct, grossRentMultiplier, meetsOnePercentRule };
}
