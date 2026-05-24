/**
 * MCP tool framework — core types.
 *
 * A Tool is a name + description + input schema + output schema + handler.
 * Handlers are pure async functions over validated input. Each tool is
 * defined in its own module (apps/api/src/mcp/tools/<name>.ts) and may
 * not import another tool's internals — they must remain independently
 * callable per the build plan.
 */

import type { z } from "zod";
import type { McpToolName } from "@estate-iq/shared";

export type ToolContext = {
  /** Correlates logs across one tool invocation. */
  readonly requestId: string;
  /** ISO timestamp of when the invocation started. */
  readonly startedAt: string;
};

export type ToolDefinition<
  Input extends z.ZodTypeAny = z.ZodTypeAny,
  Output extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  readonly name: McpToolName;
  readonly description: string;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
  readonly handler: (input: z.infer<Input>, ctx: ToolContext) => Promise<z.infer<Output>>;
};

export type AnyToolDefinition = ToolDefinition;

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(`MCP tool not found: ${name}`);
    this.name = "ToolNotFoundError";
  }
}

export class ToolValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: unknown,
  ) {
    super(message);
    this.name = "ToolValidationError";
  }
}
