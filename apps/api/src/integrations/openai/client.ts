/**
 * OpenAI client wrapper.
 *
 * Wraps the chat-completions endpoint with structured output (JSON
 * mode), a deterministic temperature, a 30-second timeout, and a
 * discriminated error union — same contract pattern as the RentCast
 * and AirDNA clients so the orchestrator can handle missing keys,
 * rate limits, and schema drift uniformly.
 *
 * Returns parsed JSON for the caller to validate. We do not validate
 * here — services upstream apply Zod against their domain schemas.
 */

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logger } from "../../mcp/logger.js";

const TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type OpenAiClientError =
  | { kind: "no_api_key"; message: string }
  | { kind: "auth"; message: string }
  | { kind: "rate_limited"; message: string; retryAfterSeconds?: number }
  | { kind: "timeout"; message: string }
  | { kind: "schema_mismatch"; message: string }
  | { kind: "network"; message: string };

export type ChatJsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  /** Override the default model for a single call. */
  model?: string;
  /** Defaults to 0.4 — analyst-style consistency without robotic output. */
  temperature?: number;
  /** Defaults to 1500 tokens — enough for a memo, well under model limits. */
  maxTokens?: number;
};

export type ChatJsonResult =
  | {
      ok: true;
      json: unknown;
      model: string;
      usage?: { promptTokens: number; completionTokens: number };
    }
  | { ok: false; error: OpenAiClientError };

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  return key && key.length > 0 ? key : null;
}

let cachedClient: OpenAI | null = null;
function getClient(apiKey: string): OpenAI {
  if (cachedClient) return cachedClient;
  cachedClient = new OpenAI({ apiKey, timeout: TIMEOUT_MS });
  return cachedClient;
}

export async function chatJson(request: ChatJsonRequest): Promise<ChatJsonResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: { kind: "no_api_key", message: "OPENAI_API_KEY not set" },
    };
  }

  const client = getClient(apiKey);
  const model = request.model ?? DEFAULT_MODEL;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: request.systemPrompt },
    { role: "user", content: request.userPrompt },
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: request.temperature ?? 0.4,
      max_tokens: request.maxTokens ?? 1500,
      response_format: { type: "json_object" },
    });

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      return {
        ok: false,
        error: {
          kind: "schema_mismatch",
          message: "OpenAI returned no message content",
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "schema_mismatch",
          message: `OpenAI returned invalid JSON: ${
            error instanceof Error ? error.message : "unknown"
          }`,
        },
      };
    }

    return {
      ok: true,
      json: parsed,
      model,
      ...(response.usage
        ? {
            usage: {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
            },
          }
        : {}),
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401 || error.status === 403) {
        return { ok: false, error: { kind: "auth", message: error.message } };
      }
      if (error.status === 429) {
        return {
          ok: false,
          error: { kind: "rate_limited", message: error.message },
        };
      }
      logger.warn("openai.api_error", {
        status: error.status,
        message: error.message,
      });
      return {
        ok: false,
        error: { kind: "network", message: error.message },
      };
    }
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: { kind: "timeout", message: `OpenAI did not respond in ${TIMEOUT_MS}ms` },
      };
    }
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
