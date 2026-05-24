/**
 * Vitest setup.
 *
 * Tests must not depend on a live Postgres or live HTTP credentials.
 * Setting LOG_LEVEL silences the structured logger noise that surfaces
 * when Prisma fails to find DATABASE_URL.
 */

process.env.LOG_LEVEL = "error";
