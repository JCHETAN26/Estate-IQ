/**
 * MCP tool registry.
 *
 * Tools self-register at module load time. The registry is a name →
 * ToolDefinition map plus a reverse iteration helper for transports
 * (HTTP and stdio) that need to advertise the tool catalog.
 */

import type { McpToolName } from "@estate-iq/shared";
import type { AnyToolDefinition, ToolDefinition } from "./types.js";
import { ToolNotFoundError } from "./types.js";

class Registry {
  private readonly tools = new Map<McpToolName, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`MCP tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AnyToolDefinition {
    const tool = this.tools.get(name as McpToolName);
    if (!tool) throw new ToolNotFoundError(name);
    return tool;
  }

  has(name: string): boolean {
    return this.tools.has(name as McpToolName);
  }

  list(): readonly AnyToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

export const registry = new Registry();

/** Convenience helper for tool modules. */
export function defineTool<
  Input extends import("zod").ZodTypeAny,
  Output extends import("zod").ZodTypeAny,
>(definition: ToolDefinition<Input, Output>): ToolDefinition<Input, Output> {
  registry.register(definition as unknown as AnyToolDefinition);
  return definition;
}
