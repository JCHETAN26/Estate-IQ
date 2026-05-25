/**
 * Short-term rental (Airbnb-style) profitability analysis.
 *
 * Build-plan output metrics:
 *   - Projected Annual Revenue
 *   - Break-even Timeline
 *   - STR Risk Level
 *
 * All inputs are explicit and named so the assumptions in any output
 * are auditable. Defaults follow industry rules of thumb the user can
 * override:
 *   - 65% average occupancy (AirDNA US median sits around 55–60%; we
 *     use 65% to avoid biasing toward a no-go decision; callers should
 *     override with market-specific data when available).
 *   - 14% management fee on top of the cleaning charge per booking.
 *     (Self-managed hosts can set this to 0.)
 *   - 5-night average length of stay → cleaning frequency.
 *   - Furnishing cost amortized linearly over 36 months for accounting,
 *     but the break-even calculation uses the raw spend.
 *
 * Seasonality is modelled as a sine curve with a configurable peak
 * month (defaults to July). Net effect on annual revenue is zero by
 * construction; the seasonality output is for downstream UI charts.
 *
 * Pure functions, no I/O.
 */

import { clamp, round1, round2, round3 } from "./numeric.js";

export type AirbnbInputs = {
  /** Average daily rate in dollars. */
  averageDailyRate: number;
  /** Year-round occupancy expressed as a percentage (0–100). */
  occupancyRatePct: number;
  /** Cleaning fee charged per booking — passes to the guest, but if
   *  the caller wants to model it as host-borne they can flip
   *  `cleaningFeePassedThrough` to false. */
  cleaningFeePerBooking?: number;
  cleaningFeePassedThrough?: boolean;
  /** Average nights per booking — default 5. */
  averageStayNights?: number;
  /** Property management fee, percent of booked revenue (0–100). */
  managementFeePct?: number;
  /** One-time furnishing cost. */
  furnishingCost?: number;
  /** Total fixed monthly carrying costs (mortgage PITI + HOA + utilities
   *  + STR insurance premium). The break-even math compares net STR
   *  income against this number. */
  monthlyFixedCarryingCost?: number;
  /** 1-12. Defaults to 7 (July). */
  peakMonth?: number;
  /** Seasonality amplitude: 0.2 means peak is +20%, trough is -20% of
   *  baseline. Default 0.25. */
  seasonalityAmplitude?: number;
};

export type StrRiskLevel = "Low" | "Moderate" | "High";

export type AirbnbAnalysis = {
  inputs: Required<
    Omit<AirbnbInputs, "cleaningFeePassedThrough"> & {
      cleaningFeePassedThrough: boolean;
    }
  >;

  /** Average daily rate (echo of input). */
  adr: number;
  /** Year-round occupancy as a fraction (0–1). */
  occupancyRate: number;
  /** Booked nights per year. */
  bookedNightsPerYear: number;
  /** Estimated bookings per year (booked nights / avg stay). */
  bookingsPerYear: number;

  /** Gross booking revenue before cleaning, fees, management. */
  grossRevenueAnnual: number;
  /** Net cleaning revenue: cleaning fees collected − cleaning labor cost.
   *  When the fee is passed through, this is zero. When it's not, this
   *  is negative (host eats the cleaning cost). */
  cleaningCostAnnual: number;
  managementCostAnnual: number;
  /** Furnishing amortized straight-line over 36 months. */
  furnishingAmortizedAnnual: number;

  /** Projected annual revenue net of cleaning + management + amortized
   *  furnishing. Carrying costs (mortgage, etc.) are NOT subtracted —
   *  callers compose this with the long-term cashflow engine for an
   *  apples-to-apples comparison. */
  projectedAnnualRevenue: number;
  /** Net of carrying costs too. May be negative. */
  projectedAnnualNetCashFlow: number;
  /** Months until cumulative net STR cash flow recovers furnishing.
   *  null if the property never breaks even at the supplied inputs. */
  breakEvenMonths: number | null;

  /** Categorical risk score. */
  strRiskLevel: StrRiskLevel;
  /** Human-readable bullet list explaining each risk factor. */
  riskFactors: string[];
  /** Per-month seasonality factor (12 entries, multiplicative). */
  seasonalityFactors: number[];
  /** Per-month projected revenue (gross). 12 entries. Sums to
   *  grossRevenueAnnual within rounding. */
  monthlyRevenueProjection: number[];
};

