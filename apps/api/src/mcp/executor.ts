/**
 * MCP tool executor.
 *
 * Validates input → runs handler → validates output → returns result.
 * Wraps every invocation with structured logs and a request id so a
 * single tool call is traceable end-to-end.
 *
 * Validation failures throw ToolValidationError which transports
 * surface as 4xx / structured MCP errors. Handler failures bubble
 * up as 5xx / internal MCP errors.
 */

import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { logger } from "./logger.js";
import { registry } from "./registry.js";
import { ToolValidationError } from "./types.js";

export type ExecuteOptions = {
  /** Override the auto-generated request id (e.g. from an HTTP header). */
  requestId?: string;
};

export type ExecuteResult<TOutput> = {
  result: TOutput;
  requestId: string;
  durationMs: number;
};

export async function executeTool<TOutput = unknown>(
  name: string,
  rawInput: unknown,
  options: ExecuteOptions = {},
): Promise<ExecuteResult<TOutput>> {
  const requestId = options.requestId ?? randomUUID();
  const startedAt = new Date().toISOString();
  const start = process.hrtime.bigint();

  const tool = registry.get(name); // throws ToolNotFoundError

  logger.info("mcp.tool.invoke", { tool: tool.name, requestId });

  // Validate input
  const inputParse = tool.inputSchema.safeParse(rawInput);
  if (!inputParse.success) {
    const err = new ToolValidationError(
      `Invalid input for tool '${tool.name}'`,
      inputParse.error.flatten(),
    );
    logger.warn("mcp.tool.invalid_input", {
      tool: tool.name,
      requestId,
      issues: err.issues,
    });
    throw err;
  }

  // Run handler
  let output: unknown;
  try {
    output = await tool.handler(inputParse.data, { requestId, startedAt });
  } catch (error) {
    logger.error("mcp.tool.handler_failed", {
      tool: tool.name,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // Validate output (catch buggy handlers early)
  const outputParse = tool.outputSchema.safeParse(output);
  if (!outputParse.success) {
    logger.error("mcp.tool.invalid_output", {
      tool: tool.name,
      requestId,
      issues: outputParse.error.flatten(),
    });
    throw new ToolValidationError(
      `Tool '${tool.name}' returned an invalid payload`,
      outputParse.error.flatten(),
    );
  }

  const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
  logger.info("mcp.tool.success", {
    tool: tool.name,
    requestId,
    durationMs,
  });

  return {
    result: outputParse.data as TOutput,
    requestId,
    durationMs,
  };
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}
