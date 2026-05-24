/**
 * Rental estimate schemas.
 *
 * Mirrors the Prisma RentalEstimate model + a curated comparable shape
 * derived from RentCast's response. Field names are normalized to our
 * camelCase house style at the integration boundary.
 */

import { z } from "zod";

export const RentalSourceSchema = z.enum([
  "RENTCAST",
  "ATTOM",
  "ZILLOW_ZESTIMATE",
  "ZILLOW",
  "HUD_FMR",
  "MANUAL",
  "MOCK",
]);
export type RentalSource = z.infer<typeof RentalSourceSchema>;

export const ComparableRentalSchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  propertyType: z.string(),
  bedrooms: z.number().nonnegative().optional(),
  bathrooms: z.number().nonnegative().optional(),
  squareFootage: z.number().positive().optional(),
  yearBuilt: z.number().int().optional(),
  /** Monthly rent the comp listed at, in dollars. */
  monthlyRent: z.number().positive(),
  /** Distance from subject in miles. */
  distanceMiles: z.number().nonnegative().optional(),
  /** Days since the comp was last seen on the market. */
  daysOld: z.number().int().nonnegative().optional(),
  /** Correlation score (0–1). Higher = more similar to subject. */
  correlation: z.number().min(0).max(1).optional(),
  status: z.string().optional(),
  listedDate: z.string().optional(),
});
export type ComparableRental = z.infer<typeof ComparableRentalSchema>;

export const YieldMetricsSchema = z.object({
  /** Annualized rent / list price, expressed as a percent. */
  rentToPricePct: z.number(),
  /** Gross rent multiplier = list price / annual rent. */
  grossRentMultiplier: z.number(),
  /** Whether the property meets the "1% rule" (monthly rent >= 1% of price). */
  meetsOnePercentRule: z.boolean(),
});
export type YieldMetrics = z.infer<typeof YieldMetricsSchema>;

export const RentalEstimateSchema = z.object({
  source: RentalSourceSchema,
  /** Point estimate in dollars per month. */
  estimatedRent: z.number().positive(),
  /** Lower bound from the AVM. */
  rentLow: z.number().positive().optional(),
  /** Upper bound from the AVM. */
  rentHigh: z.number().positive().optional(),
  /** Default occupancy assumption (e.g. 95%). */
  occupancyRatePct: z.number().min(0).max(100).optional(),
  comparables: z.array(ComparableRentalSchema),
  yieldMetrics: YieldMetricsSchema.optional(),
});
export type RentalEstimate = z.infer<typeof RentalEstimateSchema>;
