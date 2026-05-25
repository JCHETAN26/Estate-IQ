/**
 * Investment scoring tests.
 *
 * Verifies determinism, weight invariants, anchor-point alignment, and
 * graceful handling of missing inputs.
 */

import { describe, expect, it } from "vitest";
import { calculateInvestmentScore, type InvestmentScoreInputs } from "../src/scoring.js";

const baseInputs: InvestmentScoreInputs = {
  cashOnCashPct: 6,
  rentToPricePct: 8,
  propertyTaxAnnual: 5000,
  listPrice: 400_000,
  squareFeet: 2000,
  yearBuilt: 2010,
  city: "Austin",
  state: "TX",
  medianPricePerSqft: 250,
};

describe("calculateInvestmentScore — determinism", () => {
  it("produces identical output for identical input", () => {
    const a = calculateInvestmentScore(baseInputs);
    const b = calculateInvestmentScore(baseInputs);
    expect(a).toEqual(b);
  });

  it("returns a score in [0, 100]", () => {
    const result = calculateInvestmentScore(baseInputs);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("returns one rationale line per factor", () => {
    const result = calculateInvestmentScore(baseInputs);
    expect(result.rationale).toHaveLength(5);
    for (const line of result.rationale) {
      expect(line.length).toBeGreaterThan(10);
    }
  });
});

describe("calculateInvestmentScore — factor anchors", () => {
  it("scores cash flow at 50 when CoC is exactly 0%", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      cashOnCashPct: 0,
    });
    expect(result.factors.cashFlow.score).toBe(50);
  });

  it("scores cash flow at 100 when CoC is >= 10%", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      cashOnCashPct: 12,
    });
    expect(result.factors.cashFlow.score).toBe(100);
  });

  it("clamps cash flow at 0 for very negative CoC", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      cashOnCashPct: -25,
    });
    expect(result.factors.cashFlow.score).toBe(0);
  });

  it("scores rent-to-price at 50 at 6% (US median)", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      rentToPricePct: 6,
    });
    expect(result.factors.rentToPrice.score).toBe(50);
  });

  it("scores rent-to-price at 100 at 10% (1% rule)", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      rentToPricePct: 10,
    });
    expect(result.factors.rentToPrice.score).toBe(100);
  });

  it("scores tax burden at 50 at 2% of price", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      propertyTaxAnnual: 0.02 * baseInputs.listPrice,
    });
    expect(result.factors.taxBurden.score).toBe(50);
  });
});

describe("calculateInvestmentScore — weights", () => {
  it("each factor weight is documented", () => {
    const result = calculateInvestmentScore(baseInputs);
    const totalWeight =
      result.factors.cashFlow.weight +
      result.factors.rentToPrice.weight +
      result.factors.taxBurden.weight +
      result.factors.neighborhoodGrowth.weight +
      result.factors.appreciation.weight;
    expect(totalWeight).toBe(100);
  });

  it("overall score equals weighted average of factor scores", () => {
    const result = calculateInvestmentScore(baseInputs);
    const expected =
      (result.factors.cashFlow.score * result.factors.cashFlow.weight +
        result.factors.rentToPrice.score * result.factors.rentToPrice.weight +
        result.factors.taxBurden.score * result.factors.taxBurden.weight +
        result.factors.neighborhoodGrowth.score * result.factors.neighborhoodGrowth.weight +
        result.factors.appreciation.score * result.factors.appreciation.weight) /
      100;
    // round1 makes this comparison ±0.05.
    expect(result.score).toBeCloseTo(expected, 0);
  });
});

describe("calculateInvestmentScore — neighborhood growth lookup", () => {
  it("uses city-specific score when available", () => {
    const result = calculateInvestmentScore(baseInputs);
    expect(result.factors.neighborhoodGrowth.score).toBe(90); // Austin
  });

  it("falls back to state default when city unknown", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      city: "Unknownville",
    });
    expect(result.factors.neighborhoodGrowth.score).toBe(75); // TX default
  });

  it("uses neutral default when state is also unknown", () => {
    const result = calculateInvestmentScore({
      ...baseInputs,
      city: "Anywhere",
      state: "ZZ",
    });
    expect(result.factors.neighborhoodGrowth.score).toBe(60);
  });
});

describe("calculateInvestmentScore — graceful with missing inputs", () => {
  it("returns a score when only listPrice is provided", () => {
    const result = calculateInvestmentScore({ listPrice: 400_000 });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("does not penalise unknown cash flow as a zero", () => {
    const withMissing = calculateInvestmentScore({ listPrice: 400_000 });
    expect(withMissing.factors.cashFlow.score).toBe(50);
    expect(withMissing.factors.cashFlow.rationale).toMatch(/unknown/i);
  });

  it("returns a categorical rating", () => {
    const high = calculateInvestmentScore({
      ...baseInputs,
      cashOnCashPct: 15,
      rentToPricePct: 12,
      propertyTaxAnnual: 1000,
    });
    expect(["Excellent", "Strong"]).toContain(high.rating);

    const low = calculateInvestmentScore({
      ...baseInputs,
      cashOnCashPct: -15,
      rentToPricePct: 2,
      propertyTaxAnnual: 0.04 * baseInputs.listPrice,
    });
    expect(["Weak", "Poor"]).toContain(low.rating);
  });
});
