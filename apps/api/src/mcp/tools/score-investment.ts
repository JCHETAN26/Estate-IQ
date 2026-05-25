/**
 * MCP tool: score_investment
 *
 * Wraps @estate-iq/analysis-engine.calculateInvestmentScore. Computes
 * a deterministic 0-100 score with a per-factor breakdown and rationale.
 *
 * Inputs are intentionally permissive (most fields optional) so callers
 * can score a property at any stage of the analyze pipeline — e.g.
 * before cash-flow numbers are known. Missing inputs default to
 * neutral (50/100) rather than penalising the property.
 */

import { calculateInvestmentScore } from "@estate-iq/analysis-engine";
import { ScoreInvestmentInputSchema, ScoreInvestmentOutputSchema } from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const scoreInvestmentTool = defineTool({
  name: "score_investment",
  description:
    "Compute a deterministic 0-100 investment score from cash flow, rent-to-price, tax burden, neighborhood growth, and appreciation potential. Returns a per-factor breakdown and rationale.",
  inputSchema: ScoreInvestmentInputSchema,
  outputSchema: ScoreInvestmentOutputSchema,
  async handler(input) {
    const inputs = {
      listPrice: input.listPrice,
      ...(input.cashOnCashPct !== undefined ? { cashOnCashPct: input.cashOnCashPct } : {}),
      ...(input.rentToPricePct !== undefined ? { rentToPricePct: input.rentToPricePct } : {}),
      ...(input.propertyTaxAnnual !== undefined
        ? { propertyTaxAnnual: input.propertyTaxAnnual }
        : {}),
      ...(input.squareFeet !== undefined ? { squareFeet: input.squareFeet } : {}),
      ...(input.yearBuilt !== undefined ? { yearBuilt: input.yearBuilt } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.medianPricePerSqft !== undefined
        ? { medianPricePerSqft: input.medianPricePerSqft }
        : {}),
    };

    const result = calculateInvestmentScore(inputs);

    return {
      status: "ok" as const,
      score: result.score,
      rating: result.rating,
      factors: result.factors,
      rationale: result.rationale,
    };
  },
});
