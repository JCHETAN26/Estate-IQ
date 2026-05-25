/**
 * Investment memo generator.
 *
 * Inputs: a Property + computed metrics from the underwriting engine.
 * Output: a structured Markdown investment memo.
 *
 * Strategy:
 *   1. Render the prompt with only computed numbers (no Zillow narrative,
 *      no comparable addresses, just metrics).
 *   2. Call OpenAI with structured-output (JSON mode).
 *   3. Validate the response with InvestmentMemoSchema.
 *   4. Run the grounding validator — any number the LLM emits must
 *      round-trip with one of our inputs. If the model hallucinates,
 *      we log it and fall back to the deterministic template.
 *   5. If OpenAI is not configured or fails, return a deterministic
 *      memo built from the same metrics.
 *
 * The deterministic fallback is dull on purpose. Its job is to keep the
 * end-to-end flow honest and testable without burning OpenAI credits.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AirbnbAnalysis,
  CashFlowResult,
  InvestmentScoreResult,
  MortgageBreakdown,
} from "@estate-iq/analysis-engine";
import type { Property, RentalEstimate } from "@estate-iq/shared";
import { findUngroundedNumbers } from "../ai/grounding.js";
import {
  InvestmentMemoSchema,
  type InvestmentMemo,
  type MemoMetrics,
  type Recommendation,
} from "../ai/memo-schema.js";
import { renderTemplate } from "../ai/prompt-renderer.js";
import { chatJson } from "../integrations/openai/client.js";
import { logger } from "../mcp/logger.js";

const here = dirname(fileURLToPath(import.meta.url));
const PROMPT_DIR = resolve(here, "../ai/prompts");

const PROMPT_VERSION = "v1.0";

let cachedSystemPrompt: string | null = null;
let cachedUserTemplate: string | null = null;

async function loadPrompts(): Promise<{ system: string; user: string }> {
  if (cachedSystemPrompt && cachedUserTemplate) {
    return { system: cachedSystemPrompt, user: cachedUserTemplate };
  }
  const [system, user] = await Promise.all([
    readFile(resolve(PROMPT_DIR, "system-investment-memo.md"), "utf8"),
    readFile(resolve(PROMPT_DIR, "user-investment-memo.md"), "utf8"),
  ]);
  cachedSystemPrompt = system;
  cachedUserTemplate = user;
  return { system, user };
}

export type MemoInputs = {
  property: Property;
  rentalEstimate: RentalEstimate;
  mortgage: MortgageBreakdown;
  cashFlow: CashFlowResult;
  airbnb: { source: "AIRDNA" | "MARKET_RULES"; analysis: AirbnbAnalysis } | null;
  score: InvestmentScoreResult;
  /** Overrides the financing assumptions echoed in the memo header. */
  financingNotes?: {
    downPaymentPct: number;
    interestRatePct: number;
    loanTermYears: number;
  };
};

export type MemoOutcome =
  | {
      ok: true;
      source: "openai" | "fallback";
      memo: InvestmentMemo;
      promptVersion: string;
      model?: string;
      groundingFindings: ReturnType<typeof findUngroundedNumbers>;
    }
  | { ok: false; reason: string; message: string };

export async function generateInvestmentMemo(inputs: MemoInputs): Promise<MemoOutcome> {
  const metrics = buildMetrics(inputs);
  const promptContext = buildPromptContext(inputs, metrics);

  const { system, user } = await loadPrompts();
  const userPrompt = renderTemplate(user, promptContext);

  const llmResult = await chatJson({ systemPrompt: system, userPrompt });
  if (llmResult.ok) {
    const parsed = InvestmentMemoSchema.safeParse(llmResult.json);
    if (parsed.success) {
      const findings = findUngroundedNumbers(parsed.data, metrics.numbers);
      if (findings.length === 0) {
        return {
          ok: true,
          source: "openai",
          memo: parsed.data,
          promptVersion: PROMPT_VERSION,
          model: llmResult.model,
          groundingFindings: findings,
        };
      }
      logger.warn("memo.ungrounded_numbers", {
        findings,
        falling_back: true,
      });
    } else {
      logger.warn("memo.schema_mismatch", {
        issues: parsed.error.flatten(),
      });
    }
  } else {
    logger.debug("memo.openai_unavailable", { reason: llmResult.error.kind });
  }

  // Deterministic fallback — built from the same metrics so it cannot
  // hallucinate.
  return {
    ok: true,
    source: "fallback",
    memo: buildFallbackMemo(inputs, metrics),
    promptVersion: PROMPT_VERSION,
    groundingFindings: [],
  };
}

// ---------------------------------------------------------------------------
// Metric extraction
// ---------------------------------------------------------------------------