const MONTHS = 12;
const NIGHTS_PER_YEAR = 365;
const FURNISHING_AMORTIZATION_MONTHS = 36;

export function analyzeAirbnb(inputs: AirbnbInputs): AirbnbAnalysis {
  const adr = Math.max(0, inputs.averageDailyRate);
  const occupancyRate = clamp(inputs.occupancyRatePct, 0, 100) / 100;
  const cleaningFeePerBooking = Math.max(0, inputs.cleaningFeePerBooking ?? 150);
  const cleaningFeePassedThrough = inputs.cleaningFeePassedThrough ?? true;
  const averageStayNights = Math.max(1, inputs.averageStayNights ?? 5);
  const managementFeePct = clamp(inputs.managementFeePct ?? 14, 0, 100);
  const furnishingCost = Math.max(0, inputs.furnishingCost ?? 18_000);
  const monthlyFixedCarryingCost = Math.max(0, inputs.monthlyFixedCarryingCost ?? 0);
  const peakMonth = clamp(Math.round(inputs.peakMonth ?? 7), 1, 12);
  const seasonalityAmplitude = clamp(inputs.seasonalityAmplitude ?? 0.25, 0, 1);

  const bookedNightsPerYear = round1(NIGHTS_PER_YEAR * occupancyRate);
  const bookingsPerYear = averageStayNights > 0 ? bookedNightsPerYear / averageStayNights : 0;

  const grossRevenueAnnual = round2(adr * bookedNightsPerYear);
  const cleaningCostAnnual = round2(
    cleaningFeePassedThrough ? 0 : cleaningFeePerBooking * bookingsPerYear,
  );
  const managementCostAnnual = round2(grossRevenueAnnual * (managementFeePct / 100));
  const furnishingAmortizedAnnual = round2(
    (furnishingCost / FURNISHING_AMORTIZATION_MONTHS) * MONTHS,
  );

  const projectedAnnualRevenue = round2(
    grossRevenueAnnual - cleaningCostAnnual - managementCostAnnual - furnishingAmortizedAnnual,
  );
  const projectedAnnualNetCashFlow = round2(
    projectedAnnualRevenue - monthlyFixedCarryingCost * MONTHS,
  );

  // Break-even: how many months of net STR profit (revenue − management −
  // cleaning − carrying, but NOT amortized furnishing) does it take to
  // recover the upfront furnishing spend?
  const monthlyNetForBreakeven =
    (grossRevenueAnnual - cleaningCostAnnual - managementCostAnnual) / MONTHS -
    monthlyFixedCarryingCost;
  const breakEvenMonths =
    monthlyNetForBreakeven > 0 && furnishingCost > 0
      ? round1(furnishingCost / monthlyNetForBreakeven)
      : null;

  const seasonalityFactors = computeSeasonality(peakMonth, seasonalityAmplitude);
  const monthlyRevenueProjection = seasonalityFactors.map((factor) =>
    round2((grossRevenueAnnual / MONTHS) * factor),
  );

  const { level, factors } = evaluateRisk({
    occupancyRate,
    projectedAnnualNetCashFlow,
    breakEvenMonths,
    seasonalityAmplitude,
    cleaningFeePassedThrough,
  });

  return {
    inputs: {
      averageDailyRate: adr,
      occupancyRatePct: occupancyRate * 100,
      cleaningFeePerBooking,
      cleaningFeePassedThrough,
      averageStayNights,
      managementFeePct,
      furnishingCost,
      monthlyFixedCarryingCost,
      peakMonth,
      seasonalityAmplitude,
    },
    adr,
    occupancyRate,
    bookedNightsPerYear,
    bookingsPerYear: round1(bookingsPerYear),
    grossRevenueAnnual,
    cleaningCostAnnual,
    managementCostAnnual,
    furnishingAmortizedAnnual,
    projectedAnnualRevenue,
    projectedAnnualNetCashFlow,
    breakEvenMonths,
    strRiskLevel: level,
    riskFactors: factors,
    seasonalityFactors,
    monthlyRevenueProjection,
  };
}

