/**
 * Cash flow + investment-return metrics.
 *
 * Output metrics required by build-plan Task 2.1:
 *   - Monthly Payment       (PITI + HOA + PMI)
 *   - Cash Flow             (rent − all expenses, after vacancy)
 *   - NOI                   (annualized; excludes financing costs)
 *   - Cap Rate              (NOI / list price)
 *   - Cash-on-Cash Return   (annual cash flow / cash invested)
 *
 * Conventions:
 *   - Percentages are returned as numbers (e.g. 6.42 means 6.42%).
 *   - "Cash invested" includes the down payment plus an estimated 3%
 *     of list price for closing costs. The closing-cost factor is
 *     conservative; investors with cash-back closings can override.
 */

import { calculateExpenses, type ExpenseBreakdown } from "./expenses.js";
import { calculateMortgage, type MortgageBreakdown, type MortgageInputs } from "./mortgage.js";
import { clampPct, round2, round3 } from "./numeric.js";

const DEFAULT_CLOSING_COSTS_PCT = 3.0; // 3% of list price

export type CashFlowInputs = {
  /** Property + financing inputs. */
  financing: MortgageInputs & {
    propertyTaxAnnual?: number;
    insuranceAnnual?: number;
    hoaMonthly?: number;
    /** Defaults to 3% of list price. */
    closingCostsPct?: number;
  };
  rental: {
    monthlyRent: number;
    /** Percent of rent (0–100) the property is occupied. Default 95. */
    occupancyRatePct?: number;
    /** Percent of rent reserved for vacancy. Default = 100 - occupancyRatePct. */
    vacancyPctOfRent?: number;
    /** Percent of rent for maintenance. Default 8. */
    maintenancePctOfRent?: number;
    /** Percent of rent for management. Default 8. */
    managementPctOfRent?: number;
  };
};

export type CashFlowResult = {
  mortgage: MortgageBreakdown;
  expenses: ExpenseBreakdown;
  /** Cash invested at closing (down payment + closing costs). */
  cashInvested: number;
  /** PITI + HOA + PMI — what most listing sites label "monthly payment". */
  monthlyPaymentPITI: number;
  /** Effective monthly rent after vacancy. */
  monthlyEffectiveRent: number;
  /** Effective rent − all monthly expenses. */
  monthlyCashFlow: number;
  /** Annualized cash flow. */
  annualCashFlow: number;
  /** Annual NOI (operating income; excludes financing costs). */
  netOperatingIncome: number;
  /** NOI / list price, expressed as a percent. */
  capRatePct: number;
  /** annualCashFlow / cashInvested, expressed as a percent. */
  cashOnCashPct: number;
};

export function calculateCashFlow(inputs: CashFlowInputs): CashFlowResult {
  const { financing, rental } = inputs;

  const mortgage = calculateMortgage({
    listPrice: financing.listPrice,
    downPaymentPct: financing.downPaymentPct,
    interestRatePct: financing.interestRatePct,
    loanTermYears: financing.loanTermYears,
  });

  const occupancyRatePct = rental.occupancyRatePct ?? 95;
  const vacancyPctOfRent = rental.vacancyPctOfRent ?? Math.max(0, 100 - occupancyRatePct);
  const maintenancePctOfRent = rental.maintenancePctOfRent ?? 8;
  const managementPctOfRent = rental.managementPctOfRent ?? 8;

  const expenses = calculateExpenses({
    mortgage,
    propertyTaxAnnual: financing.propertyTaxAnnual ?? 0,
    insuranceAnnual: financing.insuranceAnnual ?? 0,
    hoaMonthly: financing.hoaMonthly ?? 0,
    monthlyRent: rental.monthlyRent,
    vacancyPctOfRent,
    maintenancePctOfRent,
    managementPctOfRent,
  });

  const closingCostsPct = financing.closingCostsPct ?? DEFAULT_CLOSING_COSTS_PCT;
  const closingCosts = round2(financing.listPrice * (clampPct(closingCostsPct) / 100));
  const cashInvested = round2(mortgage.downPayment + closingCosts);

  const monthlyEffectiveRent = round2(
    Math.max(0, rental.monthlyRent) - expenses.monthlyVacancyReserve,
  );

  const monthlyPaymentPITI = expenses.monthlyFixedTotal;
  const monthlyCashFlow = round2(monthlyEffectiveRent - expenses.monthlyExpenseTotal);
  const annualCashFlow = round2(monthlyCashFlow * 12);

  // NOI excludes financing-side line items (P&I and PMI).
  const monthlyOperatingExpenses = round2(
    expenses.monthlyTaxes +
      expenses.monthlyInsurance +
      expenses.monthlyHoa +
      expenses.monthlyOperatingTotal,
  );
  const netOperatingIncome = round2((monthlyEffectiveRent - monthlyOperatingExpenses) * 12);

  const capRatePct =
    financing.listPrice > 0 ? round3((netOperatingIncome / financing.listPrice) * 100) : 0;
  const cashOnCashPct = cashInvested > 0 ? round3((annualCashFlow / cashInvested) * 100) : 0;

  return {
    mortgage,
    expenses,
    cashInvested,
    monthlyPaymentPITI,
    monthlyEffectiveRent,
    monthlyCashFlow,
    annualCashFlow,
    netOperatingIncome,
    capRatePct,
    cashOnCashPct,
  };
}
