/**
 * @estate-iq/shared
 *
 * Cross-cutting Zod schemas, types, and validators consumed by both the
 * MCP backend (apps/api) and the Next.js frontend (apps/web).
 *
 * Real schemas land in Phase 1 (Task 1.1 — DB models, Task 1.2 — MCP tools).
 * Phase 0 only ships the package surface so workspace wiring is provable.
 */

export const SHARED_PACKAGE_NAME = "@estate-iq/shared" as const;

export type PackageInfo = {
  readonly name: typeof SHARED_PACKAGE_NAME;
  readonly version: string;
};
