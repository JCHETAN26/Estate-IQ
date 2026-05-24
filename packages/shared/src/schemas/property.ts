/**
 * Property domain schemas.
 *
 * Mirrors the Prisma Property model. Used by the listing parser, the
 * MCP tool layer, and (later) the frontend. All decimal money fields
 * are represented as numbers here; the persistence layer converts
 * to/from Prisma's Decimal type at the boundary.
 */

import { z } from "zod";

export const PropertyTypeSchema = z.enum([
  "SINGLE_FAMILY",
  "MULTI_FAMILY",
  "CONDO",
  "TOWNHOUSE",
  "APARTMENT",
  "OTHER",
]);
export type PropertyType = z.infer<typeof PropertyTypeSchema>;

export const PropertySchema = z.object({
  sourceUrl: z.string().url(),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, "state must be a 2-letter US code"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "zipCode must be 5 or 9 digits"),
  listPrice: z.number().positive(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().nonnegative(),
  squareFeet: z.number().int().positive().optional(),
  lotSizeSqft: z.number().int().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  propertyType: PropertyTypeSchema.default("SINGLE_FAMILY"),
  hoaMonthly: z.number().nonnegative().optional(),
  taxesAnnual: z.number().nonnegative().optional(),
  insuranceAnnual: z.number().nonnegative().optional(),
  description: z.string().optional(),
});
export type Property = z.infer<typeof PropertySchema>;
