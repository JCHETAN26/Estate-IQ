/**
 * RentCast HTTP client.
 *
 * Single endpoint for now: GET /v1/avm/rent/long-term.
 *
 * Returns a discriminated result so callers can handle missing keys,
 * rate limits, and schema drift without throwing. We never let RentCast
 * payloads reach the rest of the codebase unvalidated — every response
 * crosses a Zod boundary here.
 */

import { logger } from "../../mcp/logger.js";
import {
  RentcastRentEstimateSchema,
  type RentcastClientError,
  type RentcastRentEstimate,
} from "./types.js";

const RENTCAST_BASE = "https://api.rentcast.io/v1";
const TIMEOUT_MS = 8_000;

/**
 * Map our internal property type enum into RentCast's vocabulary.
 * Returns null when the type isn't supported by the rent AVM.
 */
const PROPERTY_TYPE_MAP: Record<string, string> = {
  SINGLE_FAMILY: "Single Family",
  MULTI_FAMILY: "Multi-Family",
  CONDO: "Condo",
  TOWNHOUSE: "Townhouse",
  APARTMENT: "Apartment",
};

export type RentEstimateRequest = {
  address: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  /** 5–25 comps, RentCast default is 15. We default to 10 for terser memos. */
  compCount?: number;
};

export type RentEstimateResult =
  | { ok: true; data: RentcastRentEstimate }
  | { ok: false; error: RentcastClientError };

export function mapPropertyType(internal: string | undefined): string | undefined {
  if (!internal) return undefined;
  return PROPERTY_TYPE_MAP[internal];
}

function getApiKey(): string | null {
  const key = process.env.RENTCAST_API_KEY;
  return key && key.length > 0 ? key : null;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRentEstimate(request: RentEstimateRequest): Promise<RentEstimateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: { kind: "no_api_key", message: "RENTCAST_API_KEY not set" },
    };
  }

  const params = new URLSearchParams({ address: request.address });
  if (request.propertyType) params.set("propertyType", request.propertyType);
  if (typeof request.bedrooms === "number") params.set("bedrooms", String(request.bedrooms));
  if (typeof request.bathrooms === "number") {
    params.set("bathrooms", String(request.bathrooms));
  }
  if (typeof request.squareFootage === "number") {
    params.set("squareFootage", String(request.squareFootage));
  }
  if (typeof request.compCount === "number") {
    params.set("compCount", String(request.compCount));
  }

  const url = `${RENTCAST_BASE}/avm/rent/long-term?${params.toString()}`;
  logger.debug("rentcast.request", { address: request.address });

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      error: aborted
        ? { kind: "timeout", message: `RentCast did not respond in ${TIMEOUT_MS}ms` }
        : {
            kind: "network",
            message: error instanceof Error ? error.message : String(error),
          },
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: { kind: "auth", message: `RentCast auth failed (HTTP ${response.status})` },
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      error: {
        kind: "not_found",
        message: `RentCast has no data for '${request.address}'`,
      },
    };
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        message: "RentCast rate limit exceeded",
        ...(Number.isFinite(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {}),
      },
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: { kind: "network", message: `RentCast returned HTTP ${response.status}` },
    };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "schema_mismatch",
        message: `RentCast returned invalid JSON: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      },
    };
  }

  const parsed = RentcastRentEstimateSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn("rentcast.schema_mismatch", { issues: parsed.error.flatten() });
    return {
      ok: false,
      error: { kind: "schema_mismatch", message: parsed.error.message },
    };
  }

  return { ok: true, data: parsed.data };
}
