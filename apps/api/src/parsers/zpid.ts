/**
 * Zillow URL utilities.
 *
 * Zillow detail URLs look like:
 *   https://www.zillow.com/homedetails/123-Main-St-Austin-TX-78701/12345678_zpid/
 *
 * We canonicalize on the ZPID since the slug portion can drift
 * (re-listings, address corrections) but the ZPID is stable.
 */

const ZPID_REGEX = /\/(\d+)_zpid\/?/i;
const ZILLOW_HOST_REGEX = /(?:^|\.)zillow\.com$/i;

export function isZillowUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return ZILLOW_HOST_REGEX.test(url.hostname);
  } catch {
    return false;
  }
}

export function extractZpid(rawUrl: string): string | null {
  const match = ZPID_REGEX.exec(rawUrl);
  return match?.[1] ?? null;
}

/**
 * Returns a canonical URL form keyed on ZPID, or null if the URL is
 * not a Zillow detail page. We keep the original slug so downstream
 * UI can render it, but cache lookups only need the ZPID.
 */
export function canonicalizeZillowUrl(rawUrl: string): string | null {
  if (!isZillowUrl(rawUrl)) return null;
  const zpid = extractZpid(rawUrl);
  if (!zpid) return null;
  try {
    const url = new URL(rawUrl);
    // Strip query params and fragments — they never affect listing identity.
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
