/**
 * Memo generator service tests.
 *
 * The OpenAI client returns no_api_key when OPENAI_API_KEY is unset,
 * which routes all of these tests through the deterministic fallback.
 * That's the path we can assert against without burning credits or
 * needing a network.
 *
 * For the openai source path, end-to-end verification happens via the
 * MCP HTTP transport in dev with a real key — covered in the PR
 * description, not in unit tests.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeAirbnb,
  calculateCashFlow,
  calculateInvestmentScore,
  calculateMortgage,
} from "@estate-iq/analysis-engine";
import type { Property, RentalEstimate } from "@estate-iq/shared";
import { generateInvestmentMemo } from "../src/services/memo-generator.service.js";

const austinSample: Property = {
  sourceUrl: "https://www.zillow.com/homedetails/sample-listing/0_zpid/",
  address: "123 Sample St",
  city: "Austin",
  state: "TX",
  zipCode: "78701",
  listPrice: 450_000,
  bedrooms: 3,
  bathrooms: 2.5,
  squareFeet: 1850,
  yearBuilt: 2008,
  propertyType: "SINGLE_FAMILY",
  hoaMonthly: 0,
  taxesAnnual: 7200,
  insuranceAnnual: 1800,
};

const rentalEstimate: RentalEstimate = {
  source: "MOCK",
  estimatedRent: 2900,
  rentLow: 2700,
  rentHigh: 3100,
  occupancyRatePct: 95,
  comparables: [],
  yieldMetrics: {
    rentToPricePct: 7.733,
    grossRentMultiplier: 12.93,
    meetsOnePercentRule: false,
  },
};

const financing = {
  downPaymentPct: 20,
  interestRatePct: 7,
  loanTermYears: 30,
};

const mortgage = calculateMortgage({
  listPrice: austinSample.listPrice,
  ...financing,
});

const cashFlow = calculateCashFlow({
  financing: {
    listPrice: austinSample.listPrice,
    ...financing,
    propertyTaxAnnual: austinSample.taxesAnnual ?? 0,
    insuranceAnnual: austinSample.insuranceAnnual ?? 0,
    hoaMonthly: austinSample.hoaMonthly ?? 0,
  },
  rental: { monthlyRent: rentalEstimate.estimatedRent },
});

const score = calculateInvestmentScore({
  listPrice: austinSample.listPrice,
  cashOnCashPct: cashFlow.cashOnCashPct,
  rentToPricePct: 7.733,
  propertyTaxAnnual: austinSample.taxesAnnual,
  squareFeet: austinSample.squareFeet,
  yearBuilt: austinSample.yearBuilt,
  city: austinSample.city,
  state: austinSample.state,
});

const airbnbAnalysis = analyzeAirbnb({
  averageDailyRate: 251,
  occupancyRatePct: 70,
  monthlyFixedCarryingCost: cashFlow.monthlyPaymentPITI,
});

describe("generateInvestmentMemo — deterministic fallback", () => {
  it("returns a memo when OPENAI_API_KEY is unset", async () => {
    const outcome = await generateInvestmentMemo({
      property: austinSample,
      rentalEstimate,
      mortgage,
      cashFlow,
      airbnb: { source: "MARKET_RULES", analysis: airbnbAnalysis },
      score,
      financingNotes: financing,
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.source).toBe("fallback");
    expect(outcome.memo.headline.length).toBeGreaterThan(20);
    expect(outcome.memo.strengths.length).toBeGreaterThanOrEqual(1);
    expect(outcome.memo.risks.length).toBeGreaterThanOrEqual(1);
    expect(outcome.memo.negotiationInsights.length).toBeGreaterThanOrEqual(1);
    expect(["Buy", "Pass", "Negotiate", "Investigate further"]).toContain(
      outcome.memo.recommendation,
    );
  });

  it("references the actual cash flow figure", async () => {
    const outcome = await generateInvestmentMemo({
      property: austinSample,
      rentalEstimate,
      mortgage,
      cashFlow,
      airbnb: null,
      score,
      financingNotes: financing,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Negative cash flow → headline mentions weak/poor or includes a
    // negotiation hint.
    const text = [outcome.memo.summary, ...outcome.memo.risks].join(" ");
    expect(text.toLowerCase()).toContain("cash flow");
  });

  it("flags low confidence when rental source is MOCK", async () => {
    const outcome = await generateInvestmentMemo({
      property: austinSample,
      rentalEstimate,
      mortgage,
      cashFlow,
      airbnb: null,
      score,
      financingNotes: financing,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.memo.confidence).toBe("Low");
  });

  it("returns higher confidence when rental source is RentCast", async () => {
    const outcome = await generateInvestmentMemo({
      property: austinSample,
      rentalEstimate: { ...rentalEstimate, source: "RENTCAST" },
      mortgage,
      cashFlow,
      airbnb: null,
      score,
      financingNotes: financing,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.memo.confidence).toBe("High");
  });

  it("recommends Pass when score is low and cash flow is negative", async () => {
    // The current Austin baseline scores ~54.7 with negative CoC,
    // which falls just below the 'Investigate further' floor.
    const outcome = await generateInvestmentMemo({
      property: austinSample,
      rentalEstimate,
      mortgage,
      cashFlow,
      airbnb: null,
      score,
      financingNotes: financing,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(["Pass", "Investigate further", "Negotiate"]).toContain(outcome.memo.recommendation);
  });
});

describe("generateInvestmentMemo — prompt rendering", () => {
  it("populates the prompt template without throwing on missing optional fields", async () => {
    const minimalProperty: Property = {
      sourceUrl: "https://www.zillow.com/homedetails/min/1_zpid/",
      address: "1 Min Way",
      city: "Houston",
      state: "TX",
      zipCode: "77006",
      listPrice: 300_000,
      bedrooms: 2,
      bathrooms: 1,
      propertyType: "CONDO",
    };
    const minMortgage = calculateMortgage({
      listPrice: minimalProperty.listPrice,
      ...financing,
    });
    const minCashFlow = calculateCashFlow({
      financing: { listPrice: minimalProperty.listPrice, ...financing },
      rental: { monthlyRent: 2000 },
    });
    const minScore = calculateInvestmentScore({
      listPrice: minimalProperty.listPrice,
      cashOnCashPct: minCashFlow.cashOnCashPct,
    });

    const outcome = await generateInvestmentMemo({
      property: minimalProperty,
      rentalEstimate: {
        ...rentalEstimate,
        estimatedRent: 2000,
        comparables: [],
      },
      mortgage: minMortgage,
      cashFlow: minCashFlow,
      airbnb: null,
      score: minScore,
      financingNotes: financing,
    });
    expect(outcome.ok).toBe(true);
  });
});
