/**
 * Internal RentCast API response schemas.
 *
 * Defined here (not in @estate-iq/shared) because they are
 * vendor-specific. Consumers of this integration receive normalized
 * RentalEstimate / ComparableRental shapes from the service layer.
 */

import { z } from "zod";

export const RentcastSubjectPropertySchema = z
  .object({
    formattedAddress: z.string().optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    propertyType: z.string().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    squareFootage: z.number().optional(),
    yearBuilt: z.number().optional(),
  })
  .passthrough();

export const RentcastComparableSchema = z
  .object({
    formattedAddress: z.string().optional(),
    addressLine1: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    propertyType: z.string().optional(),
    bedrooms: z.number().optional(),
    bathrooms: z.number().optional(),
    squareFootage: z.number().optional(),
    yearBuilt: z.number().optional(),
    status: z.string().optional(),
    /** RentCast surfaces monthly rent as `price` on rental comps. */
    price: z.number().positive(),
    listedDate: z.string().optional(),
    distance: z.number().optional(),
    daysOnMarket: z.number().optional(),
    daysOld: z.number().optional(),
    correlation: z.number().optional(),
  })
  .passthrough();

export const RentcastRentEstimateSchema = z
  .object({
    rent: z.number().positive(),
    rentRangeLow: z.number().positive().optional(),
    rentRangeHigh: z.number().positive().optional(),
    subjectProperty: RentcastSubjectPropertySchema.optional(),
    comparables: z.array(RentcastComparableSchema).default([]),
  })
  .passthrough();

export type RentcastRentEstimate = z.infer<typeof RentcastRentEstimateSchema>;

export type RentcastClientError =
  | { kind: "auth"; message: string }
  | { kind: "rate_limited"; message: string; retryAfterSeconds?: number }
  | { kind: "not_found"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "schema_mismatch"; message: string }
  | { kind: "network"; message: string }
  | { kind: "no_api_key"; message: string };