function buildMetrics(inputs: MemoInputs): MemoMetrics {
  const financing = inputs.financingNotes ?? {
    downPaymentPct: 20,
    interestRatePct: 7,
    loanTermYears: 30,
  };

  const numbers: Record<string, number> = {
    listPrice: inputs.property.listPrice,
    bedrooms: inputs.property.bedrooms,
    bathrooms: inputs.property.bathrooms,
    monthlyRent: inputs.rentalEstimate.estimatedRent,
    rentToPricePct: inputs.rentalEstimate.yieldMetrics?.rentToPricePct ?? 0,
    grossRentMultiplier: inputs.rentalEstimate.yieldMetrics?.grossRentMultiplier ?? 0,
    downPaymentPct: financing.downPaymentPct,
    interestRatePct: financing.interestRatePct,
    loanTermYears: financing.loanTermYears,
    loanAmount: inputs.mortgage.loanAmount,
    monthlyPrincipalAndInterest: inputs.mortgage.monthlyPrincipalAndInterest,
    monthlyPaymentPITI: inputs.cashFlow.monthlyPaymentPITI,
    totalInterestOverTerm: inputs.mortgage.totalInterestOverTerm,
    monthlyCashFlow: inputs.cashFlow.monthlyCashFlow,
    annualCashFlow: inputs.cashFlow.annualCashFlow,
    netOperatingIncome: inputs.cashFlow.netOperatingIncome,
    capRatePct: inputs.cashFlow.capRatePct,
    cashOnCashPct: inputs.cashFlow.cashOnCashPct,
    cashInvested: inputs.cashFlow.cashInvested,
    investmentScore: inputs.score.score,
    factorCashFlow: inputs.score.factors.cashFlow.score,
    factorRentToPrice: inputs.score.factors.rentToPrice.score,
    factorTaxBurden: inputs.score.factors.taxBurden.score,
    factorNeighborhood: inputs.score.factors.neighborhoodGrowth.score,
    factorAppreciation: inputs.score.factors.appreciation.score,
  };

  if (inputs.property.squareFeet !== undefined) {
    numbers.squareFeet = inputs.property.squareFeet;
  }
  if (inputs.property.yearBuilt !== undefined) {
    numbers.yearBuilt = inputs.property.yearBuilt;
  }

  if (inputs.airbnb) {
    numbers.adr = inputs.airbnb.analysis.adr;
    numbers.airbnbOccupancyPct = inputs.airbnb.analysis.inputs.occupancyRatePct;
    numbers.airbnbGrossRevenue = inputs.airbnb.analysis.grossRevenueAnnual;
    numbers.airbnbNetCashFlow = inputs.airbnb.analysis.projectedAnnualNetCashFlow;
    if (inputs.airbnb.analysis.breakEvenMonths !== null) {
      numbers.airbnbBreakEvenMonths = inputs.airbnb.analysis.breakEvenMonths;
    }
  }

  const flags: Record<string, string> = {
    meetsOnePercentRule: inputs.rentalEstimate.yieldMetrics?.meetsOnePercentRule ? "yes" : "no",
    investmentRating: inputs.score.rating,
    strRiskLevel: inputs.airbnb?.analysis.strRiskLevel ?? "unknown",
  };

  return { numbers, flags };
}

