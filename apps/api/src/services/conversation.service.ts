/**
 * Conversation persistence service.
 *
 * Loads + saves Conversation and Message rows. Translates between the
 * Prisma row shape and the OpenAI ChatCompletionMessageParam shape so
 * the agent can resume a conversation across requests.
 *
 * SYSTEM messages are NOT persisted — the system prompt is loaded
 * fresh from disk every turn so that prompt iterations don't require
 * a database migration.
 */

import type { Prisma } from "@prisma/client";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { prisma } from "../db/client.js";
import { logger } from "../mcp/logger.js";

const TOOL_PAYLOAD_KEY = "tool_payload";

export type StoredMessageRole = "USER" | "ASSISTANT" | "TOOL" | "SYSTEM";

export type ConversationContext = {
  conversationId: string;
  /** Previous turns, in OpenAI shape, ready to send to the model. */
  history: ChatCompletionMessageParam[];
  /** The pinned property, if any. */
  property: import("@prisma/client").Property | null;
};

export async function loadOrCreateConversation(args: {
  conversationId?: string;
  propertyId?: string;
  ownerId?: string;
}): Promise<ConversationContext> {
  if (args.conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: args.conversationId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        property: true,
      },
    });
    if (!conversation) {
      throw new Error(`Conversation not found: ${args.conversationId}`);
    }
    return {
      conversationId: conversation.id,
      property: conversation.property,
      history: conversation.messages.map(rowToMessageParam),
    };
  }

  const created = await prisma.conversation.create({
    data: {
      ...(args.propertyId ? { propertyId: args.propertyId } : {}),
      ...(args.ownerId ? { ownerId: args.ownerId } : {}),
    },
    include: { property: true },
  });
  return {
    conversationId: created.id,
    property: created.property,
    history: [],
  };
}

export async function appendUserMessage(conversationId: string, content: string): Promise<void> {
  await prisma.message.create({
    data: { conversationId, role: "USER", content },
  });
}

export async function appendAssistantMessage(args: {
  conversationId: string;
  content: string;
  toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
}): Promise<void> {
  const toolPayload: Prisma.InputJsonValue | null =
    args.toolCalls.length > 0
      ? ({
          calls: args.toolCalls.map((c) => ({
            id: c.id,
            name: c.name,
            arguments: JSON.parse(JSON.stringify(c.arguments ?? {})) as Prisma.InputJsonValue,
          })),
        } as Prisma.InputJsonValue)
      : null;
  await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      role: "ASSISTANT",
      content: args.content,
      ...(toolPayload !== null ? { toolPayload } : {}),
    },
  });
}

export async function appendToolMessage(args: {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  result: unknown;
}): Promise<void> {
  const content = JSON.stringify(args.result);
  const toolPayload: Prisma.InputJsonValue = {
    toolCallId: args.toolCallId,
    name: args.toolName,
    result: JSON.parse(JSON.stringify(args.result ?? null)) as Prisma.InputJsonValue,
  };
  await prisma.message.create({
    data: {
      conversationId: args.conversationId,
      role: "TOOL",
      content,
      toolPayload,
    },
  });
}

function rowToMessageParam(row: {
  role: StoredMessageRole;
  content: string;
  toolPayload: unknown;
}): ChatCompletionMessageParam {
  switch (row.role) {
    case "USER":
      return { role: "user", content: row.content };
    case "ASSISTANT": {
      const payload = (row.toolPayload as Record<string, unknown> | null) ?? null;
      const calls =
        (payload?.["calls"] as
          | Array<{ id: string; name: string; arguments: unknown }>
          | undefined) ?? [];
      if (calls.length > 0) {
        return {
          role: "assistant",
          content: row.content || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: {
              name: c.name,
              arguments:
                typeof c.arguments === "string" ? c.arguments : JSON.stringify(c.arguments ?? {}),
            },
          })),
        };
      }
      return { role: "assistant", content: row.content };
    }
    case "TOOL": {
      const payload = (row.toolPayload as Record<string, unknown> | null) ?? null;
      const toolCallId = (payload?.["toolCallId"] as string | undefined) ?? "";
      return {
        role: "tool",
        tool_call_id: toolCallId,
        content: row.content,
      };
    }
    case "SYSTEM":
    default:
      logger.warn("conversation.unexpected_system_row", { content: row.content });
      return { role: "system", content: row.content };
  }
}

void TOOL_PAYLOAD_KEY;
