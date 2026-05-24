/**
 * Airbnb analysis service tests.
 *
 * Skips the live AirDNA call so the service falls through to the
 * market-rules branch. The market-rules branch in turn calls the
 * rental-estimate service, which we exercise via fixtures (no DB / no
 * network required).
 */

import { describe, expect, it } from "vitest";
import type { Property } from "@estate-iq/shared";
import { analyzeAirbnbForProperty } from "../src/services/airbnb-analysis.service.js";

const austinDowntown: Property = {
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

const elsewhere: Property = {
  ...austinDowntown,
  sourceUrl: "https://www.zillow.com/homedetails/elsewhere/8_zpid/",
  address: "1 Far Away Pl",
  state: "CA",
  zipCode: "90001",
};

describe("analyzeAirbnbForProperty — market rules fallback", () => {
  it("derives ADR from long-term rent and ratio for a known zip", async () => {
    const outcome = await analyzeAirbnbForProperty({
      property: austinDowntown,
      skipLive: true,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.source).toBe("MARKET_RULES");
    // Fixture rent is $2,900, downtown Austin multiplier 2.6.
    // ADR = (2900 / 30) * 2.6 = 251.33
    expect(outcome.analysis.adr).toBeCloseTo(251.33, 1);
    expect(outcome.analysis.inputs.occupancyRatePct).toBe(70); // top tier
    expect(outcome.analysis.grossRevenueAnnual).toBeGreaterThan(50_000);
    expect(outcome.analysis.grossRevenueAnnual).toBeLessThan(80_000);
  });

  it("returns a structured failure when no rent estimate is possible", async () => {
    const outcome = await analyzeAirbnbForProperty({
      property: elsewhere,
      skipLive: true,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe("no_long_term_rent");
  });

  it("respects explicit overrides", async () => {
    const outcome = await analyzeAirbnbForProperty({
      property: austinDowntown,
      skipLive: true,
      overrides: { averageDailyRate: 300, occupancyRatePct: 60 },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.analysis.adr).toBe(300);
    expect(outcome.analysis.inputs.occupancyRatePct).toBe(60);
  });
});
