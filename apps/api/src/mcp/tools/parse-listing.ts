/**
 * MCP tool: parse_listing
 *
 * Input:  Zillow URL.
 * Output: A parsed Property record.
 *
 * Strategy chain (cache -> live -> mock) lives in the listing parser
 * service. This tool just adapts service results to the MCP output
 * schema.
 */

import { ParseListingInputSchema, ParseListingOutputSchema } from "@estate-iq/shared";
import { parseListing } from "../../parsers/listing-parser.service.js";
import { defineTool } from "../registry.js";

export const parseListingTool = defineTool({
  name: "parse_listing",
  description:
    "Parse a Zillow listing URL and return a normalized Property record. Tries DB cache, then live fetch, then local fixtures.",
  inputSchema: ParseListingInputSchema,
  outputSchema: ParseListingOutputSchema,
  async handler({ url }) {
    const result = await parseListing(url);
    if (result.ok) {
      return { status: "ok" as const, property: result.property };
    }
    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 1 / Task 1.3 — Zillow URL Parsing Engine",
      message: `Parse failed: ${result.reason} — ${result.message}`,
    };
  },
});
