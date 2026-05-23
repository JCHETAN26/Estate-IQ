/**
 * @estate-iq/analysis-engine
 *
 * Pure financial underwriting logic: mortgage, rental, Airbnb, scoring.
 * Implementations land in Phase 2.
 */

import { SHARED_PACKAGE_NAME } from "@estate-iq/shared";

export const ANALYSIS_ENGINE_PACKAGE_NAME = "@estate-iq/analysis-engine" as const;

/** Sanity check that workspace resolution to @estate-iq/shared is wired. */
export function describeStack(): string {
  return `${ANALYSIS_ENGINE_PACKAGE_NAME} depends on ${SHARED_PACKAGE_NAME}`;
}
