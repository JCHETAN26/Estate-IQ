/**
 * Investment scoring engine.
 *
 * Produces a deterministic 0-100 investment score from five sub-factors.
 * Each sub-factor scores 0-100 on its own scale. The overall score is
 * a weighted average; weights sum to 100.
 *
 * Factors (per build-plan / Task 2.4):
 *   - Cash flow              (weight 30)  — cash-on-cash return
 *   - Rent-to-price ratio    (weight 25)  — annualized rent / price
 *   - Tax burden             (weight 15)  — property taxes as % of price
 *   - Neighborhood growth    (weight 15)  — heuristic by city tier
 *   - Appreciation potential (weight 15)  — year built + price/sqft signal
 *
 * The score is always returned with a `rationale` array — one string
 * per factor explaining why it scored as it did. This is the
 * "Score explanation" required by the build plan.
 *
 * Pure functions, no I/O.
 */

const FACTOR_WEIGHTS = {
  cashFlow: 30,
  rentToPrice: 25,
  taxBurden: 15,
  neighborhoodGrowth: 15,
  appreciation: 15,
} as const;

const TOTAL_WEIGHT =
  FACTOR_WEIGHTS.cashFlow +
  FACTOR_WEIGHTS.rentToPrice +
  FACTOR_WEIGHTS.taxBurden +
  FACTOR_WEIGHTS.neighborhoodGrowth +
  FACTOR_WEIGHTS.appreciation;

if (TOTAL_WEIGHT !== 100) {
  // Compile-time enforcement isn't possible with object literal sums in
  // TS; this runtime check fires on module load if weights drift.
  throw new Error(`Scoring weights must sum to 100 (got ${TOTAL_WEIGHT})`);
}

export type InvestmentScoreInputs = {
  /** Cash-on-cash return as a percent (e.g. 5.0 means 5%). */
  cashOnCashPct?: number;
  /** Annualized rent / price as a percent. */
  rentToPricePct?: number;
  /** Annual property tax in dollars. */
  propertyTaxAnnual?: number;
  /** List price in dollars. Used to derive tax % and price/sqft. */
  listPrice: number;
  /** Square footage. Used for the price/sqft signal. */
  squareFeet?: number;
  /** Year the property was built. Newer = higher appreciation signal. */
  yearBuilt?: number;
  /** City — used to look up the neighborhood-growth tier. */
  city?: string;
  /** State (2-letter code) — used to look up the neighborhood-growth tier. */
  state?: string;
  /** Median price per sqft for the zip / city, when known. */
  medianPricePerSqft?: number;
};

export type FactorScore = {
  /** 0-100 sub-score. */
  score: number;
  /** Weight applied to the overall score. */
  weight: number;
  /** Human-readable explanation. */
  rationale: string;
};

export type InvestmentScoreResult = {
  /** Overall 0-100 deterministic score. */
  score: number;
  /** Categorical band derived from the score. */
  rating: "Excellent" | "Strong" | "Moderate" | "Weak" | "Poor";
  factors: {
    cashFlow: FactorScore;
    rentToPrice: FactorScore;
    taxBurden: FactorScore;
    neighborhoodGrowth: FactorScore;
    appreciation: FactorScore;
  };
  /** Concatenation of every factor rationale, in factor order. */
  rationale: string[];
};

