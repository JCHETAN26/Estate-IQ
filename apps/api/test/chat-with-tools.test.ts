/**
 * chat-with-tools loop tests.
 *
 * The driver parameter abstracts the LLM, so we can drive the loop
 * deterministically: the fake driver pushes a sequence of canned
 * assistant messages, the loop executes any tool calls against a fake
 * executor, and we verify the final state.
 */

import { describe, expect, it } from "vitest";
import type { ChatCompletionMessage, ChatCompletionTool } from "openai/resources/chat/completions";
import { chatWithTools } from "../src/integrations/openai/chat-with-tools.js";

const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "estimate_mortgage",
      description: "stub",
      parameters: { type: "object", properties: {} },
    },
  },
];

function makeFakeDriver(responses: ChatCompletionMessage[]) {
  let index = 0;
  return async () => {
    const next = responses[index];
    index += 1;
    if (!next) throw new Error("Driver ran out of canned responses");
    return next;
  };
}

describe("chatWithTools — single-turn no tools", () => {
  it("returns the final text when the model emits no tool calls", async () => {
    const driver = makeFakeDriver([
      { role: "assistant", content: "Hello, investor.", refusal: null },
    ]);
    const result = await chatWithTools({
      messages: [{ role: "user", content: "Hi" }],
      tools: TOOLS,
      executeTool: async () => ({ ok: true }),
      driver,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toBe("Hello, investor.");
    expect(result.toolCalls).toEqual([]);
    expect(result.iterations).toBe(1);
  });
});

describe("chatWithTools — tool call loop", () => {
  it("executes a tool call and feeds the result back to the model", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const driver = makeFakeDriver([
      {
        role: "assistant",
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: {
              name: "estimate_mortgage",
              arguments: JSON.stringify({ listPrice: 450000 }),
            },
          },
        ],
      },
      {
        role: "assistant",
        refusal: null,
        content: "Monthly P&I is $2,395.",
      },
    ]);
    const result = await chatWithTools({
      messages: [{ role: "user", content: "What's the P&I?" }],
      tools: TOOLS,
      executeTool: async (name, args) => {
        calls.push({ name, args });
        return { monthlyPrincipalAndInterest: 2395.09 };
      },
      driver,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations).toBe(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("estimate_mortgage");
    expect(result.toolCalls[0]?.ok).toBe(true);
    expect(calls).toEqual([{ name: "estimate_mortgage", args: { listPrice: 450000 } }]);
    expect(result.message).toBe("Monthly P&I is $2,395.");
  });

  it("captures tool errors and continues the loop", async () => {
    const driver = makeFakeDriver([
      {
        role: "assistant",
        content: null,
        refusal: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "estimate_mortgage", arguments: "{}" },
          },
        ],
      },
      {
        role: "assistant",
        refusal: null,
        content: "I could not get the number.",
      },
    ]);
    const result = await chatWithTools({
      messages: [{ role: "user", content: "?" }],
      tools: TOOLS,
      executeTool: async () => {
        throw new Error("upstream broke");
      },
      driver,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toolCalls[0]?.ok).toBe(false);
    expect(result.toolCalls[0]?.result).toMatchObject({
      error: "tool_failed",
      message: "upstream broke",
    });
  });
});

describe("chatWithTools — safety bounds", () => {
  it("returns iteration_limit when the model never stops calling tools", async () => {
    const looping: ChatCompletionMessage = {
      role: "assistant",
      content: null,
      refusal: null,
      tool_calls: [
        {
          id: "call_loop",
          type: "function",
          function: { name: "estimate_mortgage", arguments: "{}" },
        },
      ],
    };
    const driver = async () => looping;
    const result = await chatWithTools({
      messages: [{ role: "user", content: "?" }],
      tools: TOOLS,
      executeTool: async () => ({ ok: true }),
      driver,
      maxIterations: 3,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("iteration_limit");
  });
});
