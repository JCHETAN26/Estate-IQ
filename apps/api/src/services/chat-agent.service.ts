/**
 * Chat agent service.
 *
 * Orchestrates a single turn:
 *   1. Load (or create) the Conversation + history.
 *   2. Persist the user message.
 *   3. Build the message stream: system prompt + property context (if
 *      pinned) + history + the new user message.
 *   4. Run the tool-use loop against the OpenAI driver.
 *   5. Persist assistant + tool messages so the next turn has them.
 *
 * Returns a structured result with the assistant text and the trace of
 * tool calls executed. When OpenAI is unavailable, returns a structured
 * failure rather than fabricating a reply.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { executeTool } from "../mcp/executor.js";
import { logger } from "../mcp/logger.js";
import { buildOpenAiToolDefinitions } from "../ai/tool-definitions.js";
import {
  chatWithTools,
  type ChatDriver,
  type ToolCallTrace,
} from "../integrations/openai/chat-with-tools.js";
import {
  appendAssistantMessage,
  appendToolMessage,
  appendUserMessage,
  loadOrCreateConversation,
} from "./conversation.service.js";

const here = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(here, "../ai/prompts/system-chat-agent.md");

let cachedSystemPrompt: string | null = null;
async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await readFile(PROMPT_PATH, "utf8");
  return cachedSystemPrompt;
}

export type ChatTurnRequest = {
  /** Resume an existing conversation when provided. */
  conversationId?: string;
  /** Pin a property as default context (only used on the first turn). */
  propertyId?: string;
  message: string;
  /** Test-only override. Defaults to the real OpenAI driver. */
  driver?: ChatDriver;
};

export type ChatTurnResult =
  | {
      ok: true;
      conversationId: string;
      reply: string;
      toolCalls: ToolCallTrace[];
      iterations: number;
    }
  | {
      ok: false;
      conversationId: string;
      reason: string;
      message: string;
    };

export async function runChatTurn(request: ChatTurnRequest): Promise<ChatTurnResult> {
  const ctx = await loadOrCreateConversation({
    ...(request.conversationId ? { conversationId: request.conversationId } : {}),
    ...(request.propertyId ? { propertyId: request.propertyId } : {}),
  });

  await appendUserMessage(ctx.conversationId, request.message);

  const system = await loadSystemPrompt();
  const propertyHint = buildPropertyHint(ctx.property);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...(propertyHint ? [{ role: "system" as const, content: propertyHint }] : []),
    ...ctx.history,
    { role: "user", content: request.message },
  ];

  const tools = buildOpenAiToolDefinitions();

  const result = await chatWithTools({
    messages,
    tools,
    executeTool: async (name, args) => {
      const exec = await executeTool(name, args);
      return exec.result;
    },
    ...(request.driver ? { driver: request.driver } : {}),
  });

  if (!result.ok) {
    logger.warn("chat.turn_failed", {
      conversationId: ctx.conversationId,
      reason: result.reason,
    });
    return {
      ok: false,
      conversationId: ctx.conversationId,
      reason: result.reason,
      message: result.message,
    };
  }

  // Persist the assistant turn so the next request can pick up history.
  // We only persist the *final* assistant text — the intermediate tool
  // calls were already persisted as TOOL rows below.
  for (const trace of result.toolCalls) {
    await appendToolMessage({
      conversationId: ctx.conversationId,
      toolCallId: trace.toolCallId,
      toolName: trace.name,
      result: trace.result,
    });
  }
  await appendAssistantMessage({
    conversationId: ctx.conversationId,
    content: result.message,
    toolCalls: result.toolCalls.map((c) => ({
      id: c.toolCallId,
      name: c.name,
      arguments: c.arguments,
    })),
  });

  return {
    ok: true,
    conversationId: ctx.conversationId,
    reply: result.message,
    toolCalls: result.toolCalls,
    iterations: result.iterations,
  };
}

function buildPropertyHint(property: import("@prisma/client").Property | null): string | null {
  if (!property) return null;
  const lines: string[] = [
    "## Pinned property (use these values in any tool call that takes a property):",
    `- sourceUrl: ${property.sourceUrl}`,
    `- address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
    `- listPrice: ${Number(property.listPrice)}`,
    `- bedrooms: ${property.bedrooms}`,
    `- bathrooms: ${Number(property.bathrooms)}`,
    `- propertyType: ${property.propertyType}`,
  ];
  if (property.squareFeet !== null) lines.push(`- squareFeet: ${property.squareFeet}`);
  if (property.yearBuilt !== null) lines.push(`- yearBuilt: ${property.yearBuilt}`);
  if (property.taxesAnnual !== null) {
    lines.push(`- taxesAnnual: ${Number(property.taxesAnnual)}`);
  }
  if (property.insuranceAnnual !== null) {
    lines.push(`- insuranceAnnual: ${Number(property.insuranceAnnual)}`);
  }
  if (property.hoaMonthly !== null) {
    lines.push(`- hoaMonthly: ${Number(property.hoaMonthly)}`);
  }
  return lines.join("\n");
}
