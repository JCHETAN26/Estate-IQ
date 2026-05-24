/**
 * Airbnb / short-term rental analysis service.
 *
 * Strategy chain:
 *   1. live (AirDNA)  — vendor data when an API key is configured
 *   2. market rules   — derived from the property's long-term rental
 *                       estimate and a city/zip ADR-multiplier table
 *
 * The math itself lives in @estate-iq/analysis-engine.analyzeAirbnb;
 * this service only sources the inputs (ADR, occupancy, etc.) and
 * provides a deterministic fallback so callers always get a result.
 */

import type { AirbnbAnalysis, AirbnbInputs } from "@estate-iq/analysis-engine";
import { analyzeAirbnb } from "@estate-iq/analysis-engine";
import type { Property } from "@estate-iq/shared";
import { getStrMarketData } from "../integrations/airdna/client.js";
import { logger } from "../mcp/logger.js";
import { estimateRental } from "./rental-estimate.service.js";

/**
 * STR ADR multipliers vs. the long-term daily-rent equivalent
 * (monthly rent / 30). Empirically STR ADR runs 1.5x–3x the long-term
 * daily-equivalent depending on market — high-tourism markets (downtown
 * Austin, Hill Country) push toward 3x, suburban commuter zips toward
 * 1.5x.
 *
 * Keys are "STATE_ZIP". Fallback multiplier is 1.8 when the zip isn't
 * in the table.
 */
const ADR_MULTIPLIER_BY_ZIP: Record<string, number> = {
  TX_78701: 2.6, // Downtown Austin
  TX_78704: 2.5, // South Congress
  TX_78702: 2.4, // East Austin
  TX_78745: 2.0,
  TX_78664: 1.7, // Round Rock
  TX_78734: 2.4, // Lakeway
  TX_78613: 1.7, // Cedar Park
  TX_78641: 1.7, // Leander
  TX_78660: 1.6, // Pflugerville
  TX_78610: 1.7, // Buda
  TX_78620: 2.7, // Dripping Springs (Hill Country tourism)
  TX_78212: 1.9, // San Antonio Highland Park
  TX_78230: 1.7,
  TX_78258: 1.8,
  TX_77006: 2.1, // Houston Montrose
  TX_77027: 2.0,
  TX_77008: 2.2, // Houston Heights
  TX_75201: 2.4, // Dallas Downtown
  TX_75230: 2.1, // Dallas Preston Hollow
  TX_75024: 1.7, // Plano
  TX_75034: 1.8, // Frisco
};

const FALLBACK_ADR_MULTIPLIER = 1.8;

const OCCUPANCY_BY_MULTIPLIER: Array<{ minMultiplier: number; occupancyPct: number }> = [
  { minMultiplier: 2.4, occupancyPct: 70 },
  { minMultiplier: 2.0, occupancyPct: 65 },
  { minMultiplier: 1.7, occupancyPct: 60 },
  { minMultiplier: 0.0, occupancyPct: 55 },
];

export type AirbnbAnalysisRequest = {
  property: Property;
  /** Optional override: skip the live AirDNA lookup. */
  skipLive?: boolean;
  /** Optional explicit overrides on top of derived market defaults. */
  overrides?: Partial<AirbnbInputs>;
};

export type AirbnbAnalysisOutcome =
  | {
      ok: true;
      source: "AIRDNA" | "MARKET_RULES";
      analysis: AirbnbAnalysis;
      durationMs: number;
    }
  | { ok: false; reason: string; message: string };

export async function analyzeAirbnbForProperty(
  request: AirbnbAnalysisRequest,
): Promise<AirbnbAnalysisOutcome> {
  const start = process.hrtime.bigint();
  const ms = () => Number((process.hrtime.bigint() - start) / 1_000_000n);
  const { property } = request;

  // 1. Live AirDNA lookup (only attempted when a key is configured).
  if (!request.skipLive) {
    const live = await getStrMarketData({
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
    });
    if (live.ok) {
      const inputs: AirbnbInputs = {
        averageDailyRate: live.data.adr,
        occupancyRatePct: live.data.occupancyRatePct,
        ...(live.data.cleaningFeeAvg !== undefined
          ? { cleaningFeePerBooking: live.data.cleaningFeeAvg }
          : {}),
        ...(live.data.averageStayNights !== undefined
          ? { averageStayNights: live.data.averageStayNights }
          : {}),
        ...(live.data.peakMonth !== undefined ? { peakMonth: live.data.peakMonth } : {}),
        ...(request.overrides ?? {}),
      };
      logger.info("airbnb.live_hit", { sourceUrl: property.sourceUrl });
      return {
        ok: true,
        source: "AIRDNA",
        analysis: analyzeAirbnb(inputs),
        durationMs: ms(),
      };
    }
    logger.debug("airbnb.live_miss", {
      sourceUrl: property.sourceUrl,
      reason: live.error.kind,
    });
  }

  // 2. Market-rules fallback. Derive ADR from long-term rent + ratio.
  const rentOutcome = await estimateRental(property, {
    skipLive: false,
    skipPersist: true,
  });
  if (!rentOutcome.ok) {
    return {
      ok: false,
      reason: "no_long_term_rent",
      message:
        "Cannot derive ADR without a long-term rent estimate; no rental data available for this property.",
    };
  }

  const monthlyRent = rentOutcome.estimate.estimatedRent;
  const multiplier =
    ADR_MULTIPLIER_BY_ZIP[`${property.state}_${property.zipCode}`] ?? FALLBACK_ADR_MULTIPLIER;
  const adr = round2((monthlyRent / 30) * multiplier);
  const occupancyPct = pickOccupancy(multiplier);

  const inputs: AirbnbInputs = {
    averageDailyRate: adr,
    occupancyRatePct: occupancyPct,
    ...(request.overrides ?? {}),
  };

  logger.info("airbnb.market_rules", {
    sourceUrl: property.sourceUrl,
    adr,
    occupancyPct,
    multiplier,
  });

  return {
    ok: true,
    source: "MARKET_RULES",
    analysis: analyzeAirbnb(inputs),
    durationMs: ms(),
  };
}

function pickOccupancy(multiplier: number): number {
  for (const tier of OCCUPANCY_BY_MULTIPLIER) {
    if (multiplier >= tier.minMultiplier) return tier.occupancyPct;
  }
  return 55;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
