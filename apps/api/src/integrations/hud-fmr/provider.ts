/**
 * HUD Fair Market Rent provider.
 *
 * Public-domain US government data (HUD's FY2025 Small Area FMRs by ZIP).
 * Coverage: every US zip code in a HUD-tracked metropolitan area or
 * non-metro county (~35k zip codes). Free, no API key, no rate limit.
 *
 * The numbers are HUD's "fair" rent for housing-voucher purposes —
 * roughly the 40th percentile of recent contract rents — and they
 * are updated annually. Expect HUD FMRs to lag actual market rents by
 * 5–15% in hot markets. Treat as a baseline / sanity check, not a
 * primary source.
 *
 * Pure functions, no I/O — the SAFMR JSON is bundled at build time.
 */

import safmr from "./data/safmr-2025.json" with { type: "json" };

type SafmrEntry = {
  state: string;
  /** Monthly SAFMR for [0BR, 1BR, 2BR, 3BR, 4BR]. */
  rents: number[];
};

type SafmrFile = {
  year: number;
  source: string;
  entries: Record<string, SafmrEntry>;
};

const data = safmr as SafmrFile;

export type HudFmrLookup = {
  monthlyRent: number;
  bedroomBucket: 0 | 1 | 2 | 3 | 4;
  /** Bucket the input bedroom count was clamped to (HUD only publishes 0–4). */
  source: "HUD_FMR";
  /** Year of the underlying dataset. */
  year: number;
};

export function getHudFairMarketRent(zipCode: string, bedrooms: number): HudFmrLookup | null {
  const entry = data.entries[zipCode];
  if (!entry) return null;

  // HUD publishes only 0–4 BR rents. Clamp larger units to the 4BR figure.
  const bucket = clampBedroom(bedrooms);
  const rent = entry.rents[bucket];
  if (rent === undefined || rent <= 0) return null;

  return {
    monthlyRent: rent,
    bedroomBucket: bucket,
    source: "HUD_FMR",
    year: data.year,
  };
}

function clampBedroom(bedrooms: number): 0 | 1 | 2 | 3 | 4 {
  const rounded = Math.max(0, Math.min(4, Math.round(bedrooms)));
  return rounded as 0 | 1 | 2 | 3 | 4;
}

/** Visible for tests. */
export function hudFmrCoverage(): { zipCount: number; year: number } {
  return { zipCount: Object.keys(data.entries).length, year: data.year };
}