export function calculateInvestmentScore(inputs: InvestmentScoreInputs): InvestmentScoreResult {
  const cashFlow = scoreCashFlow(inputs.cashOnCashPct);
  const rentToPrice = scoreRentToPrice(inputs.rentToPricePct);
  const taxBurden = scoreTaxBurden(inputs.propertyTaxAnnual, inputs.listPrice);
  const neighborhoodGrowth = scoreNeighborhoodGrowth(inputs.city, inputs.state);
  const appreciation = scoreAppreciation({
    yearBuilt: inputs.yearBuilt,
    listPrice: inputs.listPrice,
    squareFeet: inputs.squareFeet,
    medianPricePerSqft: inputs.medianPricePerSqft,
  });

  const overall =
    (cashFlow.score * cashFlow.weight +
      rentToPrice.score * rentToPrice.weight +
      taxBurden.score * taxBurden.weight +
      neighborhoodGrowth.score * neighborhoodGrowth.weight +
      appreciation.score * appreciation.weight) /
    100;

  const score = round1(overall);

  return {
    score,
    rating: rate(score),
    factors: {
      cashFlow,
      rentToPrice,
      taxBurden,
      neighborhoodGrowth,
      appreciation,
    },
    rationale: [
      cashFlow.rationale,
      rentToPrice.rationale,
      taxBurden.rationale,
      neighborhoodGrowth.rationale,
      appreciation.rationale,
    ],
  };
}

// ---------------------------------------------------------------------------
// Sub-factors
// ---------------------------------------------------------------------------

/**
 * Cash-on-cash return is the standard yardstick for rental cash flow.
 * Score curve:
 *   >= 10%   -> 100   (excellent)
 *      8%    -> 90
 *      6%    -> 75
 *      4%    -> 60
 *      0%    -> 50    (break-even)
 *    -10%    -> 0     (deeply negative)
 * Linear interpolation between anchor points; clamps at the ends.
 */
function scoreCashFlow(cashOnCashPct: number | undefined): FactorScore {
  const weight = FACTOR_WEIGHTS.cashFlow;
  if (cashOnCashPct === undefined || !Number.isFinite(cashOnCashPct)) {
    return {
      score: 50,
      weight,
      rationale: "Cash-on-cash unknown; defaulted to neutral 50/100.",
    };
  }
  const score = piecewiseLinear(cashOnCashPct, [
    { x: -10, y: 0 },
    { x: 0, y: 50 },
    { x: 4, y: 60 },
    { x: 6, y: 75 },
    { x: 8, y: 90 },
    { x: 10, y: 100 },
  ]);
  return {
    score: round1(score),
    weight,
    rationale: cashFlowRationale(cashOnCashPct, score),
  };
}

function cashFlowRationale(coc: number, score: number): string {
  if (coc >= 10) {
    return `Cash-on-cash ${coc.toFixed(1)}% is excellent (>= 10%) → ${round1(score)}/100.`;
  }
  if (coc >= 6) {
    return `Cash-on-cash ${coc.toFixed(1)}% is healthy → ${round1(score)}/100.`;
  }
  if (coc >= 0) {
    return `Cash-on-cash ${coc.toFixed(1)}% is positive but thin → ${round1(score)}/100.`;
  }
  return `Cash-on-cash ${coc.toFixed(1)}% is negative; rent does not cover financing → ${round1(
    score,
  )}/100.`;
}

/**
 * Annualized rent / price. Anchor points:
 *      >= 10%  -> 100   (1%-rule cleared decisively)
 *         8%   -> 85
 *         6%   -> 50    (median US single-family)
 *         4%   -> 25
 *      <= 3%   -> 0
 */
function scoreRentToPrice(rentToPricePct: number | undefined): FactorScore {
  const weight = FACTOR_WEIGHTS.rentToPrice;
  if (rentToPricePct === undefined || !Number.isFinite(rentToPricePct)) {
    return {
      score: 50,
      weight,
      rationale: "Rent-to-price unknown; defaulted to neutral 50/100.",
    };
  }
  const score = piecewiseLinear(rentToPricePct, [
    { x: 3, y: 0 },
    { x: 4, y: 25 },
    { x: 6, y: 50 },
    { x: 8, y: 85 },
    { x: 10, y: 100 },
  ]);
  return {
    score: round1(score),
    weight,
    rationale: `Rent-to-price ${rentToPricePct.toFixed(2)}% scored ${round1(
      score,
    )}/100 (anchors: 3%=0, 6%=50, 10%=100).`,
  };
}

