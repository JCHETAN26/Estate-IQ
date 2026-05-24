/**
 * MCP tool: analyze_airbnb
 *
 * Wraps the airbnb-analysis service. Inputs are a Property plus
 * optional override knobs (ADR, occupancy, etc.). Output is the full
 * AirbnbAnalysis: projected revenue, break-even months, STR risk
 * level, monthly seasonality projection.
 */

import { AnalyzeAirbnbInputSchema, AnalyzeAirbnbOutputSchema } from "@estate-iq/shared";
import { analyzeAirbnbForProperty } from "../../services/airbnb-analysis.service.js";
import { defineTool } from "../registry.js";

export const analyzeAirbnbTool = defineTool({
  name: "analyze_airbnb",
  description:
    "Project short-term rental revenue, break-even timeline, and risk level for a property. Uses AirDNA market data when available, else derives ADR from long-term rent + city/zip multipliers.",
  inputSchema: AnalyzeAirbnbInputSchema,
  outputSchema: AnalyzeAirbnbOutputSchema,
  async handler({ property, overrides }) {
    const outcome = await analyzeAirbnbForProperty({
      property,
      ...(overrides ? { overrides } : {}),
    });
    if (outcome.ok) {
      return {
        status: "ok" as const,
        source: outcome.source,
        analysis: outcome.analysis,
      };
    }
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 2 / Task 2.3 — Airbnb Profitability Analyzer",
      message: `Airbnb analysis failed: ${outcome.reason} — ${outcome.message}`,
    };
  },
});
