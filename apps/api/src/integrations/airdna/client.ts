/**
 * AirDNA HTTP client (stub).
 *
 * AirDNA's API is the standard data source for short-term-rental ADR
 * and occupancy at the zip-code or neighborhood level, but it requires
 * an enterprise contract and per-call fees. This stub follows the same
 * contract as the RentCast client (typed result, structured errors)
 * so the orchestrator can swap in a real implementation without
 * downstream changes.
 *
 * When AIRDNA_API_KEY is not set the client returns a structured
 * `no_api_key` error and the orchestrator falls through to the
 * market-rule heuristic. When it IS set, the stub still does not call
 * AirDNA (we have no credentials in dev) — it returns `not_found`.
 * Real integration is left as a deployment-time concern.
 */

import type { AirdnaClientError } from "./types.js";

export type MarketLookupRequest = {
  city: string;
  state: string;
  zipCode: string;
};

export type MarketLookupResult =
  | {
      ok: true;
      data: {
        adr: number;
        occupancyRatePct: number;
        cleaningFeeAvg?: number;
        averageStayNights?: number;
        peakMonth?: number;
      };
    }
  | { ok: false; error: AirdnaClientError };

function getApiKey(): string | null {
  const key = process.env.AIRDNA_API_KEY;
  return key && key.length > 0 ? key : null;
}

export async function getStrMarketData(_request: MarketLookupRequest): Promise<MarketLookupResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: { kind: "no_api_key", message: "AIRDNA_API_KEY not set" },
    };
  }
  // Real network call would go here. Returning not_found until a real
  // contract exists — the orchestrator handles fallback.
  return {
    ok: false,
    error: {
      kind: "not_found",
      message: "AirDNA integration is stubbed; real implementation deferred to deployment.",
    },
  };
}
