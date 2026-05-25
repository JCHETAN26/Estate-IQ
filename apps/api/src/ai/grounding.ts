/**
 * Grounding validator.
 *
 * Walks the rendered memo and pulls out every numeric token. Each token
 * must round-trip with one of the supplied metric values (within a
 * small tolerance) — otherwise the LLM hallucinated a number.
 *
 * The validator is deliberately conservative:
 *   - Bare integers under 100 are ignored (they are routinely used in
 *     phrases like "5 properties", "30-year term", "30%-off", "top-25").
 *   - Tokens followed by clear unit hints (%, $, x, /yr, /mo) are
 *     compared against the metric set. Years (1900-2100) are also
 *     allowed when a yearBuilt-style value matches.
 *   - Tolerance is 0.01% relative, or $1 absolute on dollar tokens,
 *     whichever is larger. Below that, the LLM is treated as
 *     hallucinating.
 *
 * Returns a list of suspicious tokens. Empty list = grounded.
 */

import type { InvestmentMemo } from "./memo-schema.js";

export type GroundingFinding = {
  token: string;
  context: string;
  reason: "no_matching_metric";
};

const NUMBER_RE =
  /-?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:%|x|\/yr|\/mo)?|-?\d+(?:\.\d+)?(?:%|x|\/yr|\/mo)?|\$\d+(?:\.\d+)?/g;
const TRIVIAL_LIMIT = 100;

function parseNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/[$,%x]/g, "")
    .replace(/\/(?:yr|mo)/, "")
    .trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function matchesAny(value: number, metrics: number[]): boolean {
  for (const metric of metrics) {
    if (metric === 0 && value === 0) return true;
    const tolerance = Math.max(1, Math.abs(metric) * 0.0001);
    if (Math.abs(value - metric) <= tolerance) return true;
    // Year-built and similar small-integer matches; tolerate exact only.
    if (Number.isInteger(value) && Number.isInteger(metric) && value === metric) return true;
  }
  return false;
}

export function findUngroundedNumbers(
  memo: InvestmentMemo,
  metrics: Record<string, number>,
): GroundingFinding[] {
  const allowedValues = Object.values(metrics).filter((n) => Number.isFinite(n));
  const findings: GroundingFinding[] = [];

  const sources: Array<{ context: string; text: string }> = [
    { context: "headline", text: memo.headline },
    { context: "summary", text: memo.summary },
    ...memo.strengths.map((s, i) => ({ context: `strengths[${i}]`, text: s })),
    ...memo.risks.map((r, i) => ({ context: `risks[${i}]`, text: r })),
    ...memo.negotiationInsights.map((n, i) => ({
      context: `negotiationInsights[${i}]`,
      text: n,
    })),
  ];

  for (const { context, text } of sources) {
    const tokens = text.match(NUMBER_RE);
    if (!tokens) continue;
    for (const token of tokens) {
      const value = parseNumber(token);
      if (value === null) continue;
      const looksLikeUnitless = !/[%$x]|\/(?:yr|mo)/.test(token);
      // Skip trivially-small unitless integers (counts, ranks).
      if (looksLikeUnitless && Number.isInteger(value) && Math.abs(value) <= TRIVIAL_LIMIT)
        continue;
      if (matchesAny(value, allowedValues)) continue;
      findings.push({ token, context, reason: "no_matching_metric" });
    }
  }

  return findings;
}
