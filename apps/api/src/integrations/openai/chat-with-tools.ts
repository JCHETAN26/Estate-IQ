/**
 * OpenAI chat-with-tools loop.
 *
 * Sends a conversation to the model along with available tools, executes
 * any tool calls the model requests, feeds the results back, and loops
 * until the model returns a final assistant text response (or we hit
 * the iteration limit).
 *
 * The "driver" parameter abstracts the LLM call so tests can inject a
 * fake driver and exercise the loop without burning OpenAI credits.
 */

import OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { logger } from "../../mcp/logger.js";

const MAX_ITERATIONS = 5;
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const TIMEOUT_MS = 30_000;

export type ToolExecutor = (name: string, rawArguments: unknown) => Promise<unknown>;

export type ChatDriver = (params: {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  model: string;
}) => Promise<ChatCompletionMessage>;

export type ChatWithToolsRequest = {
  messages: ChatCompletionMessageParam[];
  tools: ChatCompletionTool[];
  executeTool: ToolExecutor;
  /** Optional override for testing. Defaults to the real OpenAI driver. */
  driver?: ChatDriver;
  model?: string;
  /** Maximum tool-call rounds. Default 5. Bound prevents runaway costs. */
  maxIterations?: number;
};

export type ToolCallTrace = {
  iteration: number;
  toolCallId: string;
  name: string;
  arguments: unknown;
  result: unknown;
  ok: boolean;
};

export type ChatWithToolsResult =
  | {
      ok: true;
      message: string;
      toolCalls: ToolCallTrace[];
      messages: ChatCompletionMessageParam[];
      iterations: number;
    }
  | {
      ok: false;
      reason: "no_api_key" | "auth" | "rate_limited" | "timeout" | "network" | "iteration_limit";
      message: string;
    };

let cachedClient: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey, timeout: TIMEOUT_MS });
  return cachedClient;
}

const realDriver: ChatDriver = async ({ messages, tools, model }) => {
  const client = getClient();
  if (!client) throw new Error("OpenAI client unavailable");
  const response = await client.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 1500,
  });
  const choice = response.choices[0];
  if (!choice?.message) throw new Error("OpenAI returned no message");
  return choice.message;
};

export async function chatWithTools(request: ChatWithToolsRequest): Promise<ChatWithToolsResult> {
  const driver = request.driver ?? realDriver;
  const model = request.model ?? DEFAULT_MODEL;
  const maxIterations = request.maxIterations ?? MAX_ITERATIONS;
  const useRealOpenAi = request.driver === undefined;

  if (useRealOpenAi && !process.env.OPENAI_API_KEY) {
    return { ok: false, reason: "no_api_key", message: "OPENAI_API_KEY not set" };
  }

  const messages: ChatCompletionMessageParam[] = [...request.messages];
  const trace: ToolCallTrace[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    let assistantMessage: ChatCompletionMessage;
    try {
      assistantMessage = await driver({ messages, tools: request.tools, model });
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 403) {
          return { ok: false, reason: "auth", message: error.message };
        }
        if (error.status === 429) {
          return { ok: false, reason: "rate_limited", message: error.message };
        }
        return { ok: false, reason: "network", message: error.message };
      }
      if (error instanceof Error && error.name === "AbortError") {
        return {
          ok: false,
          reason: "timeout",
          message: `OpenAI did not respond in ${TIMEOUT_MS}ms`,
        };
      }
      return {
        ok: false,
        reason: "network",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    messages.push(assistantMessage);

    const toolCalls = (assistantMessage.tool_calls ?? []).filter(
      (call): call is Extract<ChatCompletionMessageToolCall, { type: "function" }> =>
        call.type === "function",
    );

    if (toolCalls.length === 0) {
      const text = (assistantMessage.content ?? "").toString();
      return {
        ok: true,
        message: text,
        toolCalls: trace,
        messages,
        iterations: iteration,
      };
    }

    for (const call of toolCalls) {
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(call.function.arguments || "{}");
      } catch {
        parsedArgs = {};
      }
      let result: unknown;
      let ok = true;
      try {
        result = await request.executeTool(call.function.name, parsedArgs);
      } catch (error) {
        ok = false;
        result = {
          error: "tool_failed",
          message: error instanceof Error ? error.message : String(error),
        };
      }
      trace.push({
        iteration,
        toolCallId: call.id,
        name: call.function.name,
        arguments: parsedArgs,
        result,
        ok,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
      logger.info("chat.tool_call", {
        iteration,
        tool: call.function.name,
        ok,
      });
    }
  }

  return {
    ok: false,
    reason: "iteration_limit",
    message: `Tool-use loop exceeded ${maxIterations} iterations`,
  };
}
