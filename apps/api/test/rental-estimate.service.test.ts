/**
 * Rental estimate service tests.
 *
 * Skips the live RentCast call (skipLive: true) and the DB cache
 * (skipCache: true) so the service falls through to the fixture branch.
 * Also skips persistence so we don't need a running Postgres in CI.
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
  zipCode: "78704", // we have market averages for this zip
};

const totallyUnknown: Property = {
  ...sampleProperty,
  sourceUrl: "https://www.zillow.com/homedetails/elsewhere/8_zpid/",
  address: "1 Far Away Pl",
  state: "CA",
  zipCode: "90001",
};

describe("estimateRental — fixture fallback", () => {
  it("returns the recorded fixture when the address matches", async () => {
    const outcome = await estimateRental(sampleProperty, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
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
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // 78704 median is 3500 baseline (3-bed); this is a 4-bed so +12%.
    // 3500 * 1.12 = 3920, rounded.
    expect(outcome.estimate.estimatedRent).toBeCloseTo(3920, 0);
    expect(outcome.estimate.comparables).toEqual([]);
    expect(outcome.estimate.source).toBe("MOCK");
  });

  it("attaches yield metrics", async () => {
    const outcome = await estimateRental(sampleProperty, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const yields = outcome.estimate.yieldMetrics;
    expect(yields).toBeDefined();
    expect(yields?.rentToPricePct).toBeCloseTo(7.733, 2);
    expect(yields?.grossRentMultiplier).toBeCloseTo(12.93, 1);
    expect(yields?.meetsOnePercentRule).toBe(false);
  });

  it("returns a structured failure when neither fixture nor market average matches", async () => {
    const outcome = await estimateRental(totallyUnknown, {
      skipLive: true,
      skipCache: true,
      skipPersist: true,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_estimate_available");
  });
});
