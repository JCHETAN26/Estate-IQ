/**
 * Rental estimate service.
 *
 * Strategy chain:
 *   1. cache    — most recent RentalEstimate row for the property (DB)
 *   2. live     — RentCast API
 *   3. fixture  — local recorded responses
 *
 * Successful estimates are persisted to the rental_estimates table so
 * subsequent calls hit the cache. The service computes yield metrics
 * (rent-to-price, GRM, 1% rule) at the boundary so callers don't have
 * to recompute them.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  type ComparableRental,
  type Property,
  type RentalEstimate,
  type RentalSource,
} from "@estate-iq/shared";
import { prisma } from "../db/client.js";
import {
  getRentEstimate,
  mapPropertyType,
  type RentEstimateResult,
} from "../integrations/rentcast/client.js";
import type { RentcastRentEstimate } from "../integrations/rentcast/types.js";
import { logger } from "../mcp/logger.js";
import { computeYieldMetrics } from "./yield.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = resolve(here, "fixtures/rental-estimates.json");

const DEFAULT_OCCUPANCY_PCT = 95;

type FixtureFile = {
  estimates: Array<{
    subjectAddress: string;
    rent: number;
    rentLow?: number;
    rentHigh?: number;
    comparables: ComparableRental[];
  }>;
  marketAverages: Record<string, { medianRent: number; medianPricePerSqft: number }>;
};

let cachedFixtures: FixtureFile | null = null;

async function loadFixtures(): Promise<FixtureFile> {
  if (cachedFixtures) return cachedFixtures;
  const raw = await readFile(FIXTURES_PATH, "utf8");
  cachedFixtures = JSON.parse(raw) as FixtureFile;
  return cachedFixtures;
}

export type RentalEstimateOptions = {
  /** Skip the live RentCast call (tests, offline mode). */
  skipLive?: boolean;
  /** Skip cache lookup, force a fresh estimate. */
  skipCache?: boolean;
  /** Skip persistence (tests). */
  skipPersist?: boolean;
  /** Override the comp count for the live call. */
  compCount?: number;
};

export type RentalEstimateOutcome =
  | { ok: true; estimate: RentalEstimate; durationMs: number }
  | { ok: false; reason: string; message: string };

