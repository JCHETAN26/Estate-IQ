/**
 * Mortgage math tests.
 *
 * Reference values come from the standard amortization formula
 *   M = P · r(1+r)^n / ((1+r)^n - 1)
 * and have been spot-checked against online calculators (Bankrate,
 * NerdWallet, Investopedia). Tolerances are 1¢ on monthly payments
 * and $1 on lifetime totals to absorb rounding strategy differences.
 */

import { describe, expect, it } from "vitest";
import { calculateMortgage, monthlyAmortizedPayment } from "../src/mortgage.js";

describe("monthlyAmortizedPayment", () => {
  it("matches the textbook 30-year, 7% example ($300k loan)", () => {
    // M = 300000 * (0.07/12 * (1+0.07/12)^360) / ((1+0.07/12)^360 - 1)
    //   ≈ 1995.91
    const monthly = monthlyAmortizedPayment(300_000, 0.07 / 12, 360);
    expect(monthly).toBeCloseTo(1995.91, 1);
  });

  it("matches a 15-year, 6% example ($200k loan)", () => {
    // ≈ 1687.71
    const monthly = monthlyAmortizedPayment(200_000, 0.06 / 12, 180);
    expect(monthly).toBeCloseTo(1687.71, 1);
  });

  it("handles zero interest as straight-line repayment", () => {
    const monthly = monthlyAmortizedPayment(120_000, 0, 360);
    expect(monthly).toBeCloseTo(120_000 / 360, 4);
  });

  it("returns 0 for non-positive principal or term", () => {
    expect(monthlyAmortizedPayment(0, 0.005, 360)).toBe(0);
    expect(monthlyAmortizedPayment(100_000, 0.005, 0)).toBe(0);
    expect(monthlyAmortizedPayment(-100, 0.005, 360)).toBe(0);
  });
});

describe("calculateMortgage", () => {
  const baseInputs = {
    listPrice: 450_000,
    downPaymentPct: 20,
    interestRatePct: 7,
    loanTermYears: 30,
  };

  it("builds a 30/20/7 mortgage breakdown for a $450k home", () => {
    const result = calculateMortgage(baseInputs);
    expect(result.downPayment).toBeCloseTo(90_000, 2);
    expect(result.loanAmount).toBeCloseTo(360_000, 2);
    expect(result.ltv).toBeCloseTo(0.8, 5);
    expect(result.monthlyPayments).toBe(360);
    // Reference: M = 360000 * 0.07/12 * (1+0.07/12)^360 / ((1+0.07/12)^360 - 1)
    //              ≈ 2395.09
    expect(result.monthlyPrincipalAndInterest).toBeCloseTo(2395.09, 1);
    // Total interest over the term = M*n - P
    expect(result.totalInterestOverTerm).toBeCloseTo(
      result.monthlyPrincipalAndInterest * 360 - result.loanAmount,
      0,
    );
  });

  it("does not charge PMI when LTV is exactly 80%", () => {
    const result = calculateMortgage(baseInputs);
    expect(result.pmiMonthly).toBe(0);
  });

  it("charges PMI when LTV exceeds 80%", () => {
    const result = calculateMortgage({ ...baseInputs, downPaymentPct: 5 });
    // Loan = 450000 * 0.95 = 427500. Annual PMI 0.5% = 2137.5. Monthly ~178.13.
    expect(result.ltv).toBeCloseTo(0.95, 5);
    expect(result.pmiMonthly).toBeCloseTo(178.13, 1);
  });

  it("clamps invalid down payment percentages", () => {
    const result = calculateMortgage({ ...baseInputs, downPaymentPct: 150 });
    // Treated as 100% down -> $0 loan -> $0 P&I.
    expect(result.loanAmount).toBe(0);
    expect(result.monthlyPrincipalAndInterest).toBe(0);
    expect(result.pmiMonthly).toBe(0);
  });

  it("handles a zero-interest loan deterministically", () => {
    const result = calculateMortgage({
      listPrice: 360_000,
      downPaymentPct: 0,
      interestRatePct: 0,
      loanTermYears: 30,
    });
    // 360k / 360 = 1000/mo
    expect(result.monthlyPrincipalAndInterest).toBeCloseTo(1000, 1);
    expect(result.totalInterestOverTerm).toBeCloseTo(0, 0);
  });
});
