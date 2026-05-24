/**
 * HTTP transport for the MCP tool layer.
 *
 * Exposes:
 *   GET  /mcp/tools                — list registered tools (name + description)
 *   POST /mcp/tools/:name           — invoke a tool with a JSON body
 *
 * This transport is independent of the MCP-native stdio transport; both
 * read from the same registry, so a tool added once is callable from
 * either entry point. Useful for local dev, integration tests, and the
 * frontend (Phase 4) which speaks HTTP.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { executeTool } from "../executor.js";
import { logger } from "../logger.js";
import { registry } from "../registry.js";
import { ToolNotFoundError, ToolValidationError } from "../types.js";

const MAX_BODY_BYTES = 1_000_000; // 1MB ceiling on tool-call payloads

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

/**
 * Returns true if the request was handled (so callers can chain to a
 * fallback 404 handler).
 */
export async function handleMcpHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (method === "GET" && url === "/mcp/tools") {
    const tools = registry.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
    send(res, 200, { tools });
    return true;
  }

  const invokeMatch = /^\/mcp\/tools\/([a-z0-9_]+)$/.exec(url);
  if (method === "POST" && invokeMatch) {
    const toolName = invokeMatch[1] ?? "";
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      send(res, 400, {
        error: "invalid_json",
        message: error instanceof Error ? error.message : "could not read request body",
      });
      return true;
    }

    const requestIdHeader = req.headers["x-request-id"];
    const requestId = typeof requestIdHeader === "string" ? requestIdHeader : undefined;

    try {
      const {
        result,
        requestId: resolvedRequestId,
        durationMs,
      } = await executeTool(toolName, body, requestId !== undefined ? { requestId } : {});
      res.setHeader("X-Request-Id", resolvedRequestId);
      res.setHeader("X-Duration-Ms", String(durationMs));
      send(res, 200, { ok: true, result, requestId: resolvedRequestId, durationMs });
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        send(res, 404, { error: "tool_not_found", message: error.message });
      } else if (error instanceof ToolValidationError) {
        send(res, 400, {
          error: "validation_failed",
          message: error.message,
          issues: error.issues,
        });
      } else {
        logger.error("mcp.http.unhandled", {
          tool: toolName,
          message: error instanceof Error ? error.message : String(error),
        });
        send(res, 500, {
          error: "internal_error",
          message: "tool handler failed",
        });
      }
    }
    return true;
  }

  return false;
}
