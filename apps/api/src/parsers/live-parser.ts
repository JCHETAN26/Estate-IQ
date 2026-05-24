/**
 * Live Zillow listing parser.
 *
 * Strategy: fetch the detail page, locate the embedded `__NEXT_DATA__`
 * JSON blob, walk it to find the listing payload, normalize into a
 * Property. Zillow rotates their schema occasionally; the extractor is
 * defensive about field names and falls through to a schema_mismatch
 * failure rather than throwing.
 *
 * Production reality: Zillow aggressively blocks bot traffic. A single
 * request without a session may return a captcha page (HTTP 403) or a
 * stripped HTML shell with no listing data. When that happens we surface
 * a structured fetch_blocked failure and the orchestrator falls back to
 * the mock parser. A real production deployment would route through a
 * residential-proxy provider; that integration is out of MVP scope.
 */

import {
  PropertySchema,
  PropertyTypeSchema,
  type Property,
  type PropertyType,
} from "@estate-iq/shared";
import { logger } from "../mcp/logger.js";
import type { ListingParser, ParseResult } from "./types.js";
import { canonicalizeZillowUrl, extractZpid } from "./zpid.js";

const FETCH_TIMEOUT_MS = 5_000;
const NEXT_DATA_REGEX = /<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFind(value: unknown, predicate: (node: AnyRecord) => boolean): AnyRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(value)) {
    if (predicate(value)) return value;
    for (const key of Object.keys(value)) {
      const found = deepFind(value[key], predicate);
      if (found) return found;
    }
  }
  return null;
}

function pickNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const HOME_TYPE_MAP: Record<string, PropertyType> = {
  SINGLE_FAMILY: "SINGLE_FAMILY",
  MULTI_FAMILY: "MULTI_FAMILY",
  CONDO: "CONDO",
  CONDOMINIUM: "CONDO",
  TOWNHOUSE: "TOWNHOUSE",
  TOWNHOME: "TOWNHOUSE",
  APARTMENT: "APARTMENT",
  MANUFACTURED: "OTHER",
  LOT: "OTHER",
};

function normalizePropertyType(raw: unknown): PropertyType {
  const value = pickString(raw)?.toUpperCase();
  if (value && value in HOME_TYPE_MAP) {
    const mapped = HOME_TYPE_MAP[value];
    if (mapped) return mapped;
  }
  return "OTHER";
}

/**
 * Normalize a Zillow listing payload to our Property shape. Tolerant of
 * missing fields — Zillow varies wildly across property types.
 */
export function extractPropertyFromNextData(nextData: unknown, sourceUrl: string): Property | null {
  // The listing data lives at gdpClientCache.<key>.property in modern
  // Zillow pages. Be defensive: search the tree for any object that
  // looks like a property.
  const node = deepFind(nextData, (n) => {
    return (
      typeof n["zpid"] === "number" &&
      typeof n["streetAddress"] === "string" &&
      typeof n["city"] === "string"
    );
  });
  if (!node) return null;

  const candidate = {
    sourceUrl,
    address: pickString(node["streetAddress"]) ?? "",
    city: pickString(node["city"]) ?? "",
    state: pickString(node["state"]) ?? "",
    zipCode: pickString(node["zipcode"]) ?? "",
    listPrice: pickNumber(node["price"]) ?? 0,
    bedrooms: pickNumber(node["bedrooms"]) ?? 0,
    bathrooms: pickNumber(node["bathrooms"]) ?? 0,
    squareFeet: pickNumber(node["livingArea"]),
    lotSizeSqft: pickNumber(node["lotSize"]),
    yearBuilt: pickNumber(node["yearBuilt"]),
    propertyType: normalizePropertyType(node["homeType"]),
    hoaMonthly: pickNumber(node["monthlyHoaFee"]),
    taxesAnnual: pickNumber(node["propertyTaxRate"]),
    insuranceAnnual: undefined,
    description: pickString(node["description"]),
  };

  const parsed = PropertySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const liveParser: ListingParser = {
  source: "live",
  async parse(url: string): Promise<ParseResult> {
    const start = process.hrtime.bigint();
    const ms = () => Number((process.hrtime.bigint() - start) / 1_000_000n);

    const canonical = canonicalizeZillowUrl(url);
    if (!canonical) {
      return {
        ok: false,
        source: "live",
        reason: "not_zillow_url",
        message: `Not a recognized Zillow detail URL: ${url}`,
        durationMs: ms(),
      };
    }

    const zpid = extractZpid(canonical);
    logger.debug("listing.live.fetch", { zpid, url: canonical });

    let response: Response;
    try {
      response = await fetchWithTimeout(canonical);
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        source: "live",
        reason: aborted ? "fetch_timeout" : "fetch_failed",
        message: error instanceof Error ? error.message : "fetch failed",
        durationMs: ms(),
      };
    }

    if (response.status === 403 || response.status === 429) {
      return {
        ok: false,
        source: "live",
        reason: "fetch_blocked",
        message: `Zillow returned ${response.status} (anti-bot). Falling back.`,
        durationMs: ms(),
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        source: "live",
        reason: "fetch_failed",
        message: `Zillow returned HTTP ${response.status}`,
        durationMs: ms(),
      };
    }

    const html = await response.text();
    const match = NEXT_DATA_REGEX.exec(html);
    if (!match || !match[1]) {
      return {
        ok: false,
        source: "live",
        reason: "no_listing_data",
        message: "Could not locate __NEXT_DATA__ payload in HTML",
        durationMs: ms(),
      };
    }

    let nextData: unknown;
    try {
      nextData = JSON.parse(match[1]);
    } catch (error) {
      return {
        ok: false,
        source: "live",
        reason: "no_listing_data",
        message: `Failed to parse __NEXT_DATA__ JSON: ${
          error instanceof Error ? error.message : "unknown"
        }`,
        durationMs: ms(),
      };
    }

    const property = extractPropertyFromNextData(nextData, canonical);
    if (!property) {
      return {
        ok: false,
        source: "live",
        reason: "schema_mismatch",
        message: "Zillow payload did not contain expected listing fields",
        durationMs: ms(),
      };
    }

    // Validate the result one more time so callers get a guaranteed shape.
    const parsed = PropertySchema.safeParse(property);
    if (!parsed.success) {
      return {
        ok: false,
        source: "live",
        reason: "schema_mismatch",
        message: parsed.error.message,
        durationMs: ms(),
      };
    }

    // Re-export for tests
    void PropertyTypeSchema;

    return { ok: true, source: "live", property: parsed.data, durationMs: ms() };
  },
};
