/**
 * Cash flow + investment-return tests.
 *
 * Reference values were calculated by hand from the canonical formulas:
 *   NOI    = (effective rent − operating expenses) * 12
 *   CapRate = NOI / list price
 *   CoC    = annual cash flow / cash invested
 */

import { describe, expect, it } from "vitest";
import { calculateCashFlow } from "../src/cashflow.js";

describe("calculateCashFlow — $450k Austin SFH baseline", () => {
  // Inputs match the seeded fixture so the numbers are easy to eyeball.
  const inputs = {
    financing: {
      listPrice: 450_000,
      downPaymentPct: 20,
      interestRatePct: 7,
      loanTermYears: 30,
      propertyTaxAnnual: 7200,
      insuranceAnnual: 1800,
      hoaMonthly: 0,
      closingCostsPct: 3,
    },
    rental: {
      monthlyRent: 2900,
      occupancyRatePct: 95,
      maintenancePctOfRent: 8,
      managementPctOfRent: 8,
    },
  } as const;

  const result = calculateCashFlow(inputs);

  it("produces deterministic mortgage + expense breakdown", () => {
    expect(result.mortgage.loanAmount).toBeCloseTo(360_000, 2);
    expect(result.mortgage.monthlyPrincipalAndInterest).toBeCloseTo(2395.09, 1);
    expect(result.expenses.monthlyHoa).toBe(0);
    expect(result.expenses.monthlyTaxes).toBeCloseTo(600, 2);
    expect(result.expenses.monthlyInsurance).toBeCloseTo(150, 2);
    expect(result.expenses.monthlyFixedTotal).toBeCloseTo(3145.09, 1);
  });

  it("computes effective rent net of vacancy", () => {
    // 5% vacancy of 2900 = 145 -> effective 2755
    expect(result.expenses.monthlyVacancyReserve).toBeCloseTo(145, 2);
    expect(result.monthlyEffectiveRent).toBeCloseTo(2755, 2);
  });

  it("computes monthly cash flow", () => {
    // expenses = 3145.09 (fixed) + 145 (vac) + 232 (maint) + 232 (mgmt) = 3754.09
    // cashflow = 2755 - 3754.09 = -999.09
    expect(result.monthlyCashFlow).toBeCloseTo(-999.09, 1);
    expect(result.annualCashFlow).toBeCloseTo(-11_989.08, 0);
  });

  it("computes NOI excluding financing costs", () => {
    // operating monthly = taxes 600 + ins 150 + hoa 0 + (vac 145 + maint 232 + mgmt 232) = 1359
    // NOI/mo = effective rent 2755 - operating 1359 = 1396
    // Annual NOI = 16752
    expect(result.netOperatingIncome).toBeCloseTo(16_752, 0);
  });

  it("computes cap rate as NOI / price", () => {
    // 16752 / 450000 = 3.7227%
    expect(result.capRatePct).toBeCloseTo(3.723, 2);
  });

  it("computes cash-on-cash on down payment + closing costs", () => {
    // cash invested = 90000 + 13500 (3%) = 103500
    // CoC = -11989 / 103500 ≈ -11.58%
    expect(result.cashInvested).toBeCloseTo(103_500, 0);
    expect(result.cashOnCashPct).toBeCloseTo(-11.58, 1);
  });
});

describe("calculateCashFlow — positive cash flow scenario", () => {
  // High rent, low price — should clearly cash flow positive.
  const result = calculateCashFlow({
    financing: {
      listPrice: 200_000,
      downPaymentPct: 25,
      interestRatePct: 6,
      loanTermYears: 30,
      propertyTaxAnnual: 3000,
      insuranceAnnual: 900,
      hoaMonthly: 0,
    },
    rental: {
      monthlyRent: 2500,
      occupancyRatePct: 95,
      maintenancePctOfRent: 8,
      managementPctOfRent: 0, // self-managed
    },
  });

  it("produces positive cash flow", () => {
    expect(result.monthlyCashFlow).toBeGreaterThan(0);
    expect(result.cashOnCashPct).toBeGreaterThan(0);
  });

  it("cap rate is independent of financing", () => {
    // operating expenses = 250 (tax) + 75 (ins) + 0 (hoa) + 125 (vac) + 200 (maint) + 0 (mgmt) = 650
    // effective rent = 2375
    // NOI/mo = 2375 - 650 = 1725; annual = 20700
    // cap = 20700 / 200000 = 10.35%
    expect(result.capRatePct).toBeCloseTo(10.35, 1);
  });
});

describe("calculateCashFlow — degenerate inputs", () => {
  it("does not divide by zero when list price is zero", () => {
    const result = calculateCashFlow({
      financing: {
        listPrice: 0,
        downPaymentPct: 20,
        interestRatePct: 7,
        loanTermYears: 30,
      },
      rental: { monthlyRent: 1000 },
    });
    expect(result.capRatePct).toBe(0);
    expect(result.cashOnCashPct).toBe(0);
  });
});