function fixtureKey(property: Property): string {
  return `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
}

function marketAverageKey(property: Property): string {
  return `${property.state}_${property.zipCode}`;
}

function rentcastResponseToComparables(response: RentcastRentEstimate): ComparableRental[] {
  return response.comparables.map((comp) => {
    const result: ComparableRental = {
      address: comp.formattedAddress ?? comp.addressLine1 ?? "Unknown address",
      city: comp.city ?? "",
      state: comp.state ?? "",
      zipCode: comp.zipCode ?? "",
      propertyType: comp.propertyType ?? "Unknown",
      monthlyRent: comp.price,
    };
    if (typeof comp.bedrooms === "number") result.bedrooms = comp.bedrooms;
    if (typeof comp.bathrooms === "number") result.bathrooms = comp.bathrooms;
    if (typeof comp.squareFootage === "number") result.squareFootage = comp.squareFootage;
    if (typeof comp.yearBuilt === "number") result.yearBuilt = comp.yearBuilt;
    if (typeof comp.distance === "number") result.distanceMiles = comp.distance;
    if (typeof comp.daysOld === "number") result.daysOld = comp.daysOld;
    if (typeof comp.correlation === "number") result.correlation = comp.correlation;
    if (comp.status) result.status = comp.status;
    if (comp.listedDate) result.listedDate = comp.listedDate;
    return result;
  });
}

function buildEstimate(
  source: RentalSource,
  estimatedRent: number,
  comparables: ComparableRental[],
  property: Property,
  rentLow?: number,
  rentHigh?: number,
): RentalEstimate {
  const estimate: RentalEstimate = {
    source,
    estimatedRent: round2(estimatedRent),
    occupancyRatePct: DEFAULT_OCCUPANCY_PCT,
    comparables,
    yieldMetrics: computeYieldMetrics(estimatedRent, property.listPrice),
  };
  if (rentLow !== undefined) estimate.rentLow = round2(rentLow);
  if (rentHigh !== undefined) estimate.rentHigh = round2(rentHigh);
  return estimate;
}

async function readCache(property: Property): Promise<RentalEstimate | null> {
  try {
    const propertyRow = await prisma.property.findUnique({
      where: { sourceUrl: property.sourceUrl },
      include: {
        rentalEstimates: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const latest = propertyRow?.rentalEstimates[0];
    if (!latest) return null;
    const comparables = parseStoredComparables(latest.comparables);
    return buildEstimate(
      latest.source,
      Number(latest.estimatedRent),
      comparables,
      property,
      latest.rentLow !== null ? Number(latest.rentLow) : undefined,
      latest.rentHigh !== null ? Number(latest.rentHigh) : undefined,
    );
  } catch (error) {
    logger.warn("rental.cache_read_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function parseStoredComparables(value: unknown): ComparableRental[] {
  if (!Array.isArray(value)) return [];
  // The DB column is JSON; values came from this codebase originally so
  // they already match ComparableRental shape. Re-validate defensively.
  return value.filter((entry): entry is ComparableRental => {
    return (
      typeof entry === "object" &&
      entry !== null &&
      "address" in entry &&
      "monthlyRent" in entry &&
      typeof (entry as ComparableRental).monthlyRent === "number"
    );
  });
}

async function persist(property: Property, estimate: RentalEstimate): Promise<void> {
  try {
    const propertyRow = await prisma.property.findUnique({
      where: { sourceUrl: property.sourceUrl },
    });
    if (!propertyRow) {
      logger.debug("rental.persist_skipped_no_property", {
        sourceUrl: property.sourceUrl,
      });
      return;
    }
    await prisma.rentalEstimate.create({
      data: {
        propertyId: propertyRow.id,
        source: estimate.source,
        estimatedRent: estimate.estimatedRent,
        ...(estimate.rentLow !== undefined ? { rentLow: estimate.rentLow } : {}),
        ...(estimate.rentHigh !== undefined ? { rentHigh: estimate.rentHigh } : {}),
        ...(estimate.occupancyRatePct !== undefined
          ? { occupancyRatePct: estimate.occupancyRatePct }
          : {}),
        comparables: estimate.comparables as unknown as object,
      },
    });
  } catch (error) {
    logger.warn("rental.persist_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function tryFixture(property: Property): Promise<RentalEstimate | null> {
  const fixtures = await loadFixtures();
  const key = fixtureKey(property);
  const exact = fixtures.estimates.find((entry) => entry.subjectAddress === key);
  if (exact) {
    return buildEstimate(
      "MOCK",
      exact.rent,
      exact.comparables,
      property,
      exact.rentLow,
      exact.rentHigh,
    );
  }

  // No exact match — synthesize an estimate from market averages so we
  // always return something useful for downstream callers.
  const market = fixtures.marketAverages[marketAverageKey(property)];
  if (!market) return null;
  const adjusted = adjustRentForBedrooms(market.medianRent, property.bedrooms);
  return buildEstimate(
    "MOCK",
    adjusted,
    [],
    property,
    Math.round(adjusted * 0.92),
    Math.round(adjusted * 1.08),
  );
}

/**
 * Cheap rent adjustment by bedroom count when the only data we have
 * is a zip-code median (assumes 3-bedroom baseline).
 */
function adjustRentForBedrooms(baseRent: number, bedrooms: number): number {
  const delta = (bedrooms - 3) * 0.12; // ±12% per bedroom from baseline
  return Math.round(baseRent * (1 + delta));
}

export async function estimateRental(
  property: Property,
  options: RentalEstimateOptions = {},
): Promise<RentalEstimateOutcome> {
  const start = process.hrtime.bigint();
  const ms = () => Number((process.hrtime.bigint() - start) / 1_000_000n);

  // 1. Cache
  if (!options.skipCache) {
    const cached = await readCache(property);
    if (cached) {
      logger.info("rental.cache_hit", { sourceUrl: property.sourceUrl });
      return { ok: true, estimate: cached, durationMs: ms() };
    }
  }

  // 2. Live
  if (!options.skipLive) {
    const result: RentEstimateResult = await getRentEstimate({
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      ...(mapPropertyType(property.propertyType)
        ? { propertyType: mapPropertyType(property.propertyType) as string }
        : {}),
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      ...(property.squareFeet !== undefined ? { squareFootage: property.squareFeet } : {}),
      ...(options.compCount !== undefined ? { compCount: options.compCount } : {}),
    });
    if (result.ok) {
      const estimate = buildEstimate(
        "RENTCAST",
        result.data.rent,
        rentcastResponseToComparables(result.data),
        property,
        result.data.rentRangeLow,
        result.data.rentRangeHigh,
      );
      if (!options.skipPersist) await persist(property, estimate);
      logger.info("rental.live_hit", {
        sourceUrl: property.sourceUrl,
        rent: estimate.estimatedRent,
        comps: estimate.comparables.length,
      });
      return { ok: true, estimate, durationMs: ms() };
    }
    logger.debug("rental.live_miss", {
      sourceUrl: property.sourceUrl,
      reason: result.error.kind,
    });
  }

  // 3. Fixture / market average
  const fallback = await tryFixture(property);
  if (fallback) {
    if (!options.skipPersist) await persist(property, fallback);
    logger.info("rental.fixture_hit", { sourceUrl: property.sourceUrl });
    return { ok: true, estimate: fallback, durationMs: ms() };
  }

  return {
    ok: false,
    reason: "no_estimate_available",
    message: "No rental estimate could be produced (cache, RentCast, fixtures all empty)",
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
