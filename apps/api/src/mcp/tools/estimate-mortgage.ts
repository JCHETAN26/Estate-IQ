/**
 * MCP tool: estimate_mortgage
 *
 * Input:  Financing assumptions (price, down payment, rate, term, taxes, etc.)
 * Output: Monthly payment breakdown.
 *
 * Phase 1 returns a not_implemented marker. Real calculation lands in
 * Phase 2 / Task 2.1 inside packages/analysis-engine.
 */

import { EstimateMortgageInputSchema, EstimateMortgageOutputSchema } from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const estimateMortgageTool = defineTool({
  name: "estimate_mortgage",
  description:
    "Estimate the monthly mortgage payment given financing assumptions (PITI + HOA). Returns a deterministic breakdown.",
  inputSchema: EstimateMortgageInputSchema,
  outputSchema: EstimateMortgageOutputSchema,
  async handler() {
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 2 / Task 2.1 — Mortgage & Expense Engine",
      message: "Calculation framework wired; numeric implementation lands in Phase 2.",
    };
  },
});
