/**
 * Mock listing parser.
 *
 * Loads pre-recorded fixtures from listings.json. Used as the
 * deterministic fallback when live scraping is blocked, and as the
 * verification corpus that proves the orchestrator can produce
 * Property objects for at least 20 distinct Zillow URLs.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PropertySchema, type Property } from "@estate-iq/shared";
import type { ListingParser, ParseResult } from "./types.js";
import { canonicalizeZillowUrl, extractZpid } from "./zpid.js";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_PATH = resolve(here, "fixtures/listings.json");

let cachedListings: Map<string, Property> | null = null;

async function loadFixtures(): Promise<Map<string, Property>> {
  if (cachedListings) return cachedListings;
  const raw = await readFile(FIXTURES_PATH, "utf8");
  const parsed = JSON.parse(raw) as { listings: unknown[] };
  const map = new Map<string, Property>();
  for (const entry of parsed.listings) {
    const property = PropertySchema.parse(entry);
    const zpid = extractZpid(property.sourceUrl);
    if (zpid) map.set(zpid, property);
  }
  cachedListings = map;
  return map;
}

/** Exposed for tests / verification scripts. */
export async function listMockListings(): Promise<readonly Property[]> {
  const map = await loadFixtures();
  return Array.from(map.values());
}

export const mockParser: ListingParser = {
  source: "mock",
  async parse(url: string): Promise<ParseResult> {
    const start = process.hrtime.bigint();
    const ms = () => Number((process.hrtime.bigint() - start) / 1_000_000n);

    const canonical = canonicalizeZillowUrl(url);
    if (!canonical) {
      return {
        ok: false,
        source: "mock",
        reason: "not_zillow_url",
        message: `Not a recognized Zillow detail URL: ${url}`,
        durationMs: ms(),
      };
    }

    const zpid = extractZpid(canonical);
    if (!zpid) {
      return {
        ok: false,
        source: "mock",
        reason: "not_zillow_url",
        message: `Could not extract zpid from ${canonical}`,
        durationMs: ms(),
      };
    }

    const fixtures = await loadFixtures();
    const fixture = fixtures.get(zpid);
    if (!fixture) {
      return {
        ok: false,
        source: "mock",
        reason: "fixture_not_found",
        message: `No fixture for zpid=${zpid}`,
        durationMs: ms(),
      };
    }

    return { ok: true, source: "mock", property: fixture, durationMs: ms() };
  },
};