/**
 * Sine-shaped seasonality factors. Average across 12 months equals 1.0
 * by construction, so applying these factors does not bias annual
 * revenue.
 */
function computeSeasonality(peakMonth: number, amplitude: number): number[] {
  const factors: number[] = [];
  for (let m = 1; m <= MONTHS; m++) {
    // Phase shift so the sine peaks at peakMonth.
    const angle = ((m - peakMonth) * 2 * Math.PI) / MONTHS;
    factors.push(round3(1 + amplitude * Math.cos(angle)));
  }
  return factors;
}

type RiskInputs = {
  occupancyRate: number;
  projectedAnnualNetCashFlow: number;
  breakEvenMonths: number | null;
  seasonalityAmplitude: number;
  cleaningFeePassedThrough: boolean;
};

function evaluateRisk(inputs: RiskInputs): {
  level: StrRiskLevel;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 0;

  if (inputs.occupancyRate < 0.5) {
    score += 2;
    factors.push(
      `Occupancy assumption ${(inputs.occupancyRate * 100).toFixed(0)}% is below STR market norms (~55-65%).`,
    );
  } else if (inputs.occupancyRate < 0.6) {
    score += 1;
    factors.push(
      `Occupancy assumption ${(inputs.occupancyRate * 100).toFixed(0)}% is on the low end for sustained STR profitability.`,
    );
  } else {
    factors.push(
      `Occupancy assumption ${(inputs.occupancyRate * 100).toFixed(0)}% is within typical STR ranges.`,
    );
  }

  if (inputs.projectedAnnualNetCashFlow < 0) {
    score += 2;
    factors.push("Projected annual net cash flow is negative at these assumptions.");
  } else if (inputs.projectedAnnualNetCashFlow < 5_000) {
    score += 1;
    factors.push(
      "Projected annual net cash flow is thin (< $5k); small ADR or occupancy declines erase the margin.",
    );
  } else {
    factors.push(
      `Projected annual net cash flow of $${Math.round(inputs.projectedAnnualNetCashFlow).toLocaleString()} is healthy.`,
    );
  }

  if (inputs.breakEvenMonths === null) {
    score += 2;
    factors.push("Furnishing cost never breaks even at these assumptions.");
  } else if (inputs.breakEvenMonths > 36) {
    score += 1;
    factors.push(
      `Furnishing payback period of ${inputs.breakEvenMonths.toFixed(1)} months exceeds the 36-month industry rule of thumb.`,
    );
  } else {
    factors.push(
      `Furnishing payback in ${inputs.breakEvenMonths.toFixed(1)} months is within the 36-month rule of thumb.`,
    );
  }

  if (inputs.seasonalityAmplitude > 0.4) {
    score += 1;
    factors.push(
      `High seasonality amplitude (${(inputs.seasonalityAmplitude * 100).toFixed(0)}%) implies meaningful trough months requiring cash buffer.`,
    );
  }

  if (!inputs.cleaningFeePassedThrough) {
    factors.push(
      "Cleaning costs are modeled as host-borne; this depresses net revenue but improves listing conversion.",
    );
  }

  let level: StrRiskLevel;
  if (score <= 1) level = "Low";
  else if (score <= 3) level = "Moderate";
  else level = "High";

  return { level, factors };
}