/**
 * Property taxes as a percent of list price. Texas, NJ, IL run hot
 * (2-3%); much of the country is closer to 1%. Anchor points:
 *      <= 0.5%  -> 100
 *         1.0%  -> 80
 *         1.5%  -> 65
 *         2.0%  -> 50
 *         3.0%  -> 25
 *      >= 4.0%  -> 0
 */
function scoreTaxBurden(propertyTaxAnnual: number | undefined, listPrice: number): FactorScore {
  const weight = FACTOR_WEIGHTS.taxBurden;
  if (propertyTaxAnnual === undefined || !Number.isFinite(propertyTaxAnnual) || listPrice <= 0) {
    return {
      score: 50,
      weight,
      rationale: "Property tax unknown; defaulted to neutral 50/100.",
    };
  }
  const taxPct = (propertyTaxAnnual / listPrice) * 100;
  const score = piecewiseLinear(taxPct, [
    { x: 0.5, y: 100 },
    { x: 1.0, y: 80 },
    { x: 1.5, y: 65 },
    { x: 2.0, y: 50 },
    { x: 3.0, y: 25 },
    { x: 4.0, y: 0 },
  ]);
  return {
    score: round1(score),
    weight,
    rationale: `Tax burden ${taxPct.toFixed(2)}% of price scored ${round1(
      score,
    )}/100 (anchors: 1%=80, 2%=50, 3%=25).`,
  };
}

/**
 * Neighborhood growth tier — keyed by `STATE_City`.
 *
 * This is intentionally a heuristic. Real neighborhood-growth signal
 * would come from Census ACS population trends, BLS job growth, or
 * Zillow's ZHVI. Until that ships, we use a small curated table for
 * cities present in our fixtures plus a state-level fallback table
 * derived from population-growth public data.
 *
 * Rather than hide the heuristic, we expose it: callers can read this
 * table, replace it, or override the score with real data via the
 * input flow.
 */
const CITY_GROWTH_SCORES: Record<string, { score: number; reason: string }> = {
  TX_Austin: {
    score: 90,
    reason: "Austin: top-quartile US population + tech-job growth (5+yr).",
  },
  TX_Round_Rock: { score: 88, reason: "Round Rock: Austin metro spillover, sustained inflows." },
  TX_Cedar_Park: { score: 87, reason: "Cedar Park: Austin metro, top-tier school district." },
  TX_Leander: { score: 85, reason: "Leander: Austin metro, fastest-growing TX cities list." },
  TX_Pflugerville: { score: 82, reason: "Pflugerville: Austin metro outer ring." },
  TX_Buda: { score: 80, reason: "Buda: South Austin spillover, smaller market." },
  TX_Lakeway: { score: 80, reason: "Lakeway: Austin metro luxury submarket." },
  TX_Dripping_Springs: {
    score: 80,
    reason: "Dripping Springs: Hill Country tourism + Austin commuter belt.",
  },
  TX_San_Antonio: { score: 75, reason: "San Antonio: steady metro growth, lower than Austin." },
  TX_Houston: { score: 78, reason: "Houston: large metro, post-pandemic inflows continuing." },
  TX_Dallas: { score: 80, reason: "Dallas: top-3 metro for net domestic migration." },
  TX_Plano: { score: 82, reason: "Plano: Dallas metro, corporate HQ density." },
  TX_Frisco: { score: 88, reason: "Frisco: fastest-growing US city in recent decade." },
};

const STATE_GROWTH_DEFAULTS: Record<string, number> = {
  TX: 75,
  FL: 78,
  AZ: 72,
  NC: 72,
  TN: 70,
  GA: 68,
  CO: 65,
  WA: 65,
  CA: 55,
  NY: 50,
  IL: 45,
  PA: 50,
  OH: 50,
};

const NEUTRAL_GROWTH_SCORE = 60;

