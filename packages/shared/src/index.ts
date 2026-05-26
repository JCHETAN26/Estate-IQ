/**
 * @estate-iq/shared
 *
 * Cross-cutting Zod schemas, types, and validators consumed by both the
 * MCP backend (apps/api) and the Next.js frontend (apps/web).
 */

export const SHARED_PACKAGE_NAME = "@estate-iq/shared" as const;

export type PackageInfo = {
  readonly name: typeof SHARED_PACKAGE_NAME;
  readonly version: string;
};

// Domain schemas
export * from "./schemas/property.js";
export * from "./schemas/financing.js";
export * from "./schemas/rental.js";
export * from "./schemas/chat.js";
export * from "./schemas/mcp.js";
