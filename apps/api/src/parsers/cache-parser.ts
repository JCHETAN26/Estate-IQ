/**
 * Cache parser.
 *
 * Looks the URL up in the database. The orchestrator tries this first
 * so repeat requests for the same listing avoid both live fetches and
 * fixture loading.
 */

import { type Property, type PropertyType } from "@estate-iq/shared";
import { prisma } from "../db/client.js";
import type { ListingParser, ParseResult } from "./types.js";
import { canonicalizeZillowUrl } from "./zpid.js";

function rowToProperty(row: {
  sourceUrl: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listPrice: { toString: () => string } | number;
  bedrooms: number;
  bathrooms: { toString: () => string } | number;
  squareFeet: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  hoaMonthly: { toString: () => string } | number | null;
  taxesAnnual: { toString: () => string } | number | null;
  insuranceAnnual: { toString: () => string } | number | null;
  description: string | null;
}): Property {
  return {
    sourceUrl: row.sourceUrl,
    address: row.address,
    city: row.city,
    state: row.state,
    zipCode: row.zipCode,
    listPrice: Number(row.listPrice),
    bedrooms: row.bedrooms,
    bathrooms: Number(row.bathrooms),
    ...(row.squareFeet !== null ? { squareFeet: row.squareFeet } : {}),
    ...(row.lotSizeSqft !== null ? { lotSizeSqft: row.lotSizeSqft } : {}),
    ...(row.yearBuilt !== null ? { yearBuilt: row.yearBuilt } : {}),
    propertyType: row.propertyType as PropertyType,
    ...(row.hoaMonthly !== null ? { hoaMonthly: Number(row.hoaMonthly) } : {}),
    ...(row.taxesAnnual !== null ? { taxesAnnual: Number(row.taxesAnnual) } : {}),
    ...(row.insuranceAnnual !== null ? { insuranceAnnual: Number(row.insuranceAnnual) } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
  };
}

export const cacheParser: ListingParser = {
  source: "cache",
  async parse(url: string): Promise<ParseResult> {
    const start = process.hrtime.bigint();
    const ms = () => Number((process.hrtime.bigint() - start) / 1_000_000n);

    const canonical = canonicalizeZillowUrl(url) ?? url;
    const row = await prisma.property.findUnique({ where: { sourceUrl: canonical } });
    if (!row) {
      return {
        ok: false,
        source: "cache",
        reason: "fixture_not_found",
        message: "URL not in cache",
        durationMs: ms(),
      };
    }
    return { ok: true, source: "cache", property: rowToProperty(row), durationMs: ms() };
  },
};
