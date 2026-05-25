/**
 * MCP tool input/output schemas.
 *
 * Each tool gets one input schema and one output schema. Schemas are
 * defined here (in shared) so both the API tool implementations and any
 * frontend caller see identical types.
 *
 * Phase 1 ships the schemas + framework. Most output payloads include
 * a `status: "not_implemented"` discriminant — Phase 2 (financial engine)
 * and Phase 3 (LLM memo) will replace those branches with real outputs.
 */

import { z } from "zod";
import { PropertySchema } from "./property.js";
import { FinancingAssumptionsSchema, RentalAssumptionsSchema } from "./financing.js";
import { RentalEstimateSchema } from "./rental.js";

// Discriminated union helper for "we shipped the framework but the
// concrete numeric implementation lands in a later phase". Using this
// keeps callers honest: they cannot accidentally read undefined fields.
const NotImplementedSchema = z.object({
  status: z.literal("not_implemented"),
  deferredTo: z.string(),
  message: z.string(),
});
export type NotImplemented = z.infer<typeof NotImplementedSchema>;

// ---------------------------------------------------------------------------
// parse_listing
// ---------------------------------------------------------------------------

export const ParseListingInputSchema = z.object({
  url: z.string().url(),
});
export type ParseListingInput = z.infer<typeof ParseListingInputSchema>;

export const ParseListingOutputSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), property: PropertySchema }),
  NotImplementedSchema,
]);
export type ParseListingOutput = z.infer<typeof ParseListingOutputSchema>;

// ---------------------------------------------------------------------------
// estimate_mortgage
// ---------------------------------------------------------------------------

export const EstimateMortgageInputSchema = FinancingAssumptionsSchema;
export type EstimateMortgageInput = z.infer<typeof EstimateMortgageInputSchema>;

const MortgageMetricsSchema = z.object({
  status: z.literal("ok"),
  loanAmount: z.number(),
  downPayment: z.number(),
  ltv: z.number(),
  monthlyPrincipalAndInterest: z.number(),
  monthlyTaxes: z.number(),
  monthlyInsurance: z.number(),
  monthlyHoa: z.number(),
  monthlyPmi: z.number(),
  /** PITI + HOA + PMI rolled into one figure. */
  monthlyPaymentTotal: z.number(),
  totalInterestOverTerm: z.number(),
});
export const EstimateMortgageOutputSchema = z.discriminatedUnion("status", [
  MortgageMetricsSchema,
  NotImplementedSchema,
]);
export type EstimateMortgageOutput = z.infer<typeof EstimateMortgageOutputSchema>;

// ---------------------------------------------------------------------------
// calculate_cash_flow
// ---------------------------------------------------------------------------

export const CalculateCashFlowInputSchema = z.object({
  financing: FinancingAssumptionsSchema,
  rental: RentalAssumptionsSchema,
});
export type CalculateCashFlowInput = z.infer<typeof CalculateCashFlowInputSchema>;

const CashFlowMetricsSchema = z.object({
  status: z.literal("ok"),
  cashInvested: z.number(),
  monthlyPaymentPITI: z.number(),
  monthlyEffectiveRent: z.number(),
  monthlyCashFlow: z.number(),
  annualCashFlow: z.number(),
  netOperatingIncome: z.number(),
  capRatePct: z.number(),
  cashOnCashPct: z.number(),
});
export const CalculateCashFlowOutputSchema = z.discriminatedUnion("status", [
  CashFlowMetricsSchema,
  NotImplementedSchema,
]);
export type CalculateCashFlowOutput = z.infer<typeof CalculateCashFlowOutputSchema>;

// ---------------------------------------------------------------------------
// estimate_rental
// ---------------------------------------------------------------------------

export const EstimateRentalInputSchema = PropertySchema;
export type EstimateRentalInput = z.infer<typeof EstimateRentalInputSchema>;

export const EstimateRentalOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    estimate: RentalEstimateSchema,
  }),
  NotImplementedSchema,
]);
export type EstimateRentalOutput = z.infer<typeof EstimateRentalOutputSchema>;

// ---------------------------------------------------------------------------
// analyze_airbnb
// ---------------------------------------------------------------------------

export const AirbnbInputOverridesSchema = z
  .object({
    averageDailyRate: z.number().positive().optional(),
    occupancyRatePct: z.number().min(0).max(100).optional(),
    cleaningFeePerBooking: z.number().nonnegative().optional(),
    cleaningFeePassedThrough: z.boolean().optional(),
    averageStayNights: z.number().positive().optional(),
    managementFeePct: z.number().min(0).max(100).optional(),
    furnishingCost: z.number().nonnegative().optional(),
    monthlyFixedCarryingCost: z.number().nonnegative().optional(),
    peakMonth: z.number().int().min(1).max(12).optional(),
    seasonalityAmplitude: z.number().min(0).max(1).optional(),
  })
  .strict();
