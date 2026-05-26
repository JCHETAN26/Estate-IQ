/**
 * HTTP transport for the chat agent.
 *
 * POST /chat
 *   Body: { message: string, conversationId?: string, propertyId?: string }
 *   Response (200): { status: "ok", conversationId, reply, toolCalls, iterations }
 *   Response (4xx/5xx): { status: "error", conversationId, reason, message }
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { ChatRequestSchema } from "@estate-iq/shared";
import { logger } from "../mcp/logger.js";
import { runChatTurn } from "../services/chat-agent.service.js";

const MAX_BODY_BYTES = 256_000;

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

export async function handleChatRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = req.url ?? "";
  const method = req.method ?? "GET";

  if (method !== "POST" || url !== "/chat") return false;

  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (error) {
    send(res, 400, {
      error: "invalid_json",
      message: error instanceof Error ? error.message : "could not read body",
    });
    return true;
  }

  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    send(res, 400, {
      error: "validation_failed",
      issues: parsed.error.flatten(),
    });
    return true;
  }

  try {
    const result = await runChatTurn(parsed.data);
    if (result.ok) {
      send(res, 200, {
        status: "ok",
        conversationId: result.conversationId,
        reply: result.reply,
        toolCalls: result.toolCalls,
        iterations: result.iterations,
      });
    } else {
      const httpStatus = result.reason === "no_api_key" ? 503 : 502;
      send(res, httpStatus, {
        status: "error",
        conversationId: result.conversationId,
        reason: result.reason,
        message: result.message,
      });
    }
  } catch (error) {
    logger.error("chat.handler_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    send(res, 500, {
      error: "internal_error",
      message: "chat handler failed",
    });
  }
  return true;
}
