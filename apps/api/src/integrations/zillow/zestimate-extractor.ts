/**
 * Extract Zillow's rent Zestimate from a __NEXT_DATA__ payload.
 *
 * Zillow embeds two Zestimate fields in their hydration JSON:
 *   - zestimate         estimated home value
 *   - rentZestimate     estimated monthly rent
 *
 * We only care about rentZestimate here. Same defensive walk pattern
 * as the listing extractor — Zillow's payload shape varies across
 * listing types and they revise it occasionally.
 *
 * Pure function; no I/O.
 */

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFindAll(
  value: unknown,
  predicate: (node: AnyRecord) => boolean,
  out: AnyRecord[] = [],
): AnyRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) deepFindAll(item, predicate, out);
    return out;
  }
  if (isRecord(value)) {
    if (predicate(value)) out.push(value);
    for (const key of Object.keys(value)) {
      deepFindAll(value[key], predicate, out);
    }
  }
  return out;
}

export function extractRentZestimateFromNextData(nextData: unknown): number | null {
  // The first node we find with a finite rentZestimate wins. Some
  // payloads have multiple (e.g. the property record + a "similar
  // homes" listing) — they all carry the same number.
  const candidates = deepFindAll(nextData, (n) => {
    const value = n["rentZestimate"];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  });
  if (candidates.length === 0) return null;
  const node = candidates[0];
  if (!node) return null;
  const value = node["rentZestimate"];
  return typeof value === "number" ? value : null;
}
