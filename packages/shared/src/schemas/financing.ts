/**
 * Financing assumption schemas — inputs to mortgage/cashflow calculations.
 */

import { z } from "zod";

export const FinancingAssumptionsSchema = z.object({
  listPrice: z.number().positive(),
  downPaymentPct: z.number().min(0).max(100).default(20),
  interestRatePct: z.number().min(0).max(30).default(7),
  loanTermYears: z.number().int().min(1).max(50).default(30),
  propertyTaxAnnual: z.number().nonnegative().default(0),
  insuranceAnnual: z.number().nonnegative().default(0),
  hoaMonthly: z.number().nonnegative().default(0),
});
export type FinancingAssumptions = z.infer<typeof FinancingAssumptionsSchema>;

export const RentalAssumptionsSchema = z.object({
  monthlyRent: z.number().positive(),
  occupancyRatePct: z.number().min(0).max(100).default(95),
  maintenancePctOfRent: z.number().min(0).max(100).default(8),
  managementPctOfRent: z.number().min(0).max(100).default(8),
});
export type RentalAssumptions = z.infer<typeof RentalAssumptionsSchema>;
