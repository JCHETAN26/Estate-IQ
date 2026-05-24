/**
 * Monthly operating expense breakdown for a property.
 *
 * Splits expenses into three buckets:
 *
 *   PITI + HOA          — fixed costs the lender / association charges:
 *                         principal+interest, taxes, insurance, HOA, PMI.
 *
 *   Operating reserves  — variable costs investors set aside but pay
 *                         only as needed: maintenance and vacancy. Both
 *                         are expressed as a percentage of monthly rent
 *                         per industry convention.
 *
 *   Property management — also a percentage of rent. Treated as
 *                         operating because investors who self-manage
 *                         set this to 0.
 *
 * The split matters for downstream cash-flow math:
 *   - NOI excludes financing costs but includes operating costs.
 *   - Cash flow subtracts everything.
 */

import type { MortgageBreakdown } from "./mortgage.js";

export type ExpenseInputs = {
  mortgage: MortgageBreakdown;
  /** Annual property tax in dollars. */
  propertyTaxAnnual: number;
  /** Annual insurance in dollars. */
  insuranceAnnual: number;
  /** Monthly HOA dues. */
  hoaMonthly: number;
  /** Monthly rent — used to scale percentage-based operating expenses. */
  monthlyRent: number;
  /** Vacancy reserve as a percent (0–100) of rent. */
  vacancyPctOfRent: number;
  /** Maintenance reserve as a percent (0–100) of rent. */
  maintenancePctOfRent: number;
  /** Property management as a percent (0–100) of rent. */
  managementPctOfRent: number;
};

export type ExpenseBreakdown = {
  /** Lender / association fixed costs. */
  monthlyPrincipalAndInterest: number;
  monthlyTaxes: number;
  monthlyInsurance: number;
  monthlyHoa: number;
  monthlyPmi: number;
  /** PITI + HOA + PMI rolled into a single monthly figure. */
  monthlyFixedTotal: number;

  /** Operating expenses (rent-scaled). */
  monthlyVacancyReserve: number;
  monthlyMaintenanceReserve: number;
  monthlyManagement: number;
  monthlyOperatingTotal: number;

  /** Sum of fixed + operating. */
  monthlyExpenseTotal: number;
};

export function calculateExpenses(inputs: ExpenseInputs): ExpenseBreakdown {
  const monthlyTaxes = round2(Math.max(0, inputs.propertyTaxAnnual) / 12);
  const monthlyInsurance = round2(Math.max(0, inputs.insuranceAnnual) / 12);
  const monthlyHoa = round2(Math.max(0, inputs.hoaMonthly));
  const monthlyPmi = round2(Math.max(0, inputs.mortgage.pmiMonthly));
  const monthlyPrincipalAndInterest = round2(
    Math.max(0, inputs.mortgage.monthlyPrincipalAndInterest),
  );
  const monthlyFixedTotal = round2(
    monthlyPrincipalAndInterest + monthlyTaxes + monthlyInsurance + monthlyHoa + monthlyPmi,
  );

  const rent = Math.max(0, inputs.monthlyRent);
  const monthlyVacancyReserve = round2((rent * clampPct(inputs.vacancyPctOfRent)) / 100);
  const monthlyMaintenanceReserve = round2((rent * clampPct(inputs.maintenancePctOfRent)) / 100);
  const monthlyManagement = round2((rent * clampPct(inputs.managementPctOfRent)) / 100);
  const monthlyOperatingTotal = round2(
    monthlyVacancyReserve + monthlyMaintenanceReserve + monthlyManagement,
  );

  const monthlyExpenseTotal = round2(monthlyFixedTotal + monthlyOperatingTotal);

  return {
    monthlyPrincipalAndInterest,
    monthlyTaxes,
    monthlyInsurance,
    monthlyHoa,
    monthlyPmi,
    monthlyFixedTotal,
    monthlyVacancyReserve,
    monthlyMaintenanceReserve,
    monthlyManagement,
    monthlyOperatingTotal,
    monthlyExpenseTotal,
  };
}

function clampPct(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
