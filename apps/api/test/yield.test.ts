/**
 * Yield helper tests.
 */

import { describe, expect, it } from "vitest";
import { computeYieldMetrics } from "../src/services/yield.js";

describe("computeYieldMetrics", () => {
  it("computes rent-to-price as annualized rent / price", () => {
    // $2,900 monthly => $34,800 annual / $450,000 = 7.733%
    const metrics = computeYieldMetrics(2900, 450_000);
    expect(metrics.rentToPricePct).toBeCloseTo(7.733, 2);
  });

  it("computes the gross rent multiplier as price / annual rent", () => {
    // $450,000 / ($2,900 * 12) = 12.93
    const metrics = computeYieldMetrics(2900, 450_000);
    expect(metrics.grossRentMultiplier).toBeCloseTo(12.93, 1);
  });

  it("flags the 1% rule when monthly rent >= 1% of price", () => {
    expect(computeYieldMetrics(4500, 450_000).meetsOnePercentRule).toBe(true);
    expect(computeYieldMetrics(4499, 450_000).meetsOnePercentRule).toBe(false);
    expect(computeYieldMetrics(2900, 450_000).meetsOnePercentRule).toBe(false);
  });

  it("returns zero metrics when price is zero", () => {
    const metrics = computeYieldMetrics(2900, 0);
    expect(metrics.rentToPricePct).toBe(0);
    expect(metrics.grossRentMultiplier).toBe(0);
    expect(metrics.meetsOnePercentRule).toBe(false);
  });

  it("returns zero GRM when rent is zero", () => {
    const metrics = computeYieldMetrics(0, 450_000);
    expect(metrics.rentToPricePct).toBe(0);
    expect(metrics.grossRentMultiplier).toBe(0);
  });
});
