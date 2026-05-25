/**
 * Investment memo schema.
 *
 * The shape we expect from the LLM. Used to validate the response and
 * surface schema_mismatch errors when the model goes off-format.
 */

import { z } from "zod";

export const RecommendationSchema = z.enum(["Buy", "Pass", "Negotiate", "Investigate further"]);
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ConfidenceSchema = z.enum(["Low", "Moderate", "High"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const InvestmentMemoSchema = z.object({
  headline: z.string().min(20).max(200),
  summary: z.string().min(40),
  strengths: z.array(z.string().min(10)).min(1).max(8),
  risks: z.array(z.string().min(10)).min(1).max(8),
  negotiationInsights: z.array(z.string().min(10)).min(1).max(8),
  recommendation: RecommendationSchema,
  confidence: ConfidenceSchema,
});
export type InvestmentMemo = z.infer<typeof InvestmentMemoSchema>;

/** A flat record of every metric the prompt is allowed to reference. */
export type MemoMetrics = {
  numbers: Record<string, number>;
  flags: Record<string, string>;
};
