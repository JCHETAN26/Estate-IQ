/**
 * HUD FMR provider tests.
 */

import { describe, expect, it } from "vitest";
import { getHudFairMarketRent, hudFmrCoverage } from "../src/integrations/hud-fmr/provider.js";

describe("getHudFairMarketRent", () => {
  it("returns a rent for a well-known US zip", () => {
    const result = getHudFairMarketRent("78701", 3);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.source).toBe("HUD_FMR");
    expect(result.bedroomBucket).toBe(3);
    expect(result.monthlyRent).toBeGreaterThan(2000);
    expect(result.monthlyRent).toBeLessThan(6000);
    expect(result.year).toBe(2025);
  });

  it("clamps bedroom counts above 4 to the 4BR bucket", () => {
    const five = getHudFairMarketRent("78701", 5);
    const four = getHudFairMarketRent("78701", 4);
    expect(five?.bedroomBucket).toBe(4);
    expect(five?.monthlyRent).toBe(four?.monthlyRent);
  });

  it("clamps bedroom counts below 0 to the 0BR bucket", () => {
    const studio = getHudFairMarketRent("78701", 0);
    const negative = getHudFairMarketRent("78701", -1);
    expect(negative?.bedroomBucket).toBe(0);
    expect(negative?.monthlyRent).toBe(studio?.monthlyRent);
  });

  it("returns null for an unknown zip code", () => {
    expect(getHudFairMarketRent("00000", 3)).toBeNull();
    expect(getHudFairMarketRent("not-a-zip", 3)).toBeNull();
  });

  it("covers a meaningful fraction of US zip codes", () => {
    const coverage = hudFmrCoverage();
    expect(coverage.zipCount).toBeGreaterThan(20_000);
    expect(coverage.year).toBe(2025);
  });
});
