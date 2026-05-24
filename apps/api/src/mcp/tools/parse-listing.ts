/**
 * MCP tool: parse_listing
 *
 * Input:  Zillow URL.
 * Output: A parsed Property record.
 *
 * Phase 1 ships a DB-lookup fallback only — if the URL matches a row
 * already in the database, we return it (proves end-to-end wiring with
 * the storage layer). The real Zillow scraper lands in Task 1.3.
 */

import {
  ParseListingInputSchema,
  ParseListingOutputSchema,
  type Property,
  type PropertyType,
} from "@estate-iq/shared";
import { prisma } from "../../db/client.js";
import { defineTool } from "../registry.js";

export const parseListingTool = defineTool({
  name: "parse_listing",
  description:
    "Parse a Zillow listing URL and return a normalized Property record. Falls back to a database lookup if the URL has been seen before.",
  inputSchema: ParseListingInputSchema,
  outputSchema: ParseListingOutputSchema,
  async handler({ url }) {
    const existing = await prisma.property.findUnique({ where: { sourceUrl: url } });
    if (existing) {
      const property: Property = {
        sourceUrl: existing.sourceUrl,
        address: existing.address,
        city: existing.city,
        state: existing.state,
        zipCode: existing.zipCode,
        listPrice: Number(existing.listPrice),
        bedrooms: existing.bedrooms,
        bathrooms: Number(existing.bathrooms),
        ...(existing.squareFeet !== null ? { squareFeet: existing.squareFeet } : {}),
        ...(existing.lotSizeSqft !== null ? { lotSizeSqft: existing.lotSizeSqft } : {}),
        ...(existing.yearBuilt !== null ? { yearBuilt: existing.yearBuilt } : {}),
        propertyType: existing.propertyType as PropertyType,
        ...(existing.hoaMonthly !== null ? { hoaMonthly: Number(existing.hoaMonthly) } : {}),
        ...(existing.taxesAnnual !== null ? { taxesAnnual: Number(existing.taxesAnnual) } : {}),
        ...(existing.insuranceAnnual !== null
          ? { insuranceAnnual: Number(existing.insuranceAnnual) }
          : {}),
        ...(existing.description !== null ? { description: existing.description } : {}),
      };
      return { status: "ok" as const, property };
    }

    return {
      status: "not_implemented" as const,
      deferredTo: "Phase 1 / Task 1.3 — Zillow URL Parsing Engine",
      message: `Live parsing not implemented yet; URL '${url}' is not in the local database.`,
    };
  },
});
