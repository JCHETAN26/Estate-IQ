/**
 * Rental estimate service tests.
 *
 * The strategy chain is: cache -> Zestimate -> RentCast -> HUD FMR -> fixtures.
 *
 * Most tests skip the live calls (RentCast, Zestimate) so they can
 * pin a specific tier. The HUD FMR tier is enabled by default because
 * it has zero side effects and gets ~35k US zip codes.
 */

import { describe, expect, it } from "vitest";
import type { Property } from "@estate-iq/shared";
import { estimateRental } from "../src/services/rental-estimate.service.js";

const sampleProperty: Property = {
  sourceUrl: "https://www.zillow.com/homedetails/sample-listing/0_zpid/",
  address: "123 Sample St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  listPrice: 450_000,
  bedrooms: 3,
  bathrooms: 2.5,
  squareFeet: 1850,
  propertyType: "SINGLE_FAMILY",
};

const unfamiliarAddressInKnownZip: Property = {
  ...sampleProperty,
  sourceUrl: "https://www.zillow.com/homedetails/unknown-address/9_zpid/",
  address: "999 Unknown St",
  bedrooms: 4,
  zipCode: "78704", // we have HUD + fixtures market average for this zip
};

const offGridZip: Property = {
  ...sampleProperty,
  sourceUrl: "https://www.zillow.com/homedetails/elsewhere/8_zpid/",
  address: "1 Far Away Pl",
  state: "ZZ",
  zipCode: "00000", // not in HUD data, not in fixtures
};

describe("estimateRental — fixture fallback (HUD disabled)", () => {
  it("returns the recorded fixture when the address matches", async () => {
    const outcome = await estimateRental(sampleProperty, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
      skipZestimate: true,
      skipHudFmr: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.estimate.source).toBe("MOCK");
    expect(outcome.estimate.estimatedRent).toBeCloseTo(2900, 0);
    expect(outcome.estimate.rentLow).toBeCloseTo(2700, 0);
    expect(outcome.estimate.rentHigh).toBeCloseTo(3100, 0);
    expect(outcome.estimate.comparables.length).toBeGreaterThanOrEqual(2);
  });

  it("synthesizes an estimate from market averages when address is unknown", async () => {
    const outcome = await estimateRental(unfamiliarAddressInKnownZip, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
      skipZestimate: true,
      skipHudFmr: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // 78704 fixture median is 3500 baseline (3-bed); 4-bed +12% = 3920.
    expect(outcome.estimate.estimatedRent).toBeCloseTo(3920, 0);
    expect(outcome.estimate.comparables).toEqual([]);
    expect(outcome.estimate.source).toBe("MOCK");
  });

  it("attaches yield metrics", async () => {
    const outcome = await estimateRental(sampleProperty, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
      skipZestimate: true,
      skipHudFmr: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const yields = outcome.estimate.yieldMetrics;
    expect(yields).toBeDefined();
    expect(yields?.rentToPricePct).toBeCloseTo(7.733, 2);
    expect(yields?.grossRentMultiplier).toBeCloseTo(12.93, 1);
    expect(yields?.meetsOnePercentRule).toBe(false);
  });

  it("returns a structured failure when no provider produces an estimate", async () => {
    const outcome = await estimateRental(offGridZip, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
      skipZestimate: true,
      // HUD has no entry for ZIP 00000.
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_estimate_available");
  });
});

describe("estimateRental — HUD FMR provider", () => {
  it("returns a HUD FMR rent for a known US zip when no other provider runs", async () => {
    const outcome = await estimateRental(sampleProperty, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
      skipZestimate: true,
      // HUD enabled (default).
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.estimate.source).toBe("HUD_FMR");
    expect(outcome.estimate.estimatedRent).toBeGreaterThan(2000);
    expect(outcome.estimate.estimatedRent).toBeLessThan(5000);
  });
});
