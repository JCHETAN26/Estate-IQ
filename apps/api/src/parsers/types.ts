/**
 * Listing parser types.
 *
 * A ListingParser converts a normalized Zillow URL into a Property.
 * Strategies (live HTTP, mock, third-party proxy) all implement this
 * interface so the orchestrator can chain them deterministically.
 */

import type { Property } from "@estate-iq/shared";

export type ParseSource = "cache" | "live" | "mock" | "proxy";

export type ParseSuccess = {
  ok: true;
  source: ParseSource;
  property: Property;
  durationMs: number;
};

export type ParseFailure = {
  ok: false;
  source: ParseSource;
  reason: ParseFailureReason;
  message: string;
  durationMs: number;
};

export type ParseFailureReason =
  | "not_zillow_url"
  | "fetch_blocked"
  | "fetch_failed"
  | "fetch_timeout"
  | "no_listing_data"
  | "schema_mismatch"
  | "fixture_not_found";

export type ParseResult = ParseSuccess | ParseFailure;

export interface ListingParser {
  readonly source: ParseSource;
  parse(url: string): Promise<ParseResult>;
}
