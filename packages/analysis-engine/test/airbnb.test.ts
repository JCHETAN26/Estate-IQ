/**
 * Airbnb / STR analyzer tests.
 *
 * Reference values are hand-computed from the formulas in airbnb.ts.
 */

import { describe, expect, it } from "vitest";
import { analyzeAirbnb } from "../src/airbnb.js";

describe("analyzeAirbnb — Austin downtown baseline", () => {
  // ADR $250, 65% occupancy, default cleaning/management/furnishing.
  const result = analyzeAirbnb({
    averageDailyRate: 250,
    occupancyRatePct: 65,
    monthlyFixedCarryingCost: 3000, // mortgage PITI
  });

  it("computes booked nights and gross revenue", () => {
    // 365 * 0.65 = 237.25 nights, rounded to 237.3
    expect(result.bookedNightsPerYear).toBeCloseTo(237.3, 1);
    // 250 * 237.3 = 59325
    expect(result.grossRevenueAnnual).toBeCloseTo(59_325, 0);
  });

  it("amortizes furnishing over 36 months", () => {
    // 18000 / 36 * 12 = 6000
    expect(result.furnishingAmortizedAnnual).toBeCloseTo(6000, 0);
  });

  it("subtracts management fee but not pass-through cleaning", () => {
    // 14% of 59325 = 8305.50
    expect(result.managementCostAnnual).toBeCloseTo(8305.5, 0);
    expect(result.cleaningCostAnnual).toBe(0);
  });

  it("returns deterministic projected revenue net of fees + amortized furnishing", () => {
    // 59325 - 0 - 8305.50 - 6000 = 45019.50
    expect(result.projectedAnnualRevenue).toBeCloseTo(45_019.5, 0);
  });

  it("subtracts carrying costs for net cash flow", () => {
    // 45019.50 - 36000 = 9019.50
    expect(result.projectedAnnualNetCashFlow).toBeCloseTo(9019.5, 0);
  });

  it("computes break-even on the raw furnishing spend", () => {
    // monthlyNet = (59325 - 0 - 8305.50)/12 - 3000 = 4251.625 - 3000 = 1251.625
    // breakEven = 18000 / 1251.625 ≈ 14.4 months
    expect(result.breakEvenMonths).not.toBeNull();
    expect(result.breakEvenMonths!).toBeGreaterThan(13);
    expect(result.breakEvenMonths!).toBeLessThan(16);
  });

  it("flags Low risk for healthy assumptions", () => {
    expect(result.strRiskLevel).toBe("Low");
    expect(result.riskFactors.length).toBeGreaterThan(0);
  });

  it("returns 12 seasonality factors averaging ~1.0", () => {
    expect(result.seasonalityFactors).toHaveLength(12);
    const avg =
      result.seasonalityFactors.reduce((sum, f) => sum + f, 0) / result.seasonalityFactors.length;
    expect(avg).toBeCloseTo(1.0, 2);
  });

  it("monthly projection sums to gross revenue within rounding", () => {
    expect(result.monthlyRevenueProjection).toHaveLength(12);
    const sum = result.monthlyRevenueProjection.reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(result.grossRevenueAnnual, 0);
  });
});

describe("analyzeAirbnb — risk escalation", () => {
  it("flags High risk when occupancy is low and cash flow is negative", () => {
    const result = analyzeAirbnb({
      averageDailyRate: 100,
      occupancyRatePct: 35,
      monthlyFixedCarryingCost: 3000,
      furnishingCost: 25_000,
    });
    expect(result.strRiskLevel).toBe("High");
    expect(result.projectedAnnualNetCashFlow).toBeLessThan(0);
  });

  it("returns null break-even when fixed carrying costs exceed STR profit", () => {
    const result = analyzeAirbnb({
      averageDailyRate: 80,
      occupancyRatePct: 40,
      monthlyFixedCarryingCost: 4000,
    });
    expect(result.breakEvenMonths).toBeNull();
  });
});

describe("analyzeAirbnb — input handling", () => {
  it("clamps occupancy outside [0,100]", () => {
    const tooHigh = analyzeAirbnb({ averageDailyRate: 200, occupancyRatePct: 150 });
    expect(tooHigh.occupancyRate).toBe(1);
    const negative = analyzeAirbnb({ averageDailyRate: 200, occupancyRatePct: -10 });
    expect(negative.occupancyRate).toBe(0);
  });

  it("treats furnishing cost of 0 as no break-even constraint", () => {
    const result = analyzeAirbnb({
      averageDailyRate: 200,
      occupancyRatePct: 60,
      furnishingCost: 0,
      monthlyFixedCarryingCost: 0,
    });
    expect(result.breakEvenMonths).toBeNull();
  });

  it("models host-borne cleaning when pass-through is disabled", () => {
    const passthrough = analyzeAirbnb({
      averageDailyRate: 250,
      occupancyRatePct: 65,
      cleaningFeePerBooking: 150,
    });
    const hostBorne = analyzeAirbnb({
      averageDailyRate: 250,
      occupancyRatePct: 65,
      cleaningFeePerBooking: 150,
      cleaningFeePassedThrough: false,
    });
    expect(passthrough.cleaningCostAnnual).toBe(0);
    expect(hostBorne.cleaningCostAnnual).toBeGreaterThan(0);
    expect(hostBorne.projectedAnnualRevenue).toBeLessThan(passthrough.projectedAnnualRevenue);
  });
});
