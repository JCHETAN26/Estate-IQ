/**
 * Expense breakdown tests.
 */

import { describe, expect, it } from "vitest";
import { calculateExpenses } from "../src/expenses.js";

const baseMortgage = {
  loanAmount: 360_000,
  downPayment: 90_000,
  ltv: 0.8,
  monthlyRate: 0.07 / 12,
  monthlyPayments: 360,
  monthlyPrincipalAndInterest: 2395.09,
  pmiMonthly: 0,
  totalInterestOverTerm: 502_233,
};

describe("calculateExpenses", () => {
  it("rolls PITI + HOA into a fixed monthly total", () => {
    const expenses = calculateExpenses({
      mortgage: baseMortgage,
      propertyTaxAnnual: 7200,
      insuranceAnnual: 1800,
      hoaMonthly: 60,
      monthlyRent: 0,
      vacancyPctOfRent: 0,
      maintenancePctOfRent: 0,
      managementPctOfRent: 0,
    });
    expect(expenses.monthlyTaxes).toBeCloseTo(600, 2);
    expect(expenses.monthlyInsurance).toBeCloseTo(150, 2);
    expect(expenses.monthlyHoa).toBe(60);
    expect(expenses.monthlyFixedTotal).toBeCloseTo(2395.09 + 600 + 150 + 60, 2);
    expect(expenses.monthlyOperatingTotal).toBe(0);
    expect(expenses.monthlyExpenseTotal).toBeCloseTo(expenses.monthlyFixedTotal, 2);
  });

  it("scales rent-based reserves correctly", () => {
    const expenses = calculateExpenses({
      mortgage: baseMortgage,
      propertyTaxAnnual: 0,
      insuranceAnnual: 0,
      hoaMonthly: 0,
      monthlyRent: 3000,
      vacancyPctOfRent: 5,
      maintenancePctOfRent: 8,
      managementPctOfRent: 8,
    });
    expect(expenses.monthlyVacancyReserve).toBeCloseTo(150, 2);
    expect(expenses.monthlyMaintenanceReserve).toBeCloseTo(240, 2);
    expect(expenses.monthlyManagement).toBeCloseTo(240, 2);
    expect(expenses.monthlyOperatingTotal).toBeCloseTo(630, 2);
  });

  it("clamps out-of-range percentages and negative inputs", () => {
    const expenses = calculateExpenses({
      mortgage: baseMortgage,
      propertyTaxAnnual: -1000,
      insuranceAnnual: -500,
      hoaMonthly: -10,
      monthlyRent: 2500,
      vacancyPctOfRent: 200,
      maintenancePctOfRent: -5,
      managementPctOfRent: 8,
    });
    expect(expenses.monthlyTaxes).toBe(0);
    expect(expenses.monthlyInsurance).toBe(0);
    expect(expenses.monthlyHoa).toBe(0);
    expect(expenses.monthlyVacancyReserve).toBe(2500); // clamped to 100%
    expect(expenses.monthlyMaintenanceReserve).toBe(0); // clamped to 0%
    expect(expenses.monthlyManagement).toBeCloseTo(200, 2);
  });
});
