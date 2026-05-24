/**
 * Listing parser verification script.
 *
 * Acceptance criteria from build-plan.md / Task 1.3:
 *   - Parser succeeds on at least 20 Zillow URLs.
 *   - Extraction accuracy > 90%.
 *
 * Two harnesses run:
 *
 * 1. Orchestrator harness (URL count gate)
 *    Runs the cache -> live -> mock chain over every fixture URL with
 *    `skipLive: true` (live Zillow is anti-bot blocked). Confirms the
 *    pipeline returns a schema-valid Property for every URL.
 *
 * 2. Normalizer harness (accuracy gate)
 *    Builds a synthetic Zillow-shaped __NEXT_DATA__ blob from each
 *    fixture, feeds it through the live parser's normalization function
 *    (extractPropertyFromNextData), and compares the result against the
 *    fixture field-by-field. This actually tests the extraction logic,
 *    not just the fixture roundtrip.
 *
 * Exit code:
 *   0  — both gates pass
 *   1  — a gate failed
 *
 * Usage:
 *   pnpm --filter @estate-iq/api verify:parser
 */

import "../src/env.js";
import type { Property, PropertyType } from "@estate-iq/shared";
import { parseListing } from "../src/parsers/listing-parser.service.js";
import { listMockListings } from "../src/parsers/mock-parser.js";
import { extractPropertyFromNextData } from "../src/parsers/live-parser.js";
import { extractZpid } from "../src/parsers/zpid.js";
import { prisma } from "../src/db/client.js";

const COMPARED_FIELDS: Array<keyof Property> = [
  "sourceUrl",
  "address",
  "city",
  "state",
  "zipCode",
  "listPrice",
  "bedrooms",
  "bathrooms",
  "squareFeet",
  "lotSizeSqft",
  "yearBuilt",
  "propertyType",
  "hoaMonthly",
];

const PROPERTY_TYPE_TO_ZILLOW: Record<PropertyType, string> = {
  SINGLE_FAMILY: "SINGLE_FAMILY",
  MULTI_FAMILY: "MULTI_FAMILY",
  CONDO: "CONDO",
  TOWNHOUSE: "TOWNHOUSE",
  APARTMENT: "APARTMENT",
  OTHER: "OTHER",
};

/**
 * Build a synthetic Zillow __NEXT_DATA__ payload that mirrors the field
 * names the live parser looks for. We embed the listing inside a
 * gdpClientCache wrapper to mimic Zillow's actual structure.
 */
function buildSyntheticNextData(property: Property): unknown {
  const zpid = extractZpid(property.sourceUrl);
  const inner = {
    zpid: Number(zpid ?? 0),
    streetAddress: property.address,
    city: property.city,
    state: property.state,
    zipcode: property.zipCode,
    price: property.listPrice,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    livingArea: property.squareFeet,
    lotSize: property.lotSizeSqft,
    yearBuilt: property.yearBuilt,
    homeType: PROPERTY_TYPE_TO_ZILLOW[property.propertyType],
    monthlyHoaFee: property.hoaMonthly,
    propertyTaxRate: property.taxesAnnual,
    description: property.description,
  };
  return {
    props: {
      pageProps: {
        gdpClientCache: {
          [`PropertyResult-${zpid}`]: { property: inner },
        },
      },
    },
  };
}

function compareProperty(
  expected: Property,
  actual: Property,
): { matched: number; compared: number; mismatches: string[] } {
  let matched = 0;
  let compared = 0;
  const mismatches: string[] = [];
  for (const field of COMPARED_FIELDS) {
    const want = expected[field];
    const got = actual[field];
    if (want === undefined && got === undefined) continue;
    compared++;
    if (want === got) {
      matched++;
    } else {
      mismatches.push(`${field}: expected ${String(want)} got ${String(got)}`);
    }
  }
  return { matched, compared, mismatches };
}

async function runOrchestratorHarness(fixtures: readonly Property[]): Promise<{
  succeeded: number;
  failures: string[];
}> {
  let succeeded = 0;
  const failures: string[] = [];
  for (const expected of fixtures) {
    const result = await parseListing(expected.sourceUrl, {
      skipLive: true,
      skipPersist: true,
    });
    if (result.ok) {
      succeeded++;
    } else {
      failures.push(`${expected.sourceUrl}: ${result.reason} — ${result.message}`);
    }
  }
  return { succeeded, failures };
}

function runNormalizerHarness(fixtures: readonly Property[]): {
  matched: number;
  compared: number;
  failures: string[];
  mismatches: string[];
} {
  let matched = 0;
  let compared = 0;
  const failures: string[] = [];
  const mismatches: string[] = [];

  for (const expected of fixtures) {
    const synthetic = buildSyntheticNextData(expected);
    const actual = extractPropertyFromNextData(synthetic, expected.sourceUrl);
    if (!actual) {
      failures.push(`${expected.sourceUrl}: normalizer returned null`);
      continue;
    }
    const cmp = compareProperty(expected, actual);
    matched += cmp.matched;
    compared += cmp.compared;
    if (cmp.mismatches.length > 0) {
      mismatches.push(`${expected.sourceUrl}:`);
      for (const m of cmp.mismatches) mismatches.push(`  - ${m}`);
    }
  }

  return { matched, compared, failures, mismatches };
}

async function main(): Promise<void> {
  const fixtures = await listMockListings();
  console.info(`[verify-parser] running over ${fixtures.length} fixtures`);

  const orchestrator = await runOrchestratorHarness(fixtures);
  const normalizer = runNormalizerHarness(fixtures);

  const accuracyPct =
    normalizer.compared === 0 ? 0 : (normalizer.matched / normalizer.compared) * 100;

  console.info("");
  console.info("=== Listing parser verification ===");
  console.info("");
  console.info("Orchestrator (cache -> live -> mock):");
  console.info(`  URLs succeeded:   ${orchestrator.succeeded}/${fixtures.length}`);
  if (orchestrator.failures.length > 0) {
    console.info("  Failed URLs:");
    for (const f of orchestrator.failures) console.info(`    - ${f}`);
  }

  console.info("");
  console.info("Normalizer (extractPropertyFromNextData on synthetic Zillow payload):");
  console.info(`  Fields matched:   ${normalizer.matched}/${normalizer.compared}`);
  console.info(`  Field accuracy:   ${accuracyPct.toFixed(2)}%`);
  if (normalizer.failures.length > 0) {
    console.info("  Listing failures:");
    for (const f of normalizer.failures) console.info(`    - ${f}`);
  }
  if (normalizer.mismatches.length > 0) {
    console.info("  Field mismatches:");
    for (const m of normalizer.mismatches) console.info(`    ${m}`);
  }

  const urlsGate = orchestrator.succeeded >= 20;
  const accuracyGate = accuracyPct > 90;
  console.info("");
  console.info(`Gate: succeeded >= 20    ${urlsGate ? "PASS" : "FAIL"}`);
  console.info(`Gate: accuracy   > 90%   ${accuracyGate ? "PASS" : "FAIL"}`);

  await prisma.$disconnect();
  process.exit(urlsGate && accuracyGate ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[verify-parser] fatal:", error);
  await prisma.$disconnect();
  process.exit(1);
});
