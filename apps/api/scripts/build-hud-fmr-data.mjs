/**
 * Convert HUD's FY2025 Small Area Fair Market Rents XLSX into a compact
 * JSON keyed by ZIP code with monthly rents for 0–4 bedroom units.
 *
 * Source: https://www.huduser.gov/portal/datasets/fmr/fmr2025/fy2025_safmrs.xlsx
 *         (public-domain US government data)
 *
 * Run once during a release / refresh:
 *   node apps/api/scripts/build-hud-fmr-data.mjs <path-to-xlsx>
 *
 * Output: apps/api/src/integrations/hud-fmr/data/safmr-2025.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: build-hud-fmr-data.mjs <path-to-fy2025_safmrs.xlsx>");
  process.exit(1);
}

// State is the 2-letter code that follows the comma in the area name.
// Examples we need to handle:
//   "Austin-Round Rock-San Marcos, TX MSA"
//   "Houston-The Woodlands-Sugar Land, TX HUD Metro FMR Area"
//   "Bexar County, TX"
//   "Albany-Schenectady-Troy, NY HMFA"
const STATE_PATTERN = /,\s*([A-Z]{2})(?:\s|$)/;

function extractState(areaName) {
  const match = STATE_PATTERN.exec(areaName.trim());
  return match ? match[1] : null;
}

const workbook = XLSX.read(readFileSync(inputPath), { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

const out = {};
let dropped = 0;
for (const row of rows) {
  const zipCode = String(
    row["ZIP\nCode"] ?? row["ZIP Code"] ?? row.ZIP ?? "",
  ).padStart(5, "0");
  const areaName = String(row["HUD Fair Market Rent Area Name"] ?? "");
  const state = extractState(areaName);

  const br0 = row["SAFMR\n0BR"] ?? row["SAFMR 0BR"];
  const br1 = row["SAFMR\n1BR"] ?? row["SAFMR 1BR"];
  const br2 = row["SAFMR\n2BR"] ?? row["SAFMR 2BR"];
  const br3 = row["SAFMR\n3BR"] ?? row["SAFMR 3BR"];
  const br4 = row["SAFMR\n4BR"] ?? row["SAFMR 4BR"];

  if (
    !state ||
    zipCode.length !== 5 ||
    !Number.isFinite(Number(br0)) ||
    !Number.isFinite(Number(br1)) ||
    !Number.isFinite(Number(br2)) ||
    !Number.isFinite(Number(br3)) ||
    !Number.isFinite(Number(br4))
  ) {
    dropped++;
    continue;
  }

  out[zipCode] = {
    state,
    rents: [Number(br0), Number(br1), Number(br2), Number(br3), Number(br4)],
  };
}

const outPath = resolve(
  repoRoot,
  "apps/api/src/integrations/hud-fmr/data/safmr-2025.json",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ year: 2025, source: "HUD SAFMR", entries: out }));

console.info(`Wrote ${Object.keys(out).length} zip codes (dropped ${dropped}) to ${outPath}`);
