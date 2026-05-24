/**
 * Environment loader.
 *
 * Loads `.env` from the workspace root so dev (tsx) and prod (node)
 * both see the same variables. Imported once at the top of the entry
 * file before any module that reads `process.env`.
 */

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

// Load workspace-root .env first, then a .env in apps/api if present
// (apps/api/.env wins because the second call overrides existing keys
// only when override:true is passed — we explicitly do not do that).
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(here, "../.env") });