export type AirbnbInputOverrides = z.infer<typeof AirbnbInputOverridesSchema>;

export const AnalyzeAirbnbInputSchema = z.object({
  property: PropertySchema,
  overrides: AirbnbInputOverridesSchema.optional(),
});
export type AnalyzeAirbnbInput = z.infer<typeof AnalyzeAirbnbInputSchema>;

const StrRiskLevelSchema = z.enum(["Low", "Moderate", "High"]);
const AirbnbAnalysisOutputDataSchema = z.object({
  inputs: z.object({
    averageDailyRate: z.number(),
    occupancyRatePct: z.number(),
    cleaningFeePerBooking: z.number(),
    cleaningFeePassedThrough: z.boolean(),
    averageStayNights: z.number(),
    managementFeePct: z.number(),
    furnishingCost: z.number(),
    monthlyFixedCarryingCost: z.number(),
    peakMonth: z.number(),
    seasonalityAmplitude: z.number(),
  }),
  adr: z.number(),
  occupancyRate: z.number(),
  bookedNightsPerYear: z.number(),
  bookingsPerYear: z.number(),
  grossRevenueAnnual: z.number(),
  cleaningCostAnnual: z.number(),
  managementCostAnnual: z.number(),
  furnishingAmortizedAnnual: z.number(),
  projectedAnnualRevenue: z.number(),
  projectedAnnualNetCashFlow: z.number(),
  breakEvenMonths: z.number().nullable(),
  strRiskLevel: StrRiskLevelSchema,
  riskFactors: z.array(z.string()),
  seasonalityFactors: z.array(z.number()).length(12),
  monthlyRevenueProjection: z.array(z.number()).length(12),
});

export const AnalyzeAirbnbOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    source: z.enum(["AIRDNA", "MARKET_RULES"]),
    analysis: AirbnbAnalysisOutputDataSchema,
  }),
  NotImplementedSchema,
]);
export type AnalyzeAirbnbOutput = z.infer<typeof AnalyzeAirbnbOutputSchema>;

// ---------------------------------------------------------------------------
// score_investment
// ---------------------------------------------------------------------------

export const ScoreInvestmentInputSchema = z.object({
  listPrice: z.number().positive(),
  cashOnCashPct: z.number().optional(),
  rentToPricePct: z.number().optional(),
  propertyTaxAnnual: z.number().nonnegative().optional(),
  squareFeet: z.number().positive().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  city: z.string().min(1).optional(),
  state: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  medianPricePerSqft: z.number().positive().optional(),
});
export type ScoreInvestmentInput = z.infer<typeof ScoreInvestmentInputSchema>;

const FactorScoreSchema = z.object({
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(100),
  rationale: z.string(),
});

export const ScoreInvestmentOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    score: z.number().min(0).max(100),
    rating: z.enum(["Excellent", "Strong", "Moderate", "Weak", "Poor"]),
    factors: z.object({
      cashFlow: FactorScoreSchema,
      rentToPrice: FactorScoreSchema,
      taxBurden: FactorScoreSchema,
      neighborhoodGrowth: FactorScoreSchema,
      appreciation: FactorScoreSchema,
    }),
    rationale: z.array(z.string()),
  }),
  NotImplementedSchema,
]);
export type ScoreInvestmentOutput = z.infer<typeof ScoreInvestmentOutputSchema>;

// ---------------------------------------------------------------------------
// generate_investment_summary
// ---------------------------------------------------------------------------

export const GenerateInvestmentSummaryInputSchema = z.object({
  property: PropertySchema,
  metrics: z
    .object({
      monthlyCashFlow: z.number().optional(),
      capRatePct: z.number().optional(),
      cashOnCashPct: z.number().optional(),
      investmentScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
});
export type GenerateInvestmentSummaryInput = z.infer<typeof GenerateInvestmentSummaryInputSchema>;

const InvestmentSummarySchema = z.object({
  status: z.literal("ok"),
  summaryMarkdown: z.string(),
  promptVersion: z.string(),
  model: z.string().optional(),
});
export const GenerateInvestmentSummaryOutputSchema = z.discriminatedUnion("status", [
  InvestmentSummarySchema,
  NotImplementedSchema,
]);
export type GenerateInvestmentSummaryOutput = z.infer<typeof GenerateInvestmentSummaryOutputSchema>;

// ---------------------------------------------------------------------------
// Tool name registry — single source of truth for callers.
// ---------------------------------------------------------------------------

export const MCP_TOOL_NAMES = [
  "parse_listing",
  "estimate_mortgage",
  "calculate_cash_flow",
  "estimate_rental",
  "analyze_airbnb",
  "score_investment",
  "generate_investment_summary",
] as const;

export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);
export type McpToolName = z.infer<typeof McpToolNameSchema>;
