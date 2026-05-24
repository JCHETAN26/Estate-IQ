/**
 * Zillow rent Zestimate extractor tests.
 */

import { describe, expect, it } from "vitest";
import { extractRentZestimateFromNextData } from "../src/integrations/zillow/zestimate-extractor.js";

describe("extractRentZestimateFromNextData", () => {
  it("returns the rentZestimate when present", () => {
    const payload = {
      props: {
        pageProps: {
          gdpClientCache: {
            "PropertyResult-12345": {
              property: { zpid: 12345, rentZestimate: 2750 },
            },
          },
        },
      },
    };
    expect(extractRentZestimateFromNextData(payload)).toBe(2750);
  });

  it("walks deeply-nested arrays", () => {
    const payload = {
      a: [{ b: [{ rentZestimate: 1850 }] }],
    };
    expect(extractRentZestimateFromNextData(payload)).toBe(1850);
  });

  it("returns null when rentZestimate is missing", () => {
    const payload = { property: { zpid: 1, price: 500_000 } };
    expect(extractRentZestimateFromNextData(payload)).toBeNull();
  });

  it("ignores non-numeric and non-positive rentZestimate values", () => {
    expect(extractRentZestimateFromNextData({ rentZestimate: "2900" })).toBeNull();
    expect(extractRentZestimateFromNextData({ rentZestimate: 0 })).toBeNull();
    expect(extractRentZestimateFromNextData({ rentZestimate: -100 })).toBeNull();
  });

  it("returns null on null / non-object input", () => {
    expect(extractRentZestimateFromNextData(null)).toBeNull();
    expect(extractRentZestimateFromNextData("string")).toBeNull();
    expect(extractRentZestimateFromNextData(undefined)).toBeNull();
  });
});
