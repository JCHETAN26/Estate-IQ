/**
 * @estate-iq/analysis-engine
 *
 * Pure financial underwriting logic. No I/O, no Prisma, no fetch — every
 * function is deterministic given its inputs. The MCP tools wrap these
 * functions and add validation + persistence.
 */

import { SHARED_PACKAGE_NAME } from "@estate-iq/shared";

export const ANALYSIS_ENGINE_PACKAGE_NAME = "@estate-iq/analysis-engine" as const;

/** Sanity check that workspace resolution to @estate-iq/shared is wired. */
export function describeStack(): string {
  return `${ANALYSIS_ENGINE_PACKAGE_NAME} depends on ${SHARED_PACKAGE_NAME}`;
}

export {
  calculateMortgage,
  monthlyAmortizedPayment,
  type MortgageInputs,
  type MortgageBreakdown,
} from "./mortgage.js";

export { calculateExpenses, type ExpenseInputs, type ExpenseBreakdown } from "./expenses.js";

export { calculateCashFlow, type CashFlowInputs, type CashFlowResult } from "./cashflow.js";

export {
  analyzeAirbnb,
  type AirbnbInputs,
  type AirbnbAnalysis,
  type StrRiskLevel,
} from "./airbnb.js";

export {
  calculateInvestmentScore,
  type InvestmentScoreInputs,
  type InvestmentScoreResult,
  type FactorScore,
} from "./scoring.js";
