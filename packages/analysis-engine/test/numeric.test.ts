/**
 * Numeric helper tests.
 */

import { describe, expect, it } from "vitest";
import { clamp, clampPct, round1, round2, round3 } from "../src/numeric.js";

describe("round1 / round2 / round3", () => {
  it("round1 rounds to 1 decimal place", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.24)).toBe(1.2);
    expect(round1(0)).toBe(0);
  });

  it("round2 rounds to 2 decimal places", () => {
    expect(round2(1.235)).toBe(1.24);
    expect(round2(1.234)).toBe(1.23);
    expect(round2(-1.235)).toBe(-1.24);
  });

  it("round3 rounds to 3 decimal places", () => {
    expect(round3(1.2345)).toBe(1.235);
    expect(round3(1.2344)).toBe(1.234);
  });
});

describe("clamp", () => {
  it("clamps within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns min for NaN input", () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(Number.NaN, -5, 10)).toBe(-5);
  });
});

describe("clampPct", () => {
  it("clamps to [0, 100]", () => {
    expect(clampPct(50)).toBe(50);
    expect(clampPct(-10)).toBe(0);
    expect(clampPct(200)).toBe(100);
    expect(clampPct(Number.NaN)).toBe(0);
  });
});
