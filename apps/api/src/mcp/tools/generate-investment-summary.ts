/**
 * MCP tool: generate_investment_summary
 *
 * Composes the underwriting pipeline (rental + mortgage + cash flow +
 * Airbnb + scoring) and feeds the results to the memo generator. The
 * final output is a structured Markdown investment memo.
 *
 * Input is a Property + optional financing overrides; everything else
 * is derived. This is the single end-to-end entry point that the
 * frontend (Phase 4) and the conversational agent (Task 3.2) will call.
 */

import {
  calculateCashFlow,
  calculateInvestmentScore,
  calculateMortgage,
} from "@estate-iq/analysis-engine";
import {
  GenerateInvestmentSummaryInputSchema,
  GenerateInvestmentSummaryOutputSchema,
} from "@estate-iq/shared";
import { analyzeAirbnbForProperty } from "../../services/airbnb-analysis.service.js";
import { generateInvestmentMemo } from "../../services/memo-generator.service.js";
import { estimateRental } from "../../services/rental-estimate.service.js";
import { defineTool } from "../registry.js";

export const generateInvestmentSummaryTool = defineTool({
  name: "generate_investment_summary",
  description:
    "Run the full underwriting pipeline (rental + mortgage + cash flow + Airbnb + scoring) and produce a structured investment memo. Falls back to a deterministic template when OpenAI is not configured.",
  inputSchema: GenerateInvestmentSummaryInputSchema,
  outputSchema: GenerateInvestmentSummaryOutputSchema,
  async handler({ property }) {
    const financing = {
      downPaymentPct: 20,
      interestRatePct: 7,
      loanTermYears: 30,
    };

    const [rentalOutcome, airbnbOutcome] = await Promise.all([
      estimateRental(property, { skipPersist: true }),
      analyzeAirbnbForProperty({ property }),
    ]);

    if (!rentalOutcome.ok) {
      return {
        status: "not_implemented" as const,
        deferredTo: "Phase 3 / Task 3.1 — AI Memo Generation",
        message: `Cannot generate memo: rental estimate unavailable (${rentalOutcome.reason}).`,
      };
    }

    const mortgage = calculateMortgage({
      listPrice: property.listPrice,
      ...financing,
    });

    const cashFlow = calculateCashFlow({
      financing: {
        listPrice: property.listPrice,
        ...financing,
        propertyTaxAnnual: property.taxesAnnual ?? 0,
        insuranceAnnual: property.insuranceAnnual ?? 0,
        hoaMonthly: property.hoaMonthly ?? 0,
      },
      rental: {
        monthlyRent: rentalOutcome.estimate.estimatedRent,
        occupancyRatePct: rentalOutcome.estimate.occupancyRatePct ?? 95,
      },
    });

    const score = calculateInvestmentScore({
      listPrice: property.listPrice,
      cashOnCashPct: cashFlow.cashOnCashPct,
      rentToPricePct: rentalOutcome.estimate.yieldMetrics?.rentToPricePct ?? 0,
      ...(property.taxesAnnual !== undefined ? { propertyTaxAnnual: property.taxesAnnual } : {}),
      ...(property.squareFeet !== undefined ? { squareFeet: property.squareFeet } : {}),
      ...(property.yearBuilt !== undefined ? { yearBuilt: property.yearBuilt } : {}),
      city: property.city,
      state: property.state,
    });

    const memoOutcome = await generateInvestmentMemo({
      property,
      rentalEstimate: rentalOutcome.estimate,
      mortgage,
      cashFlow,
      airbnb: airbnbOutcome.ok
        ? { source: airbnbOutcome.source, analysis: airbnbOutcome.analysis }
        : null,
      score,
      financingNotes: financing,
    });

    if (!memoOutcome.ok) {
      return {
        status: "not_implemented" as const,
        deferredTo: "Phase 3 / Task 3.1 — AI Memo Generation",
        message: `Memo generation failed: ${memoOutcome.reason}`,
      };
    }

    const summaryMarkdown = formatAsMarkdown(memoOutcome.memo);

    return {
      status: "ok" as const,
      summaryMarkdown,
      promptVersion: memoOutcome.promptVersion,
      ...(memoOutcome.model ? { model: memoOutcome.model } : {}),
    };
  },
});

function formatAsMarkdown(memo: import("../../ai/memo-schema.js").InvestmentMemo): string {
  const lines: string[] = [];
  lines.push(`# ${memo.headline}`);
  lines.push("");
  lines.push(memo.summary);
  lines.push("");
  lines.push("## Strengths");
  for (const s of memo.strengths) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Risks");
  for (const r of memo.risks) lines.push(`- ${r}`);
  lines.push("");
  lines.push("## Negotiation insights");
  for (const n of memo.negotiationInsights) lines.push(`- ${n}`);
  lines.push("");
  lines.push(`## Recommendation`);
  lines.push(`**${memo.recommendation}** (confidence: ${memo.confidence})`);
  return lines.join("\n");
}