function scoreNeighborhoodGrowth(city: string | undefined, state: string | undefined): FactorScore {
  const weight = FACTOR_WEIGHTS.neighborhoodGrowth;
  if (city && state) {
    const key = `${state}_${city.replace(/\s+/g, "_")}`;
    const entry = CITY_GROWTH_SCORES[key];
    if (entry) {
      return {
        score: entry.score,
        weight,
        rationale: `Neighborhood growth ${entry.score}/100 — ${entry.reason}`,
      };
    }
  }
  if (state) {
    const fallback = STATE_GROWTH_DEFAULTS[state];
    if (fallback !== undefined) {
      return {
        score: fallback,
        weight,
        rationale: `Neighborhood growth ${fallback}/100 — state-level default for ${state} (no city-specific data).`,
      };
    }
  }
  return {
    score: NEUTRAL_GROWTH_SCORE,
    weight,
    rationale: `Neighborhood growth ${NEUTRAL_GROWTH_SCORE}/100 — neutral default (city/state not in lookup table).`,
  };
}

/**
 * Appreciation potential proxy.
 *
 * Two signals combined:
 *   - Year built (newer = higher; we don't ding pre-1990 hard).
 *   - Price-per-sqft vs zip/city median (below median = upside).
 *
 * Each signal is 0–100, then averaged. When inputs are missing, falls
 * back to a neutral 60 (we don't want unknown inputs to depress the
 * overall score severely).
 */
function scoreAppreciation(args: {
  yearBuilt: number | undefined;
  listPrice: number;
  squareFeet: number | undefined;
  medianPricePerSqft: number | undefined;
}): FactorScore {
  const weight = FACTOR_WEIGHTS.appreciation;
  const components: number[] = [];
  const rationaleParts: string[] = [];

  if (args.yearBuilt && Number.isFinite(args.yearBuilt)) {
    const yearScore = piecewiseLinear(args.yearBuilt, [
      { x: 1900, y: 50 },
      { x: 1980, y: 60 },
      { x: 2000, y: 70 },
      { x: 2010, y: 80 },
      { x: 2020, y: 95 },
      { x: 2025, y: 100 },
    ]);
    components.push(yearScore);
    rationaleParts.push(`built ${args.yearBuilt} → ${round1(yearScore)}/100 age signal`);
  }

  if (
    args.medianPricePerSqft &&
    args.medianPricePerSqft > 0 &&
    args.squareFeet &&
    args.squareFeet > 0 &&
    args.listPrice > 0
  ) {
    const pricePerSqft = args.listPrice / args.squareFeet;
    const ratio = pricePerSqft / args.medianPricePerSqft;
    // Below median → score above 50; above median → below.
    const ppsfScore = piecewiseLinear(ratio, [
      { x: 0.7, y: 100 },
      { x: 0.85, y: 80 },
      { x: 1.0, y: 60 },
      { x: 1.15, y: 40 },
      { x: 1.3, y: 20 },
      { x: 1.5, y: 0 },
    ]);
    components.push(ppsfScore);
    rationaleParts.push(
      `price/sqft $${round1(pricePerSqft)} vs median $${args.medianPricePerSqft} (${(ratio * 100).toFixed(0)}%) → ${round1(ppsfScore)}/100`,
    );
  }

  if (components.length === 0) {
    return {
      score: 60,
      weight,
      rationale: "Appreciation potential 60/100 — neutral default (no year built or comp data).",
    };
  }

  const score = round1(components.reduce((sum, c) => sum + c, 0) / components.length);
  return {
    score,
    weight,
    rationale: `Appreciation ${score}/100 — ${rationaleParts.join("; ")}.`,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function piecewiseLinear(x: number, anchors: Array<{ x: number; y: number }>): number {
  if (anchors.length === 0) return 0;
  // Sort defensively — callers should already pass them sorted.
  const sorted = [...anchors].sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (!first || !last) return 0;
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 0; i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (!lo || !hi) continue;
    if (x >= lo.x && x <= hi.x) {
      const t = (x - lo.x) / (hi.x - lo.x);
      return lo.y + t * (hi.y - lo.y);
    }
  }
  return last.y;
}

function rate(score: number): InvestmentScoreResult["rating"] {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Moderate";
  if (score >= 40) return "Weak";
  return "Poor";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
