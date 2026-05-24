/**
 * MCP tool: calculate_cash_flow
 *
 * Wraps @estate-iq/analysis-engine.calculateCashFlow.
 */

import { calculateCashFlow } from "@estate-iq/analysis-engine";
import { CalculateCashFlowInputSchema, CalculateCashFlowOutputSchema } from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const calculateCashFlowTool = defineTool({
  name: "calculate_cash_flow",
  description:
    "Combine financing and rental assumptions to produce monthly cash flow, NOI, cap rate, and cash-on-cash return.",
  inputSchema: CalculateCashFlowInputSchema,
  outputSchema: CalculateCashFlowOutputSchema,
  async handler({ financing, rental }) {
    const result = calculateCashFlow({
      financing: {
        listPrice: financing.listPrice,
        downPaymentPct: financing.downPaymentPct,
        interestRatePct: financing.interestRatePct,
        loanTermYears: financing.loanTermYears,
        propertyTaxAnnual: financing.propertyTaxAnnual,
        insuranceAnnual: financing.insuranceAnnual,
        hoaMonthly: financing.hoaMonthly,
      },
      rental: {
        monthlyRent: rental.monthlyRent,
        occupancyRatePct: rental.occupancyRatePct,
        maintenancePctOfRent: rental.maintenancePctOfRent,
        managementPctOfRent: rental.managementPctOfRent,
      },
    });

    return {
      status: "ok" as const,
      cashInvested: result.cashInvested,
      monthlyPaymentPITI: result.monthlyPaymentPITI,
      monthlyEffectiveRent: result.monthlyEffectiveRent,
      monthlyCashFlow: result.monthlyCashFlow,
      annualCashFlow: result.annualCashFlow,
      netOperatingIncome: result.netOperatingIncome,
      capRatePct: result.capRatePct,
      cashOnCashPct: result.cashOnCashPct,
    };
  },
});
