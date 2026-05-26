/**
 * Convert the MCP tool registry into OpenAI tool definitions.
 *
 * The OpenAI chat-completions API expects each tool as
 *   { type: "function", function: { name, description, parameters } }
 * where `parameters` is a JSON Schema. Our tools' input schemas are
 * Zod, so we run them through zod-to-json-schema.
 *
 * This is the inverse of what we do in the stdio MCP transport — both
 * read from the same registry, so any tool registered once is callable
 * from both surfaces.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { zodToJsonSchema } from "zod-to-json-schema";
import { registry } from "../mcp/registry.js";

export function buildOpenAiToolDefinitions(): ChatCompletionTool[] {
  return registry.list().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema, { target: "openApi3" }) as Record<
        string,
        unknown
      >,
    },
  }));
}