function buildPromptContext(inputs: MemoInputs, metrics: MemoMetrics) {
  return {
    property: {
      address: inputs.property.address,
      city: inputs.property.city,
      state: inputs.property.state,
      zipCode: inputs.property.zipCode,
      propertyType: inputs.property.propertyType,
      bedrooms: inputs.property.bedrooms,
      bathrooms: inputs.property.bathrooms,
    },
    rentSource: inputs.rentalEstimate.source,
    airbnbSource: inputs.airbnb?.source ?? "n/a",
    numbers: metrics.numbers,
    flags: metrics.flags,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

function buildFallbackMemo(inputs: MemoInputs, metrics: MemoMetrics): InvestmentMemo {
  const { property, score } = inputs;
  const cf = inputs.cashFlow;
  const rent = inputs.rentalEstimate;

  const headline = `${score.rating} score (${score.score}/100): ${property.address}, ${property.city} at $${formatMoney(
    property.listPrice,
  )}`;

  const summary =
    `This ${property.bedrooms}-bed ${property.propertyType.toLowerCase().replace("_", " ")} in ` +
    `${property.city}, ${property.state} lists at $${formatMoney(property.listPrice)} ` +
    `and projects ${cf.monthlyCashFlow >= 0 ? "positive" : "negative"} cash flow of ` +
    `$${formatMoney(Math.abs(cf.monthlyCashFlow))}/mo at the supplied financing assumptions, ` +
    `with a cap rate of ${cf.capRatePct}% and a ${score.score}/100 investment score.`;

  const strengths: string[] = [];
  const risks: string[] = [];
  const insights: string[] = [];

  // Strengths
  if (score.factors.neighborhoodGrowth.score >= 80) {
    strengths.push(
      `Neighborhood growth factor scores ${score.factors.neighborhoodGrowth.score}/100 — ` +
        `${property.city} ranks among the stronger US growth markets.`,
    );
  }
  if (score.factors.rentToPrice.score >= 70) {
    strengths.push(
      `Rent-to-price ratio of ${metrics.numbers["rentToPricePct"]}% is healthy for the price band ` +
        `(scoring ${score.factors.rentToPrice.score}/100).`,
    );
  }
  if (cf.cashOnCashPct >= 6) {
    strengths.push(
      `Cash-on-cash return of ${cf.cashOnCashPct}% exceeds typical 6% screening threshold.`,
    );
  }
  if (score.factors.appreciation.score >= 75) {
    strengths.push(
      `Appreciation factor scores ${score.factors.appreciation.score}/100 ` +
        `(combined year-built and price-per-sqft signal).`,
    );
  }
  if (strengths.length === 0) {
    strengths.push(
      `Property data is complete enough to underwrite (score ${score.score}/100); ` +
        `no individual factor screens as exceptionally strong at the supplied price.`,
    );
  }

  // Risks
  if (cf.monthlyCashFlow < 0) {
    risks.push(
      `Negative monthly cash flow of $${formatMoney(Math.abs(cf.monthlyCashFlow))} ` +
        `at ${metrics.numbers["downPaymentPct"]}% down / ${metrics.numbers["interestRatePct"]}% rate.`,
    );
  }
  if (score.factors.taxBurden.score < 50) {
    risks.push(
      `Tax burden factor ${score.factors.taxBurden.score}/100 — ` +
        `property taxes are above the national norm for this price band.`,
    );
  }
  if (cf.cashOnCashPct < 4) {
    risks.push(`Cash-on-cash return of ${cf.cashOnCashPct}% is below the 4% screening floor.`);
  }
  if (rent.source === "HUD_FMR" || rent.source === "MOCK") {
    risks.push(
      `Rental estimate sourced from ${rent.source} (no live RentCast/Zestimate match); ` +
        `treat the rent figure as a baseline, not a market rent.`,
    );
  }
  if (risks.length === 0) {
    risks.push(
      `No screening-level risks flagged at the supplied financing assumptions; ` +
        `verify market rent and tax bill against actual records before close.`,
    );
  }

  // Negotiation insights — purely metric-driven, no fabricated comps.
  insights.push(
    `Break-even monthly rent at the current price would require ` +
      `~$${formatMoney(cf.monthlyPaymentPITI + cf.expenses.monthlyOperatingTotal)}/mo ` +
      `(PITI plus operating reserves) to clear $0 cash flow.`,
  );
  if (cf.monthlyCashFlow < 0) {
    const priceCutForBreakeven = estimatePriceCutForBreakeven(inputs);
    if (priceCutForBreakeven !== null) {
      insights.push(
        `A list-price reduction of roughly $${formatMoney(priceCutForBreakeven)} ` +
          `would close the cash-flow gap at current rate and rent.`,
      );
    }
  }
  if (score.factors.taxBurden.score < 50) {
    insights.push(
      `Quote the high tax burden (factor ${score.factors.taxBurden.score}/100) when ` +
        `negotiating; protest the assessed value if the bill exceeds comparable assessments.`,
    );
  }

  const recommendation = pickRecommendation(score.score, cf.cashOnCashPct);
  const confidence: "Low" | "Moderate" | "High" =
    rent.source === "RENTCAST" || rent.source === "ZILLOW_ZESTIMATE"
      ? "High"
      : rent.source === "HUD_FMR"
        ? "Moderate"
        : "Low";

  return {
    headline,
    summary,
    strengths,
    risks,
    negotiationInsights: insights,
    recommendation,
    confidence,
  };
}

function pickRecommendation(score: number, cashOnCashPct: number): Recommendation {
  if (score >= 75 && cashOnCashPct >= 6) return "Buy";
  if (score >= 60 && cashOnCashPct >= 0) return "Negotiate";
  if (score >= 50) return "Investigate further";
  return "Pass";
}

function estimatePriceCutForBreakeven(inputs: MemoInputs): number | null {
  // First-order approximation: each $10k off price saves ~$66/mo P&I at
  // 7% / 30y. Walk that against the gap.
  const gap = -inputs.cashFlow.monthlyCashFlow;
  if (gap <= 0) return null;
  const savePerTenK = 66;
  const tenKs = Math.ceil(gap / savePerTenK);
  return tenKs * 10_000;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
