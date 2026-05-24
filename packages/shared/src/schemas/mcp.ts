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
  monthlyPrincipalAndInterest: z.number(),
  monthlyTaxesAndInsurance: z.number(),
  monthlyHoa: z.number(),
  monthlyPaymentTotal: z.number(),
  loanAmount: z.number(),
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
  monthlyCashFlow: z.number(),
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
  "generate_investment_summary",
] as const;

export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);
export type McpToolName = z.infer<typeof McpToolNameSchema>;
