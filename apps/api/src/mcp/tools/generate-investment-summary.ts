/**
 * MCP tool: generate_investment_summary
 *
 * Input:  Property + (optional) computed metrics.
 * Output: Markdown investment memo.
 *
 * Phase 1 returns a not_implemented marker. Real LLM-backed memo
 * generation lands in Phase 3 / Task 3.1.
 */

import {
  GenerateInvestmentSummaryInputSchema,
  GenerateInvestmentSummaryOutputSchema,
} from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const generateInvestmentSummaryTool = defineTool({
  name: "generate_investment_summary",
  description:
    "Generate a structured Markdown investment memo grounded in the supplied property and computed metrics.",
  inputSchema: GenerateInvestmentSummaryInputSchema,
  outputSchema: GenerateInvestmentSummaryOutputSchema,
  async handler() {
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 3 / Task 3.1 — AI Memo Generation",
      message: "Memo framework wired; LLM implementation lands in Phase 3.",
    };
  },
});
