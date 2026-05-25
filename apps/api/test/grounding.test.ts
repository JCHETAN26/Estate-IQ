/**
 * Grounding validator tests.
 *
 * The grounding validator's job is to detect numbers in the LLM output
 * that don't match any input metric — i.e. hallucinated numbers.
 */

import { describe, expect, it } from "vitest";
import { findUngroundedNumbers } from "../src/ai/grounding.js";
import type { InvestmentMemo } from "../src/ai/memo-schema.js";

const allowedMetrics = {
  listPrice: 450_000,
  monthlyRent: 2900,
  capRatePct: 3.72,
  cashOnCashPct: -11.58,
  investmentScore: 54.7,
};

function memo(overrides: Partial<InvestmentMemo>): InvestmentMemo {
  return {
    headline: overrides.headline ?? "Stub headline for the test fixture memo",
    summary: overrides.summary ?? "Stub summary for testing the grounding validator.",
    strengths: overrides.strengths ?? ["Strength placeholder for grounding test"],
    risks: overrides.risks ?? ["Risk placeholder for grounding test"],
    negotiationInsights: overrides.negotiationInsights ?? [
      "Negotiation placeholder for grounding test",
    ],
    recommendation: overrides.recommendation ?? "Negotiate",
    confidence: overrides.confidence ?? "Moderate",
  };
}

describe("findUngroundedNumbers", () => {
  it("returns no findings when every number matches an input metric", () => {
    const m = memo({
      headline: "Cap rate of 3.72% on a $450,000 property",
      summary: "Cash-on-cash of -11.58% with a score of 54.7/100.",
      strengths: ["Monthly rent of $2,900 is consistent with the area."],
    });
    expect(findUngroundedNumbers(m, allowedMetrics)).toEqual([]);
  });

  it("flags hallucinated dollar amounts", () => {
    const m = memo({
      summary: "The model claims rent is $5,500 — a number we never supplied.",
    });
    const findings = findUngroundedNumbers(m, allowedMetrics);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.context).toBe("summary");
  });

  it("flags hallucinated percent figures", () => {
    const m = memo({
      strengths: ["Cap rate of 8.4% is healthy for the price band."],
    });
    const findings = findUngroundedNumbers(m, allowedMetrics);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("ignores trivial unitless integers (counts, ranks)", () => {
    const m = memo({
      summary: "Top 5 in the neighborhood; 3 bedrooms; ranked 12th.",
    });
    expect(findUngroundedNumbers(m, allowedMetrics)).toEqual([]);
  });

  it("matches numbers within tolerance", () => {
    const m = memo({
      summary: "Cap rate is roughly 3.72%.",
    });
    expect(findUngroundedNumbers(m, allowedMetrics)).toEqual([]);
  });
});
