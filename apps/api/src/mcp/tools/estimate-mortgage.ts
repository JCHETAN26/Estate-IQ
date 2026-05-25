/**
 * MCP tool: estimate_mortgage
 *
 * Wraps @estate-iq/analysis-engine.calculateMortgage and rolls in the
 * tax/insurance/HOA line items so callers get a single PITI figure.
 */

import { calculateExpenses, calculateMortgage, round3 } from "@estate-iq/analysis-engine";
import { EstimateMortgageInputSchema, EstimateMortgageOutputSchema } from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const estimateMortgageTool = defineTool({
  name: "estimate_mortgage",
  description:
    "Estimate the monthly mortgage payment given financing assumptions (PITI + HOA + PMI). Returns a deterministic breakdown.",
  inputSchema: EstimateMortgageInputSchema,
  outputSchema: EstimateMortgageOutputSchema,
  async handler(input) {
    const mortgage = calculateMortgage({
      listPrice: input.listPrice,
      downPaymentPct: input.downPaymentPct,
      interestRatePct: input.interestRatePct,
      loanTermYears: input.loanTermYears,
    });
    const expenses = calculateExpenses({
      mortgage,
      propertyTaxAnnual: input.propertyTaxAnnual,
      insuranceAnnual: input.insuranceAnnual,
      hoaMonthly: input.hoaMonthly,
      // Operating reserves are a cash-flow concept; not relevant here.
      monthlyRent: 0,
      vacancyPctOfRent: 0,
      maintenancePctOfRent: 0,
      managementPctOfRent: 0,
    });

    return {
      status: "ok" as const,
      loanAmount: mortgage.loanAmount,
      downPayment: mortgage.downPayment,
      ltv: round3(mortgage.ltv),
      monthlyPrincipalAndInterest: mortgage.monthlyPrincipalAndInterest,
      monthlyTaxes: expenses.monthlyTaxes,
      monthlyInsurance: expenses.monthlyInsurance,
      monthlyHoa: expenses.monthlyHoa,
      monthlyPmi: mortgage.pmiMonthly,
      monthlyPaymentTotal: expenses.monthlyFixedTotal,
      totalInterestOverTerm: mortgage.totalInterestOverTerm,
    };
  },
});
