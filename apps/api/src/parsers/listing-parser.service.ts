/**
 * Listing parser service — strategy chain orchestrator.
 *
 * Order:
 *   1. cache   — DB hit on canonicalized sourceUrl
 *   2. live    — fetch Zillow HTML and extract __NEXT_DATA__
 *   3. mock    — local fixtures (also the deterministic fallback path)
 *
 * On success, the parsed property is upserted into the DB so the next
 * request for the same URL is served by the cache parser.
 */

import type { Property } from "@estate-iq/shared";
import { prisma } from "../db/client.js";
import { logger } from "../mcp/logger.js";
import { cacheParser } from "./cache-parser.js";
import { liveParser } from "./live-parser.js";
import { mockParser } from "./mock-parser.js";
import type { ListingParser, ParseFailureReason, ParseResult, ParseSource } from "./types.js";
import { canonicalizeZillowUrl } from "./zpid.js";

export type ParseListingOptions = {
  /** Skip the live fetch — useful for tests and the verification script. */
  skipLive?: boolean;
  /** Skip persistence — useful for tests. */
  skipPersist?: boolean;
};

export type ServiceResult =
  | { ok: true; source: ParseSource; property: Property; durationMs: number }
  | {
      ok: false;
      reason: ParseFailureReason;
      message: string;
      attempts: ReadonlyArray<{
        source: ParseSource;
        reason: ParseFailureReason;
        message: string;
        durationMs: number;
      }>;
    };

async function persist(property: Property, rawListing?: unknown): Promise<void> {
  try {
    await prisma.property.upsert({
      where: { sourceUrl: property.sourceUrl },
      update: {
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        listPrice: property.listPrice,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        ...(property.squareFeet !== undefined ? { squareFeet: property.squareFeet } : {}),
        ...(property.lotSizeSqft !== undefined ? { lotSizeSqft: property.lotSizeSqft } : {}),
        ...(property.yearBuilt !== undefined ? { yearBuilt: property.yearBuilt } : {}),
        propertyType: property.propertyType,
        ...(property.hoaMonthly !== undefined ? { hoaMonthly: property.hoaMonthly } : {}),
        ...(property.taxesAnnual !== undefined ? { taxesAnnual: property.taxesAnnual } : {}),
        ...(property.insuranceAnnual !== undefined
          ? { insuranceAnnual: property.insuranceAnnual }
          : {}),
        ...(property.description !== undefined ? { description: property.description } : {}),
        ...(rawListing !== undefined ? { rawListing: rawListing as object } : {}),
      },
      create: {
        sourceUrl: property.sourceUrl,
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        listPrice: property.listPrice,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        ...(property.squareFeet !== undefined ? { squareFeet: property.squareFeet } : {}),
        ...(property.lotSizeSqft !== undefined ? { lotSizeSqft: property.lotSizeSqft } : {}),
        ...(property.yearBuilt !== undefined ? { yearBuilt: property.yearBuilt } : {}),
        propertyType: property.propertyType,
        ...(property.hoaMonthly !== undefined ? { hoaMonthly: property.hoaMonthly } : {}),
        ...(property.taxesAnnual !== undefined ? { taxesAnnual: property.taxesAnnual } : {}),
        ...(property.insuranceAnnual !== undefined
          ? { insuranceAnnual: property.insuranceAnnual }
          : {}),
        ...(property.description !== undefined ? { description: property.description } : {}),
        ...(rawListing !== undefined ? { rawListing: rawListing as object } : {}),
      },
    });
  } catch (error) {
    logger.warn("listing.persist_failed", {
      sourceUrl: property.sourceUrl,
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

export async function parseListing(
  rawUrl: string,
  options: ParseListingOptions = {},
): Promise<ServiceResult> {
  const canonical = canonicalizeZillowUrl(rawUrl) ?? rawUrl;

  const chain: ListingParser[] = [cacheParser];
  if (!options.skipLive) chain.push(liveParser);
  chain.push(mockParser);

  const attempts: Array<{
    source: ParseSource;
    reason: ParseFailureReason;
    message: string;
    durationMs: number;
  }> = [];

  for (const parser of chain) {
    let result: ParseResult;
    try {
      result = await parser.parse(canonical);
    } catch (error) {
      result = {
        ok: false,
        source: parser.source,
        reason: "fetch_failed",
        message: error instanceof Error ? error.message : String(error),
        durationMs: 0,
      };
    }

    if (result.ok) {
      logger.info("listing.parse.success", {
        url: canonical,
        source: result.source,
        durationMs: result.durationMs,
      });
      // Don't re-persist a cache hit (it's already in the DB).
      if (result.source !== "cache" && !options.skipPersist) {
        await persist(result.property, result.rawListing);
      }
      return result;
    }

    attempts.push({
      source: result.source,
      reason: result.reason,
      message: result.message,
      durationMs: result.durationMs,
    });
    logger.debug("listing.parse.miss", {
      url: canonical,
      source: result.source,
      reason: result.reason,
    });
  }

  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    reason: last?.reason ?? "fetch_failed",
    message: last?.message ?? "All parser strategies failed",
    attempts,
  };
}
