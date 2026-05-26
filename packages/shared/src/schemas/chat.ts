/**
 * Chat agent request / response schemas.
 *
 * The agent is a thin wrapper around the existing MCP tool surface,
 * so the request shape is intentionally simple: a message, an optional
 * conversation id (for multi-turn), and an optional property id (to
 * pin the agent's context to a specific listing).
 */

import { z } from "zod";

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4_000),
  conversationId: z.string().min(1).max(64).optional(),
  propertyId: z.string().min(1).max(64).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ToolCallTraceSchema = z.object({
  iteration: z.number().int().min(1),
  toolCallId: z.string(),
  name: z.string(),
  arguments: z.unknown(),
  result: z.unknown(),
  ok: z.boolean(),
});
export type ToolCallTrace = z.infer<typeof ToolCallTraceSchema>;

export const ChatResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    conversationId: z.string(),
    reply: z.string(),
    toolCalls: z.array(ToolCallTraceSchema),
    iterations: z.number().int().min(1),
  }),
  z.object({
    status: z.literal("error"),
    conversationId: z.string(),
    reason: z.string(),
    message: z.string(),
  }),
]);
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
