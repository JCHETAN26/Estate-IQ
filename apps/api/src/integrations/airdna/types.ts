/**
 * Internal AirDNA API response shapes.
 *
 * Defined here (not in @estate-iq/shared) because they're vendor-specific.
 * Consumers receive a normalized AirbnbMarketData shape from the service.
 */

import { z } from "zod";

export const AirdnaMarketResponseSchema = z
  .object({
    /** Average daily rate in dollars. */
    adr: z.number().positive(),
    /** Year-round occupancy as a percent (0-100). */
    occupancyRatePct: z.number().min(0).max(100),
    /** Average nightly cleaning fee. */
    cleaningFeeAvg: z.number().nonnegative().optional(),
    /** Average length of stay in nights. */
    averageStayNights: z.number().positive().optional(),
    /** Peak month (1-12). */
    peakMonth: z.number().int().min(1).max(12).optional(),
  })
  .passthrough();

export type AirdnaMarketResponse = z.infer<typeof AirdnaMarketResponseSchema>;

export type AirdnaClientError =
  | { kind: "auth"; message: string }
  | { kind: "rate_limited"; message: string; retryAfterSeconds?: number }
  | { kind: "not_found"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "schema_mismatch"; message: string }
  | { kind: "network"; message: string }
  | { kind: "no_api_key"; message: string };
