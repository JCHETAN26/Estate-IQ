/**
 * MCP tool: estimate_rental
 *
 * Wraps the rental-estimate service. Strategy chain (cache -> RentCast ->
 * fixtures) is enforced by the service layer; this tool just adapts the
 * result to the MCP output schema.
 */

import { EstimateRentalInputSchema, EstimateRentalOutputSchema } from "@estate-iq/shared";
import { estimateRental } from "../../services/rental-estimate.service.js";
import { defineTool } from "../registry.js";

export const estimateRentalTool = defineTool({
  name: "estimate_rental",
  description:
    "Estimate monthly rent for a property using RentCast (with cache + fixture fallbacks) and return comparable rentals plus yield metrics.",
  inputSchema: EstimateRentalInputSchema,
  outputSchema: EstimateRentalOutputSchema,
  async handler(property) {
    const outcome = await estimateRental(property);
    if (outcome.ok) {
      return { status: "ok" as const, estimate: outcome.estimate };
    }
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 2 / Task 2.2 — Rental Estimation System",
      message: `Rental estimate failed: ${outcome.reason} — ${outcome.message}`,
    };
  },
});
