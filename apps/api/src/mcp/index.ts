/**
 * MCP module barrel.
 *
 * Imports every tool module so each one self-registers via defineTool().
 * Anywhere that imports from "./mcp" gets a fully-populated registry.
 */

import "./tools/parse-listing.js";
import "./tools/estimate-mortgage.js";
import "./tools/calculate-cash-flow.js";
import "./tools/estimate-rental.js";
import "./tools/analyze-airbnb.js";
import "./tools/score-investment.js";
import "./tools/generate-investment-summary.js";

export { registry } from "./registry.js";
export { executeTool } from "./executor.js";
export { logger } from "./logger.js";
export { ToolNotFoundError, ToolValidationError } from "./types.js";
export type { ToolContext, ToolDefinition } from "./types.js";
