/**
 * MCP-native stdio entry point.
 *
 * Wires the same tool registry to a stdio MCP server using
 * @modelcontextprotocol/sdk so the toolset is discoverable by any
 * MCP-compliant client (Claude Desktop, IDE integrations, etc.).
 *
 * Run with:  pnpm --filter @estate-iq/api mcp:stdio
 */

import "./env.js";
process.env.MCP_TRANSPORT = "stdio";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { executeTool } from "./mcp/executor.js";
import { logger } from "./mcp/logger.js";
import { registry } from "./mcp/registry.js";
import { ToolNotFoundError, ToolValidationError } from "./mcp/types.js";
// Side-effect import: registers all tools.
import "./mcp/index.js";

const server = new Server({ name: "estate-iq", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: zodToJsonSchema(tool.inputSchema, { target: "openApi3" }) as Record<
      string,
      unknown
    >,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const { result } = await executeTool(name, args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      return {
        isError: true,
        content: [{ type: "text", text: `Tool not found: ${name}` }],
      };
    }
    if (error instanceof ToolValidationError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "validation_failed", issues: error.issues }),
          },
        ],
      };
    }
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : "unknown error",
        },
      ],
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("mcp.stdio.ready", { tools: registry.list().map((t) => t.name) });
}

main().catch((error) => {
  logger.error("mcp.stdio.fatal", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
