/**
 * MCP tool: calculate_cash_flow
 *
 * Input:  Financing + rental assumptions.
 * Output: Cash flow, NOI, cap rate, cash-on-cash return.
 *
 * Phase 1 returns a not_implemented marker. Real calculation lands in
 * Phase 2 / Task 2.1.
 */

import { CalculateCashFlowInputSchema, CalculateCashFlowOutputSchema } from "@estate-iq/shared";
import { defineTool } from "../registry.js";

export const calculateCashFlowTool = defineTool({
  name: "calculate_cash_flow",
  description:
    "Combine financing and rental assumptions to produce monthly cash flow, NOI, cap rate, and cash-on-cash return.",
  inputSchema: CalculateCashFlowInputSchema,
  outputSchema: CalculateCashFlowOutputSchema,
  async handler() {
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 2 / Task 2.1 — Mortgage & Expense Engine",
      message: "Calculation framework wired; numeric implementation lands in Phase 2.",
    };
  },
});
